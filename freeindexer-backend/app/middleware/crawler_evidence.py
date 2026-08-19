"""Crawler evidence middleware.

Classifies inbound requests to the public discovery pages and verifies
Googlebot visits using Google's documented method:

1. Reverse DNS: the PTR record of the client IP must resolve to a hostname
   ending in ``.googlebot.com``.
2. Forward DNS: the A records of that hostname must include the client IP.

Only requests that pass both checks are stored as ``verified_googlebot`` rows
and only those rows can feed the ``crawler_evidence`` verification strategy.
This is deliberately conservative: a browser or tool can fake any User-Agent,
but it cannot fake Google's IP space + DNS.

The middleware never writes to the database and never raises: recording
failures must never break the public pages. It only builds the access-log row
and stashes it on ``request.state``; the ``persist_crawler_evidence``
dependency then adds it to the request's own session, so it commits atomically
with the response — no background tasks, no extra connections, no races.
"""
from __future__ import annotations

import asyncio
import hashlib
import ipaddress
import logging
import socket
from collections.abc import Callable
from datetime import datetime, timezone

from fastapi import Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from app.core.config import settings
from app.database import get_db
from app.modules.indexing.engine.models import (
    CrawlEvidence,
    DiscoveryAccessLog,
    IndexingJob,
)
from app.modules.indexing.engine.states import CrawlEvidenceType

logger = logging.getLogger(__name__)

#: User-Agent classification. Order matters: Google markers are checked first
#: because Google's crawlers include "googlebot" in many sub-product UAs.
GOOGLEBOT_MARKERS = ("googlebot",)
BINGBOT_MARKERS = ("bingbot", "msnbot", "bingpreview")
OTHER_CRAWLER_MARKERS = (
    "duckduckbot",
    "baiduspider",
    "yandexbot",
    "yandex/",
    "ahrefsbot",
    "semrushbot",
    "mj12bot",
    "majestic",
    "dotbot",
    "petalbot",
    "applebot",
    "facebookexternalhit",
    "twitterbot",
    "linkedinbot",
    "slurp",
    "ia_archiver",
    "archive.org_bot",
    "sogou",
    "exabot",
    "rogerbot",
    "serpstatbot",
    "screaming frog",
    "uptimerobot",
    "pingdom",
)

GOOGLEBOT_DNS_SUFFIX = ".googlebot.com"

STATE_ROW_ATTR = "crawler_evidence_row"


def classify_user_agent(user_agent: str | None) -> str:
    """Classify a User-Agent into a coarse bucket for the access log."""
    if not user_agent:
        return "unknown_bot"
    ua = user_agent.lower()
    if any(m in ua for m in GOOGLEBOT_MARKERS):
        return "googlebot"
    if any(m in ua for m in BINGBOT_MARKERS):
        return "bingbot"
    if any(m in ua for m in OTHER_CRAWLER_MARKERS):
        return "other_crawler"
    return "browser"


def hash_ip(client_ip: str | None, salt: str | None = None) -> str | None:
    """Salted SHA-256 of the client IP — raw IPs are never persisted."""
    if not client_ip:
        return None
    client_ip = client_ip.removeprefix("::ffff:")
    salt = salt or settings.access_log_salt
    return hashlib.sha256(f"{salt}:{client_ip}".encode()).hexdigest()


def _verify_googlebot_dns_sync(client_ip: str) -> tuple[bool, str | None]:
    """Google's documented verification: PTR must end .googlebot.com, forward A must match.

    Runs in a threadpool executor — never in the event loop.
    """
    try:
        ipaddress.ip_address(client_ip)
    except ValueError:
        return False, None
    try:
        hostname, _, _ = socket.gethostbyaddr(client_ip)
    except OSError:
        return False, None
    hostname = hostname.rstrip(".").lower()
    if not hostname.endswith(GOOGLEBOT_DNS_SUFFIX):
        return False, hostname
    try:
        resolved = {entry[4][0] for entry in socket.getaddrinfo(hostname, None)}
    except OSError:
        return False, hostname
    if client_ip not in resolved:
        return False, hostname
    return True, hostname


async def verify_googlebot_ip(client_ip: str | None) -> tuple[bool, str | None]:
    """Async wrapper around the synchronous DNS verification."""
    if not client_ip:
        return False, None
    return await asyncio.get_running_loop().run_in_executor(
        None, _verify_googlebot_dns_sync, client_ip
    )


def url_hash_from_path(path: str) -> str | None:
    """Extract the job hash from a public detail-page path, if any."""
    prefix = f"{settings.api_v1_prefix}/public/url/"
    if path.startswith(prefix):
        seg = path[len(prefix):]
        return seg.split("/")[0] if seg else None
    prefix_json = f"{settings.api_v1_prefix}/public/urls/"
    if path.startswith(prefix_json):
        seg = path[len(prefix_json):]
        return seg.split("/")[0] if seg else None
    return None


def _is_public_path(path: str) -> bool:
    return path.startswith(f"{settings.api_v1_prefix}/public/") or path in (
        "/robots.txt",
        "/sitemap.xml",
    )


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first = forwarded.split(",")[0].strip()
        if first:
            return first
    if request.client:
        return request.client.host
    return None


class CrawlerEvidenceMiddleware(BaseHTTPMiddleware):
    """Classify + verify public-page hits and stash the access-log row."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        row: DiscoveryAccessLog | None = None
        try:
            if (
                settings.crawler_evidence_enabled
                and request.method == "GET"
                and _is_public_path(request.url.path)
            ):
                row = await self._build_row(request)
        except Exception:  # pragma: no cover - recording must never break pages
            logger.exception("crawler evidence recording failed")
            row = None
        response = await call_next(request)
        if row is not None:
            row.status_code = response.status_code
        return response

    async def _build_row(self, request: Request) -> DiscoveryAccessLog:
        """Classify + verify the hit and stash the row before the route runs.

        The row must be stashed *before* ``call_next``: the
        ``persist_crawler_evidence`` dependency (which reads it) runs inside
        the downstream request, and ``Request.state`` is scope-backed, so both
        sides see the same object.
        """
        user_agent = (request.headers.get("user-agent") or "")[:255] or None
        ua_class = classify_user_agent(user_agent)
        client_ip = _client_ip(request)
        row = DiscoveryAccessLog(
            url_hash=url_hash_from_path(request.url.path),
            requested_url=str(request.url)[:2048],
            requested_path=request.url.path[:512],
            user_agent=user_agent,
            ua_class=ua_class,
            ip_hash=hash_ip(client_ip),
            status_code=0,
            referer=(request.headers.get("referer") or "")[:2048] or None,
            verified_googlebot=False,
        )
        is_googlebot = False
        hostname: str | None = None
        if ua_class == "googlebot":
            if settings.googlebot_dns_verify:
                is_googlebot, hostname = await verify_googlebot_ip(client_ip)
            else:  # pragma: no cover - test/dev mode only
                is_googlebot = True
        if ua_class == "googlebot" and not is_googlebot:
            row.ua_class = "googlebot_unverified"
        row.verified_googlebot = is_googlebot
        row.googlebot_hostname = hostname
        row.verification_source = (
            "reverse_forward_dns" if is_googlebot and settings.googlebot_dns_verify else "ua_only"
        )
        request.state.crawler_evidence_row = row
        return row


async def persist_crawler_evidence(
    request: Request, db: AsyncSession = Depends(get_db)
) -> None:
    """Dependency: write the stashed access-log row into the request's session.

    Runs inside the request's own transaction, so the row commits atomically
    with the response — no background task, no separate connection, and no way
    for the write to be lost to a concurrent session's rollback.
    """
    row: DiscoveryAccessLog | None = getattr(request.state, STATE_ROW_ATTR, None)
    if row is None:
        return
    try:
        db.add(row)
        if row.verified_googlebot and row.url_hash:
            job = (
                await db.execute(
                    select(IndexingJob.id, IndexingJob.tenant_id).where(
                        IndexingJob.source_url_hash == row.url_hash
                    )
                )
            ).first()
            if job:
                job_id, tenant_id = job
                evidence = CrawlEvidence(
                    tenant_id=tenant_id,
                    job_id=job_id,
                    url=row.requested_url,
                    crawler_identity="googlebot_verified",
                    user_agent=row.user_agent,
                    source="inbound_access_log",
                    status_code=row.status_code,
                    observed_at=datetime.now(timezone.utc),
                    evidence_type=CrawlEvidenceType.CRAWLER_EVIDENCE.value,
                    confidence=0.9,
                    details={
                        "url_hash": row.url_hash,
                        "googlebot_hostname": row.googlebot_hostname,
                        "verification_source": row.verification_source,
                        "requested_path": row.requested_path,
                    },
                )
                db.add(evidence)
    except Exception:  # pragma: no cover - never break the public pages
        logger.exception("crawler evidence persist failed")
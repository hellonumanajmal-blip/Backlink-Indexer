"""Outbound clients for each indexing submission channel.

Every provider returns a :class:`ProviderResult` describing exactly what
happened, including the HTTP status code, so the dispatcher can persist an
honest audit trail. Providers never fabricate a successful result: a missing
API key yields ``skipped``, and a network failure yields ``failed``.
"""
from __future__ import annotations

import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence
from urllib.parse import urlparse

from app.core.config import settings
from app.modules.indexing.constants import (
    ATTEMPT_FAILED,
    ATTEMPT_NOT_APPLICABLE,
    ATTEMPT_OUT_OF_CREDITS,
    ATTEMPT_SKIPPED,
    ATTEMPT_SUCCESS,
    METHOD_GOOGLE_INDEXING,
    METHOD_INDEXBOLT,
    METHOD_INDEXNOW,
    METHOD_LABELS,
    METHOD_RAPID_URL_INDEXER,
    METHOD_WEBSUB,
)

#: Cap on the persisted response body so a chatty provider cannot bloat the table.
MAX_RESPONSE_BODY = 2000

#: OAuth scope required by the Google Indexing API.
GOOGLE_INDEXING_SCOPE = "https://www.googleapis.com/auth/indexing"


@dataclass(slots=True)
class ProviderResult:
    """Outcome of a single provider call."""

    method: str
    status: str
    endpoint: str
    request_payload: Dict[str, Any] = field(default_factory=dict)
    response_code: Optional[int] = None
    response_body: Optional[str] = None
    error: Optional[str] = None
    external_ref: Optional[str] = None
    duration_ms: int = 0

    @property
    def ok(self) -> bool:
        return self.status == ATTEMPT_SUCCESS


def mask_secret(value: str) -> str:
    """Render a secret as a non-reversible hint safe to store in ``ping_logs``."""
    if not value:
        return ""
    return f"{value[:4]}\u2026({len(value)} chars)"


def host_of(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


def is_owned(url: str) -> bool:
    """True when ``url``'s host is one of ``FI_OWNED_DOMAINS`` (or a subdomain).

    Shared by every owner-only channel (IndexNow, Google Indexing API), so they
    agree on exactly which URLs we are entitled to submit.
    """
    host = host_of(url)
    if not host:
        return False
    for owned in settings.owned_domains:
        owned = owned.strip().lower().lstrip(".")
        if owned and (host == owned or host.endswith(f".{owned}")):
            return True
    return False


def _truncate(text: str) -> str:
    return text[:MAX_RESPONSE_BODY]


def _parse_json(text: str) -> Optional[Dict[str, Any]]:
    try:
        parsed = json.loads(text)
    except (ValueError, TypeError):
        return None
    return parsed if isinstance(parsed, dict) else None


async def post_json(
    url: str,
    *,
    payload: Dict[str, Any],
    headers: Dict[str, str],
    timeout: float,
) -> tuple[Optional[int], str, Optional[str]]:
    """POST JSON and return ``(status_code, body, error)``.

    ``status_code`` is ``None`` when the request never completed. Unlike a
    simulated response, a missing HTTP client is reported as a real error.
    """
    try:
        import httpx
    except ImportError:
        return None, "", "httpx is not installed; cannot perform outbound HTTP requests"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json=payload, headers=headers)
            return response.status_code, response.text or "", None
    except Exception as exc:  # network error, timeout, DNS failure, TLS failure
        return None, "", f"{type(exc).__name__}: {exc}"


async def post_form(
    url: str,
    *,
    payload: Dict[str, Any],
    headers: Dict[str, str],
    timeout: float,
) -> tuple[Optional[int], str, Optional[str]]:
    """POST ``application/x-www-form-urlencoded`` data, like :func:`post_json`.

    WebSub hubs speak form encoding, not JSON. The signature mirrors
    :func:`post_json` so both share the same test transport.
    """
    try:
        import httpx
    except ImportError:
        return None, "", "httpx is not installed; cannot perform outbound HTTP requests"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, data=payload, headers=headers)
            return response.status_code, response.text or "", None
    except Exception as exc:  # network error, timeout, DNS failure, TLS failure
        return None, "", f"{type(exc).__name__}: {exc}"


class IndexerProvider(ABC):
    """Common interface for every submission channel."""

    method: str = ""

    @property
    def label(self) -> str:
        return METHOD_LABELS.get(self.method, self.method)

    @property
    @abstractmethod
    def endpoint(self) -> str: ...

    @property
    @abstractmethod
    def enabled(self) -> bool: ...

    @property
    @abstractmethod
    def configured(self) -> bool: ...

    @property
    def unavailable_reason(self) -> Optional[str]:
        if not self.enabled:
            return f"{self.label} is disabled by configuration"
        if not self.configured:
            return f"{self.label} has no API key configured"
        return None

    @abstractmethod
    async def submit(self, urls: Sequence[str]) -> ProviderResult: ...

    def _skipped(self, reason: str) -> ProviderResult:
        return ProviderResult(
            method=self.method,
            status=ATTEMPT_SKIPPED,
            endpoint=self.endpoint,
            error=reason,
        )


class IndexNowProvider(IndexerProvider):
    """IndexNow ping for domains we control.

    IndexNow requires the submitting party to serve ``{key}.txt`` on the target
    host, so it can only be used for domains listed in ``FI_OWNED_DOMAINS``.
    Third-party backlinks are reported as ``not_applicable`` rather than being
    submitted and silently rejected. It also does not reach Google, which does
    not participate in the protocol.
    """

    method = METHOD_INDEXNOW
    #: IndexNow returns 202 while the key file is still being validated.
    SUCCESS_CODES = (200, 202)

    @property
    def endpoint(self) -> str:
        return settings.indexnow_endpoint

    @property
    def enabled(self) -> bool:
        return settings.indexnow_enabled

    @property
    def configured(self) -> bool:
        return bool(settings.indexnow_key) and bool(settings.owned_domains)

    def owns(self, url: str) -> bool:
        return is_owned(url)

    def key_file_name(self) -> str:
        return f"{settings.indexnow_key}.txt"

    async def submit(self, urls: Sequence[str]) -> ProviderResult:
        if reason := self.unavailable_reason:
            return self._skipped(reason)

        owned = [u for u in urls if self.owns(u)]
        if not owned:
            return ProviderResult(
                method=self.method,
                status=ATTEMPT_NOT_APPLICABLE,
                endpoint=self.endpoint,
                error=(
                    "Host is not in FI_OWNED_DOMAINS; IndexNow requires serving "
                    "the key file on the target domain"
                ),
            )

        # The protocol requires every URL in a submission to share one host.
        host = host_of(owned[0])
        same_host = [u for u in owned if host_of(u) == host]
        key = settings.indexnow_key

        payload = {
            "host": host,
            "key": key,
            "keyLocation": f"https://{host}/{key}.txt",
            "urlList": same_host,
        }
        logged_payload = {
            **payload,
            "key": mask_secret(key),
            "keyLocation": f"https://{host}/{mask_secret(key)}.txt",
        }

        started = time.perf_counter()
        code, body, error = await post_json(
            self.endpoint,
            payload=payload,
            headers={"Content-Type": "application/json; charset=utf-8"},
            timeout=settings.indexer_http_timeout_seconds,
        )
        duration_ms = int((time.perf_counter() - started) * 1000)

        if error is not None:
            status = ATTEMPT_FAILED
        elif code in self.SUCCESS_CODES:
            status = ATTEMPT_SUCCESS
        else:
            status = ATTEMPT_FAILED
            error = f"IndexNow returned HTTP {code}"

        return ProviderResult(
            method=self.method,
            status=status,
            endpoint=self.endpoint,
            request_payload=logged_payload,
            response_code=code,
            response_body=_truncate(body) or None,
            error=error,
            duration_ms=duration_ms,
        )


class WebSubProvider(IndexerProvider):
    """WebSub (PubSubHubbub) publish — the one free channel that can reach Google
    for URLs we do **not** own.

    Every free *submission* API is owner-only: IndexNow needs a key file on the
    target host, and the Google Indexing API / GSC URL Inspection API / Bing URL
    Submission API all require verifying the domain. None of that is possible for
    third-party backlinks (Reddit, Product Hunt, directories). WebSub sidesteps
    the ownership wall: we publish the backlink URLs in a feed on a domain we
    control and send a publish ping so the hub re-fetches that feed. Google runs
    a live hub, so Googlebot's Feedfetcher discovers the URLs from our feed.

    This is a *discovery* signal, never an indexing guarantee. A 2xx from the hub
    means the hub accepted the notification — Google alone decides what to index.
    """

    method = METHOD_WEBSUB
    #: Hubs answer a publish with 202 Accepted or 204 No Content; 200 is allowed.
    SUCCESS_CODES = (200, 202, 204)

    @property
    def hubs(self) -> List[str]:
        return settings.websub_hub_urls

    @property
    def feed_url(self) -> str:
        return settings.websub_feed_url

    @property
    def endpoint(self) -> str:
        return self.hubs[0] if self.hubs else ""

    @property
    def enabled(self) -> bool:
        return settings.websub_enabled

    @property
    def configured(self) -> bool:
        return bool(self.feed_url) and bool(self.hubs)

    @property
    def unavailable_reason(self) -> Optional[str]:
        if not self.enabled:
            return f"{self.label} is disabled by configuration"
        if not self.feed_url:
            return (
                "WebSub has no feed configured; set FI_WEBSUB_FEED_URL to a feed "
                "on a domain you control that lists these URLs"
            )
        if not self.hubs:
            return "WebSub has no hub URLs configured"
        return None

    async def submit(self, urls: Sequence[str]) -> ProviderResult:
        if reason := self.unavailable_reason:
            return self._skipped(reason)

        payload = {"hub.mode": "publish", "hub.url": self.feed_url}
        # WebSub broadcasts the feed, not individual URLs; record the URLs we
        # expect the feed to carry so the audit trail stays honest.
        logged_payload: Dict[str, Any] = {
            **payload,
            "hubs": list(self.hubs),
            "urls": list(urls),
        }

        started = time.perf_counter()
        last_code: Optional[int] = None
        last_body = ""
        errors: List[str] = []
        success = False
        for hub in self.hubs:
            code, body, error = await post_form(
                hub,
                payload=payload,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=settings.indexer_http_timeout_seconds,
            )
            if error is None and code in self.SUCCESS_CODES:
                success = True
                last_code, last_body = code, body
                break
            last_code = code if code is not None else last_code
            last_body = body or last_body
            errors.append(error or f"{hub} returned HTTP {code}")
        duration_ms = int((time.perf_counter() - started) * 1000)

        return ProviderResult(
            method=self.method,
            status=ATTEMPT_SUCCESS if success else ATTEMPT_FAILED,
            endpoint=self.endpoint,
            request_payload=logged_payload,
            response_code=last_code,
            response_body=_truncate(last_body) or None,
            error=None if success else ("; ".join(errors) or "WebSub publish failed"),
            duration_ms=duration_ms,
        )


class GoogleIndexingProvider(IndexerProvider):
    """Google Indexing API — a free, owner-only, direct notification to Google.

    This is the only *free* channel that pushes a URL straight into Google's
    crawl queue (``urlNotifications:publish``). Unlike IndexNow (Bing/Yandex
    only) and WebSub (indirect feed discovery), it talks to Google directly.

    Its hard limits make it a companion to — not a replacement for — the other
    free channels:

    * **Owner-only.** The service account must be an *Owner* of the domain in
      Google Search Console, so it can never touch third-party backlinks
      (Reddit, Product Hunt, directories). Those are reported ``not_applicable``,
      exactly like IndexNow, rather than being sent and rejected with a 403.
    * **Officially JobPosting/BroadcastEvent only.** Google documents the API for
      those page types; using it for regular pages is a common unofficial
      workaround. Misuse can get *this API* revoked (not a domain penalty). A
      200 means Google *accepted the notification*, never that it indexed the
      page. That is why the dispatcher does not put this channel in
      ``FREE_METHODS``: it only runs when listed in ``FI_INDEXER_PROVIDER_ORDER``.
    * **Skipped until configured.** Without a service account it records a
      ``skipped`` attempt; it is never faked as a success. Without being listed
      in ``FI_INDEXER_PROVIDER_ORDER`` it is not attempted at all.

    Auth is the standard service-account JWT-bearer grant: sign a short-lived
    assertion with the private key, exchange it for an access token, then publish.
    The private key and access token are never persisted in the audit trail.
    """

    method = METHOD_GOOGLE_INDEXING

    @property
    def endpoint(self) -> str:
        return settings.google_indexing_endpoint

    @property
    def enabled(self) -> bool:
        return settings.google_indexing_enabled

    @property
    def configured(self) -> bool:
        return bool(
            settings.google_indexing_client_email
            and settings.google_indexing_private_key
            and settings.owned_domains
        )

    @property
    def unavailable_reason(self) -> Optional[str]:
        if not self.enabled:
            return f"{self.label} is disabled by configuration"
        if not (
            settings.google_indexing_client_email and settings.google_indexing_private_key
        ):
            return (
                "Google Indexing API has no service account configured; set "
                "FI_GOOGLE_INDEXING_CLIENT_EMAIL and FI_GOOGLE_INDEXING_PRIVATE_KEY"
            )
        if not settings.owned_domains:
            return (
                "Google Indexing API is owner-only; set FI_OWNED_DOMAINS to the "
                "domains whose Search Console property lists the service account"
            )
        return None

    def _build_assertion(self) -> str:
        """Sign the service-account JWT used to obtain an access token."""
        import jwt  # PyJWT (with the crypto extra) provides RS256.

        now = int(time.time())
        # A key pasted onto a single .env line carries literal "\n" escapes.
        private_key = settings.google_indexing_private_key.replace("\\n", "\n")
        claims = {
            "iss": settings.google_indexing_client_email,
            "scope": GOOGLE_INDEXING_SCOPE,
            "aud": settings.google_indexing_token_uri,
            "iat": now,
            "exp": now + 3600,
        }
        return jwt.encode(claims, private_key, algorithm="RS256")

    async def _acquire_token(self) -> tuple[Optional[str], Optional[str]]:
        """Return ``(access_token, error)`` from the JWT-bearer token exchange."""
        try:
            assertion = self._build_assertion()
        except Exception as exc:  # bad/missing key, PyJWT not installed, etc.
            return None, f"failed to sign service-account assertion: {type(exc).__name__}: {exc}"

        code, body, error = await post_form(
            settings.google_indexing_token_uri,
            payload={
                "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                "assertion": assertion,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=settings.indexer_http_timeout_seconds,
        )
        if error is not None:
            return None, f"OAuth token request failed: {error}"
        if code != 200:
            parsed = _parse_json(body) or {}
            detail = parsed.get("error_description") or parsed.get("error") or f"HTTP {code}"
            return None, f"OAuth token request rejected: {detail}"
        token = (_parse_json(body) or {}).get("access_token")
        if not token:
            return None, "OAuth token response contained no access_token"
        return str(token), None

    async def submit(self, urls: Sequence[str]) -> ProviderResult:
        if reason := self.unavailable_reason:
            return self._skipped(reason)

        owned = [u for u in urls if is_owned(u)]
        if not owned:
            return ProviderResult(
                method=self.method,
                status=ATTEMPT_NOT_APPLICABLE,
                endpoint=self.endpoint,
                error=(
                    "Host is not in FI_OWNED_DOMAINS; the Google Indexing API is "
                    "owner-only (the service account must be a Search Console "
                    "Owner of the domain), so it cannot submit third-party backlinks"
                ),
            )

        logged_payload: Dict[str, Any] = {
            "urls": list(owned),
            "type": "URL_UPDATED",
            "client_email": settings.google_indexing_client_email,
        }

        started = time.perf_counter()
        token, token_error = await self._acquire_token()
        if token is None:
            return ProviderResult(
                method=self.method,
                status=ATTEMPT_FAILED,
                endpoint=self.endpoint,
                request_payload=logged_payload,
                error=token_error,
                duration_ms=int((time.perf_counter() - started) * 1000),
            )

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
        last_code: Optional[int] = None
        last_body = ""
        errors: List[str] = []
        succeeded = 0
        out_of_credits = False
        for url in owned:
            code, body, error = await post_json(
                self.endpoint,
                payload={"url": url, "type": "URL_UPDATED"},
                headers=headers,
                timeout=settings.indexer_http_timeout_seconds,
            )
            last_code = code if code is not None else last_code
            last_body = body or last_body
            if error is not None:
                errors.append(error)
            elif code == 200:
                succeeded += 1
            elif code == 429:
                out_of_credits = True
                errors.append("quota exceeded (HTTP 429); resets at midnight Pacific")
                break
            elif code == 403:
                errors.append(
                    "HTTP 403 — the service account is not an Owner of this "
                    "domain in Search Console (or the daily quota is exhausted)"
                )
            else:
                errors.append(f"Google Indexing API returned HTTP {code}")
        duration_ms = int((time.perf_counter() - started) * 1000)

        if succeeded == len(owned):
            status = ATTEMPT_SUCCESS
            error_text: Optional[str] = None
        elif out_of_credits and succeeded == 0:
            status = ATTEMPT_OUT_OF_CREDITS
            error_text = "; ".join(errors)
        else:
            status = ATTEMPT_FAILED
            error_text = "; ".join(errors) or "Google Indexing API publish failed"

        return ProviderResult(
            method=self.method,
            status=status,
            endpoint=self.endpoint,
            request_payload=logged_payload,
            response_code=last_code,
            response_body=_truncate(last_body) or None,
            error=error_text,
            duration_ms=duration_ms,
        )


class IndexBoltProvider(IndexerProvider):
    """Optional paid indexer, disabled by default (free-only pipeline).

    Kept and tested so a key can be turned on later via FI_INDEXBOLT_ENABLED +
    FI_INDEXER_PROVIDER_ORDER. Docs: https://www.indexbolt.com/url-indexing-api
    """

    method = METHOD_INDEXBOLT

    @property
    def endpoint(self) -> str:
        return f"{settings.indexbolt_base_url.rstrip('/')}/submit"

    @property
    def enabled(self) -> bool:
        return settings.indexbolt_enabled

    @property
    def configured(self) -> bool:
        return bool(settings.indexbolt_api_key)

    async def submit(self, urls: Sequence[str]) -> ProviderResult:
        if reason := self.unavailable_reason:
            return self._skipped(reason)

        payload: Dict[str, Any] = {
            "urls": list(urls),
            "indexingType": settings.indexbolt_indexing_type,
        }
        if settings.indexbolt_project_id:
            payload["projectId"] = settings.indexbolt_project_id

        started = time.perf_counter()
        code, body, error = await post_json(
            self.endpoint,
            payload=payload,
            headers={
                "Authorization": f"Bearer {settings.indexbolt_api_key}",
                "Content-Type": "application/json",
            },
            timeout=settings.indexer_http_timeout_seconds,
        )
        duration_ms = int((time.perf_counter() - started) * 1000)

        external_ref: Optional[str] = None
        if error is not None:
            status = ATTEMPT_FAILED
        elif code == 402:
            status = ATTEMPT_OUT_OF_CREDITS
            error = "IndexBolt reported INSUFFICIENT_CREDITS"
        elif code in (200, 201):
            status = ATTEMPT_SUCCESS
            parsed = _parse_json(body) or {}
            data = parsed.get("data") if isinstance(parsed.get("data"), dict) else {}
            external_ref = (data or {}).get("submissionId")
        else:
            status = ATTEMPT_FAILED
            parsed = _parse_json(body) or {}
            detail = (parsed.get("error") or {}).get("message") if parsed else None
            error = detail or f"IndexBolt returned HTTP {code}"

        return ProviderResult(
            method=self.method,
            status=status,
            endpoint=self.endpoint,
            request_payload=payload,
            response_code=code,
            response_body=_truncate(body) or None,
            error=error,
            external_ref=external_ref,
            duration_ms=duration_ms,
        )


class RapidUrlIndexerProvider(IndexerProvider):
    """Optional paid indexer (billed per indexed result), disabled by default.

    Kept and tested so a key can be turned on later via FI_RAPIDURLINDEXER_ENABLED
    + FI_INDEXER_PROVIDER_ORDER. Docs: https://rapidurlindexer.com/indexing-api/
    """

    method = METHOD_RAPID_URL_INDEXER

    @property
    def endpoint(self) -> str:
        return f"{settings.rapidurlindexer_base_url.rstrip('/')}/projects"

    @property
    def enabled(self) -> bool:
        return settings.rapidurlindexer_enabled

    @property
    def configured(self) -> bool:
        return bool(settings.rapidurlindexer_api_key)

    async def submit(self, urls: Sequence[str]) -> ProviderResult:
        if reason := self.unavailable_reason:
            return self._skipped(reason)

        payload: Dict[str, Any] = {
            "project_name": self._project_name(urls),
            "urls": list(urls),
            "notify_on_status_change": False,
            "apex_mode_enabled": settings.rapidurlindexer_apex_mode,
        }

        started = time.perf_counter()
        code, body, error = await post_json(
            self.endpoint,
            payload=payload,
            headers={
                "X-API-Key": settings.rapidurlindexer_api_key,
                "Content-Type": "application/json",
            },
            timeout=settings.indexer_http_timeout_seconds,
        )
        duration_ms = int((time.perf_counter() - started) * 1000)

        external_ref: Optional[str] = None
        parsed = _parse_json(body) or {}
        message = str(parsed.get("message", ""))

        if error is not None:
            status = ATTEMPT_FAILED
        elif code in (200, 201):
            status = ATTEMPT_SUCCESS
            project_id = parsed.get("project_id")
            external_ref = str(project_id) if project_id is not None else None
        elif code == 403 and "credit" in message.lower():
            status = ATTEMPT_OUT_OF_CREDITS
            error = f"Rapid URL Indexer reported: {message}"
        else:
            status = ATTEMPT_FAILED
            error = message or f"Rapid URL Indexer returned HTTP {code}"

        return ProviderResult(
            method=self.method,
            status=status,
            endpoint=self.endpoint,
            request_payload=payload,
            response_code=code,
            response_body=_truncate(body) or None,
            error=error,
            external_ref=external_ref,
            duration_ms=duration_ms,
        )

    @staticmethod
    def _project_name(urls: Sequence[str]) -> str:
        host = host_of(urls[0]) if urls else "batch"
        return f"freeindexer-{host}-{int(time.time())}"


def build_providers() -> Dict[str, IndexerProvider]:
    """Instantiate every known provider, keyed by method name.

    Free channels (IndexNow, WebSub) always run. Opt-in channels — the paid
    indexers and the Google Indexing API — are present but only enter the chain
    via FI_INDEXER_PROVIDER_ORDER. Google Indexing is free and owner-only, but
    unofficial for non-JobPosting/BroadcastEvent pages, so it is opt-in.
    """
    providers: List[IndexerProvider] = [
        IndexNowProvider(),
        WebSubProvider(),
        GoogleIndexingProvider(),
        IndexBoltProvider(),
        RapidUrlIndexerProvider(),
    ]
    return {p.method: p for p in providers}

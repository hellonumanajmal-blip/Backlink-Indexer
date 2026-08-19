"""Pluggable index verification.

HTTP 200, our crawler visit, a discovery POST, or a sitemap listing never
produce INDEXED. INDEXED requires a verification strategy with evidence.

Strategies:

* Search Console URL Inspection — owned properties only, high confidence
* Google Custom Search JSON API — optional, incomplete index, miss → UNKNOWN
* Manual operator evidence — recorded with method + note
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence
from urllib.parse import quote

from sqlalchemy import select

from app.core.config import settings
from app.modules.indexing.engine.states import PropertyType, VisibilityStatus
from app.modules.indexing.providers import post_json

# CSE free quota documented by Google.
GOOGLE_CSE_DAILY_QUOTA = 100
#: INDEXED requires reliable evidence. A single moderate CSE hit is not enough.
INDEXED_MIN_CONFIDENCE = 0.8


@dataclass(slots=True)
class VerificationResult:
    status: str
    confidence: float
    checked_at: datetime
    method: str
    evidence: str
    googlebot_visited: bool = False
    details: Dict[str, Any] = field(default_factory=dict)
    #: Crawler-evidence metadata persisted on the VerificationAttempt row.
    crawler_user_agent: Optional[str] = None
    requested_url: Optional[str] = None
    verification_source: Optional[str] = None

    def as_dict(self) -> Dict[str, Any]:
        return {
            "status": self.status,
            "confidence": self.confidence,
            "checked_at": self.checked_at.isoformat(),
            "method": self.method,
            "evidence": self.evidence,
        }


class VerificationStrategy(ABC):
    name: str = ""

    @abstractmethod
    async def verify(
        self,
        url: str,
        *,
        property_type: PropertyType,
    ) -> Optional[VerificationResult]:
        """Return a result, or None when this strategy cannot run."""


class HttpNeverIndexedStrategy(VerificationStrategy):
    """Guard: HTTP accessibility is not indexing evidence. Always skipped."""

    name = "http_status_rejected"

    async def verify(self, url: str, *, property_type: PropertyType) -> Optional[VerificationResult]:
        return None


class SearchConsoleStrategy(VerificationStrategy):
    """Google Search Console URL Inspection API — owned properties only."""

    name = "google_search_console"
    INSPECT_ENDPOINT = "https://searchconsole.googleapis.com/v1/urlInspection/index:inspect"

    def __init__(
        self,
        *,
        access_token: str = "",
        site_url: str = "",
        inspect=None,
    ) -> None:
        self.access_token = access_token
        self.site_url = site_url
        self._inspect = inspect

    async def verify(
        self, url: str, *, property_type: PropertyType
    ) -> Optional[VerificationResult]:
        now = datetime.now(timezone.utc)
        if property_type != PropertyType.OWNED_PROPERTY:
            return None
        if not self.access_token or not self.site_url:
            return None
        if not _url_on_gsc_property(url, self.site_url):
            return VerificationResult(
                status=VisibilityStatus.UNKNOWN.value,
                confidence=0.0,
                checked_at=now,
                method=self.name,
                evidence=(
                    "GSC inspection skipped: URL is not on the configured Search Console "
                    f"property ({self.site_url})"
                ),
                details={"reason": "wrong_property", "site_url": self.site_url},
            )
        payload = {"inspectionUrl": url, "siteUrl": self.site_url}
        if self._inspect is not None:
            code, body, error = await self._inspect(self.INSPECT_ENDPOINT, payload=payload)
        else:
            code, body, error = await post_json(
                self.INSPECT_ENDPOINT,
                payload=payload,
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json",
                },
                timeout=20.0,
            )
        if error or code != 200:
            reason = "gsc_error"
            if code == 401:
                reason = "expired_or_invalid_token"
            elif code == 403:
                reason = "unauthorized_property"
            return VerificationResult(
                status=VisibilityStatus.UNKNOWN.value,
                confidence=0.0,
                checked_at=now,
                method=self.name,
                evidence=error or f"GSC inspection HTTP {code} ({reason})",
                details={"http_status": code, "reason": reason},
            )
        parsed = _json_obj(body)
        index = ((parsed.get("inspectionResult") or {}).get("indexStatusResult") or {})
        coverage = str(index.get("coverageState") or "")
        crawled = str(index.get("lastCrawlTime") or "")
        googlebot = bool(crawled)
        verdict = str(index.get("verdict") or "").upper()
        coverage_l = coverage.lower()
        indexed_claim = (
            ("indexed" in coverage_l and "not indexed" not in coverage_l)
            or verdict == "PASS"
        )
        if indexed_claim:
            return VerificationResult(
                status=VisibilityStatus.INDEXED.value,
                confidence=0.92,
                checked_at=now,
                method=self.name,
                evidence=f"Search Console coverageState={coverage or verdict}",
                googlebot_visited=googlebot,
                details=index,
            )
        if "crawled" in coverage_l and "not indexed" in coverage_l:
            return VerificationResult(
                status=VisibilityStatus.CRAWLED.value,
                confidence=0.85,
                checked_at=now,
                method=self.name,
                evidence=f"Search Console coverageState={coverage}",
                googlebot_visited=googlebot or True,
                details=index,
            )
        if "discovered" in coverage_l:
            return VerificationResult(
                status=VisibilityStatus.DISCOVERED.value,
                confidence=0.7,
                checked_at=now,
                method=self.name,
                evidence=f"Search Console coverageState={coverage}",
                googlebot_visited=googlebot,
                details=index,
            )
        if coverage:
            status = (
                VisibilityStatus.NOT_INDEXED.value
                if "not" in coverage_l or "excluded" in coverage_l
                else VisibilityStatus.UNKNOWN.value
            )
            confidence = 0.9 if status == VisibilityStatus.NOT_INDEXED.value else 0.4
            vis = (
                VisibilityStatus.CRAWLED.value
                if googlebot and status != VisibilityStatus.NOT_INDEXED.value
                else status
            )
            if status == VisibilityStatus.NOT_INDEXED.value:
                vis = VisibilityStatus.NOT_INDEXED.value
            return VerificationResult(
                status=vis,
                confidence=confidence,
                checked_at=now,
                method=self.name,
                evidence=f"Search Console coverageState={coverage}",
                googlebot_visited=googlebot,
                details=index,
            )
        return VerificationResult(
            status=VisibilityStatus.UNKNOWN.value,
            confidence=0.2,
            checked_at=now,
            method=self.name,
            evidence="Search Console returned no coverageState",
            googlebot_visited=googlebot,
            details=index,
        )


class CustomSearchStrategy(VerificationStrategy):
    """Google Programmable Search JSON API.

    A hit is moderate-confidence INDEXED. A miss is UNKNOWN — CSE is not the
    full Google index, so treating a miss as NOT_INDEXED would be a false
    negative presented as a fact.
    """

    name = "google_custom_search"

    def __init__(
        self,
        *,
        api_key: str = "",
        cx: str = "",
        daily_quota: int = GOOGLE_CSE_DAILY_QUOTA,
        fetch=None,
    ) -> None:
        self.api_key = api_key
        self.cx = cx
        self.daily_quota = daily_quota
        self._fetch = fetch

    async def verify(
        self, url: str, *, property_type: PropertyType
    ) -> Optional[VerificationResult]:
        if not self.api_key or not self.cx:
            return None
        now = datetime.now(timezone.utc)
        query = f"site:{url}"
        endpoint = (
            "https://www.googleapis.com/customsearch/v1"
            f"?key={quote(self.api_key)}&cx={quote(self.cx)}&q={quote(query)}&num=1"
        )
        if self._fetch is not None:
            code, body, error = await self._fetch(endpoint)
        else:
            code, body, error = await _get(endpoint)
        if error or code == 429:
            return VerificationResult(
                status=VisibilityStatus.UNKNOWN.value,
                confidence=0.0,
                checked_at=now,
                method=self.name,
                evidence=error or f"CSE quota/rate limited (HTTP {code}); daily quota {self.daily_quota}",
            )
        if code != 200:
            return VerificationResult(
                status=VisibilityStatus.UNKNOWN.value,
                confidence=0.0,
                checked_at=now,
                method=self.name,
                evidence=f"CSE HTTP {code}",
            )
        parsed = _json_obj(body)
        items = parsed.get("items") or []
        if items:
            link = str((items[0] or {}).get("link") or "")
            return VerificationResult(
                status=VisibilityStatus.INDEXED.value,
                confidence=0.72,
                checked_at=now,
                method=self.name,
                evidence=f"Custom Search returned the URL ({link or 'hit'}). CSE is not the full index.",
                details={"link": link},
            )
        return VerificationResult(
            status=VisibilityStatus.UNKNOWN.value,
            confidence=0.25,
            checked_at=now,
            method=self.name,
            evidence=(
                "Custom Search returned no hit. This is NOT proof of absence — "
                "CSE coverage is incomplete, so status stays UNKNOWN."
            ),
        )


class CrawlerEvidenceStrategy(VerificationStrategy):
    """Inbound-access evidence: verified Googlebot fetched our discovery page.

    Reads the ``discovery_access_logs`` table written by
    ``CrawlerEvidenceMiddleware``. Only rows whose ``verified_googlebot`` is
    true (reverse + forward DNS matched, per Google's documented method) count.
    Evidence is CRAWLED at best — a fetch is not an index. Never INDEXED.
    """

    name = "crawler_evidence"

    def __init__(self, session_factory=None) -> None:
        from app.database import AsyncSessionLocal

        self._session_factory = session_factory or AsyncSessionLocal

    async def verify(
        self, url: str, *, property_type: PropertyType
    ) -> Optional[VerificationResult]:
        from app.modules.indexing.engine.models import DiscoveryAccessLog
        from app.modules.indexing.indexer_dispatch import normalise_url, url_fingerprint

        if not settings.crawler_evidence_enabled:
            return None
        normalised = normalise_url(url) or (url or "").strip()
        fingerprint = url_fingerprint(normalised)
        try:
            async with self._session_factory() as session:
                row = (
                    await session.execute(
                        select(DiscoveryAccessLog)
                        .where(
                            DiscoveryAccessLog.url_hash == fingerprint,
                            DiscoveryAccessLog.verified_googlebot.is_(True),
                        )
                        .order_by(DiscoveryAccessLog.created_at.desc())
                        .limit(1)
                    )
                ).scalar_one_or_none()
        except Exception:
            # Failing open: evidence lookup must never break verification.
            return None
        if row is None:
            return None
        now = datetime.now(timezone.utc)
        hostname = row.googlebot_hostname or "unknown"
        return VerificationResult(
            status=VisibilityStatus.CRAWLED.value,
            confidence=0.85,
            checked_at=now,
            method=self.name,
            evidence=(
                f"Verified Googlebot (PTR + forward DNS hostname={hostname}) fetched "
                f"our discovery page ({row.requested_url}) at {row.created_at.isoformat()}. "
                "CRAWL evidence only — NOT indexed."
            ),
            googlebot_visited=True,
            crawler_user_agent=row.user_agent,
            requested_url=row.requested_url,
            verification_source=row.verification_source,
            details={
                "access_log_id": str(row.id),
                "user_agent": row.user_agent,
                "googlebot_hostname": hostname,
                "verification_source": row.verification_source,
                "requested_path": row.requested_path,
                "status_code": row.status_code,
            },
        )


class ManualVerificationStrategy(VerificationStrategy):
    name = "manual"

    def __init__(self, result: Optional[VerificationResult] = None) -> None:
        self.result = result

    async def verify(
        self, url: str, *, property_type: PropertyType
    ) -> Optional[VerificationResult]:
        return self.result


class IndexVerificationService:
    def __init__(self, strategies: Optional[Sequence[VerificationStrategy]] = None) -> None:
        self.strategies: List[VerificationStrategy] = list(strategies or [])

    async def verify(
        self,
        url: str,
        *,
        property_type: PropertyType,
        http_ok: bool = False,
        our_crawler_visited: bool = False,
        discovery_submitted: bool = False,
    ) -> VerificationResult:
        now = datetime.now(timezone.utc)
        # Hard guard against the fake pipeline the spec forbids.
        for strategy in self.strategies:
            result = await strategy.verify(url, property_type=property_type)
            if result is None:
                continue
            if result.status == VisibilityStatus.INDEXED.value and result.confidence < INDEXED_MIN_CONFIDENCE:
                result.status = VisibilityStatus.UNKNOWN.value
                result.evidence += (
                    f" (confidence {result.confidence:.2f} < {INDEXED_MIN_CONFIDENCE} — "
                    "a single weak signal is not INDEXED)"
                )
            return result
        reasons = []
        if http_ok:
            reasons.append("HTTP 200 only proves the page is reachable")
        if our_crawler_visited:
            reasons.append("OUR_CRAWLER_VISITED is not GOOGLEBOT_VISITED")
        if discovery_submitted:
            reasons.append("a discovery request is not an index confirmation")
        evidence = (
            "; ".join(reasons) + ". No verification strategy produced evidence."
            if reasons
            else "No verification strategy was configured or applicable."
        )
        return VerificationResult(
            status=VisibilityStatus.UNKNOWN.value,
            confidence=0.0,
            checked_at=now,
            method="none",
            evidence=evidence,
        )


def site_search_url(url: str) -> str:
    """Helper for operators — opens Google `site:` search. Not automated scraping."""
    return f"https://www.google.com/search?q=site:{quote(url)}"


def _json_obj(text: str) -> Dict[str, Any]:
    import json

    try:
        parsed = json.loads(text or "{}")
    except (ValueError, TypeError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


async def _get(url: str) -> tuple[Optional[int], str, Optional[str]]:
    try:
        import httpx
    except ImportError:
        return None, "", "httpx is not installed"
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(url)
            return response.status_code, response.text or "", None
    except Exception as exc:
        return None, "", f"{type(exc).__name__}: {exc}"


def _url_on_gsc_property(url: str, site_url: str) -> bool:
    from urllib.parse import urlparse

    host = (urlparse(url).hostname or "").lower()
    prop = (site_url or "").strip()
    if not host or not prop:
        return False
    if prop.startswith("sc-domain:"):
        domain = prop.split(":", 1)[1].strip().lower().lstrip(".")
        return bool(domain) and (host == domain or host.endswith(f".{domain}"))
    prop_host = (urlparse(prop).hostname or "").lower()
    if not prop_host:
        return False
    return host == prop_host or host.endswith(f".{prop_host}")

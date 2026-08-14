"""URL pre-validation: syntax, scheme, HTTP health, redirects, duplicates."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional
from urllib.parse import urlparse

from app.modules.indexing.engine.http_probe import (
    CLASS_DNS,
    CLASS_EMPTY,
    CLASS_INVALID,
    CLASS_INVALID_HTML,
    CLASS_SSL,
    CLASS_SSRF,
    CLASS_TIMEOUT,
    CLASS_410,
    HttpProbeResult,
    extract_canonical,
    probe_url,
)
from app.modules.indexing.indexer_dispatch import MAX_URL_LENGTH, normalise_url


@dataclass(slots=True)
class UrlValidationResult:
    ok: bool
    classification: str
    normalised_url: Optional[str]
    requested_url: str
    final_url: Optional[str] = None
    canonical_url: Optional[str] = None
    http_status: Optional[int] = None
    response_time_ms: int = 0
    content_type: Optional[str] = None
    content_length: Optional[int] = None
    redirect_chain: List[str] = field(default_factory=list)
    redirect_statuses: List[int] = field(default_factory=list)
    error: Optional[str] = None
    duplicate: bool = False
    probe: Optional[HttpProbeResult] = None

    @property
    def is_dead(self) -> bool:
        if not self.ok:
            return True
        if self.classification in {
            CLASS_DNS,
            CLASS_SSL,
            CLASS_TIMEOUT,
            CLASS_INVALID,
            CLASS_EMPTY,
            CLASS_INVALID_HTML,
            CLASS_410,
            CLASS_SSRF,
        }:
            return True
        if self.http_status is not None and self.http_status >= 400:
            return True
        return False


async def validate_url(
    raw: str,
    *,
    timeout: float = 15.0,
    max_redirects: int = 8,
    already_submitted: bool = False,
    probe: Optional[HttpProbeResult] = None,
    transport: Optional[object] = None,
) -> UrlValidationResult:
    normalised = normalise_url(raw)
    if normalised is None:
        parsed_ok = False
        try:
            parsed = urlparse((raw or "").strip())
            parsed_ok = bool(parsed.scheme and parsed.netloc)
        except ValueError:
            parsed_ok = False
        reason = "malformed URL"
        if (raw or "").strip() and not parsed_ok:
            scheme = urlparse((raw or "").strip()).scheme.lower()
            if scheme and scheme not in ("http", "https"):
                reason = "only HTTP/HTTPS URLs are accepted"
        elif len((raw or "").strip()) > MAX_URL_LENGTH:
            reason = "URL exceeds maximum length"
        return UrlValidationResult(
            ok=False,
            classification=CLASS_INVALID,
            normalised_url=None,
            requested_url=(raw or "").strip(),
            error=reason,
        )

    if already_submitted:
        return UrlValidationResult(
            ok=False,
            classification="duplicate",
            normalised_url=normalised,
            requested_url=raw,
            final_url=normalised,
            error="URL already submitted",
            duplicate=True,
        )

    probe_result = probe or await probe_url(
        normalised, timeout=timeout, max_redirects=max_redirects, transport=transport
    )
    canonical = None
    if probe_result.body:
        canonical = extract_canonical(probe_result.body, probe_result.final_url or normalised)

    ok = probe_result.ok
    error = probe_result.error
    if probe_result.http_status is not None and probe_result.http_status >= 400:
        ok = False
        error = error or f"HTTP {probe_result.http_status}"
    if probe_result.classification in {CLASS_EMPTY, CLASS_INVALID_HTML}:
        ok = False
        error = error or probe_result.classification

    return UrlValidationResult(
        ok=ok,
        classification=probe_result.classification,
        normalised_url=normalised,
        requested_url=raw,
        final_url=probe_result.final_url,
        canonical_url=canonical,
        http_status=probe_result.http_status,
        response_time_ms=probe_result.response_time_ms,
        content_type=probe_result.content_type,
        content_length=probe_result.content_length,
        redirect_chain=list(probe_result.redirect_chain),
        redirect_statuses=list(probe_result.redirect_statuses),
        error=error,
        probe=probe_result,
    )

"""Crawlability analysis. A high score is not an indexing guarantee."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

from app.modules.indexing.engine.http_probe import (
    OUR_CRAWLER_UA,
    CLASS_EMPTY,
    CLASS_INVALID_HTML,
    HttpProbeResult,
    classify_canonical,
    extract_all_canonicals,
    extract_canonical,
    extract_meta_robots,
    probe_url,
    robots_url_for,
)
from app.modules.indexing.engine.backlink_checker import extract_anchors
from app.modules.indexing.engine.states import crawlability_band


@dataclass(slots=True)
class CrawlabilityResult:
    score: int
    band: str
    robots_allowed: Optional[bool]
    meta_robots: Optional[str]
    x_robots_tag: Optional[str]
    canonical: Optional[str]
    noindex: bool
    nofollow: bool
    is_https: bool
    is_html: bool
    page_available: bool
    notes: Dict[str, Any] = field(default_factory=dict)
    canonical_status: str = "missing"

    @property
    def blocked_for_discovery(self) -> str | None:
        if self.noindex:
            return "NOINDEX"
        if self.robots_allowed is False:
            return "ROBOTS_BLOCKED"
        if not self.page_available:
            return "URL_UNREACHABLE"
        if self.notes.get("empty_response"):
            return "URL_UNREACHABLE"
        if self.notes.get("invalid_html"):
            return "URL_UNREACHABLE"
        return None


def _directives(value: Optional[str]) -> set[str]:
    if not value:
        return set()
    return {part.strip().lower() for part in value.split(",") if part.strip()}


def parse_robots_txt(text: str, url: str, user_agent: str = "*") -> Optional[bool]:
    parser = RobotFileParser()
    parser.set_url(robots_url_for(url))
    parser.parse((text or "").splitlines())
    try:
        return bool(parser.can_fetch(user_agent, url))
    except Exception:
        return None


async def analyse_crawlability(
    page_url: str,
    *,
    probe: Optional[HttpProbeResult] = None,
    timeout: float = 15.0,
    transport: Optional[object] = None,
    robots_body: Optional[str] = None,
) -> CrawlabilityResult:
    page = probe or await probe_url(page_url, timeout=timeout, transport=transport)
    html = page.body or ""
    meta = extract_meta_robots(html)
    x_robots = None
    if page.headers:
        lower = {str(k).lower(): v for k, v in page.headers.items()}
        x_robots = lower.get("x-robots-tag")
        if isinstance(x_robots, (list, tuple)):
            x_robots = ", ".join(str(v) for v in x_robots)
        elif x_robots is not None:
            x_robots = str(x_robots)

    directives = _directives(meta) | _directives(x_robots)
    noindex = "noindex" in directives or "none" in directives
    nofollow = "nofollow" in directives or "none" in directives
    canonicals = extract_all_canonicals(html, page.final_url or page_url)
    canonical = canonicals[0] if canonicals else extract_canonical(html, page.final_url or page_url)
    canonical_status = classify_canonical(page_url, canonicals, page.final_url)

    robots_allowed: Optional[bool] = None
    robots_note = None
    if robots_body is None:
        robots_probe = await probe_url(
            robots_url_for(page.final_url or page_url),
            timeout=timeout,
            transport=transport,
        )
        if robots_probe.ok and robots_probe.body:
            robots_body = robots_probe.body
        elif robots_probe.http_status == 404:
            robots_allowed = True
            robots_note = "no robots.txt (404) — treated as allowed"
        else:
            robots_note = robots_probe.error or f"robots.txt HTTP {robots_probe.http_status}"
    if robots_body is not None:
        robots_allowed = parse_robots_txt(robots_body, page.final_url or page_url, "*")
        googlebot_allowed = parse_robots_txt(robots_body, page.final_url or page_url, "Googlebot")
        if googlebot_allowed is False:
            robots_allowed = False
            robots_note = "Googlebot is disallowed by robots.txt"

    is_https = (urlparse(page.final_url or page_url).scheme or "").lower() == "https"
    is_html = page.is_html
    page_available = bool(page.ok)

    score = 0
    notes: Dict[str, Any] = {"user_agent": OUR_CRAWLER_UA}
    notes["outbound_link_count"] = len(extract_anchors(html, page.final_url or page_url))
    notes["content_length"] = len((html or "").strip())
    if robots_note:
        notes["robots"] = robots_note
    if page.classification == CLASS_EMPTY or not (page.body or "").strip():
        notes["empty_response"] = True
        page_available = False
    if page.classification == CLASS_INVALID_HTML:
        notes["invalid_html"] = True

    if page_available and page.http_status == 200:
        score += 25
    elif page_available:
        score += 10
    if is_https:
        score += 10
    if is_html:
        score += 15
    else:
        notes["html"] = "response is not HTML"
    if robots_allowed is True:
        score += 20
    elif robots_allowed is None:
        score += 8
        notes["robots_unknown"] = True
    if not noindex:
        score += 15
    else:
        notes["noindex"] = True
    if not nofollow:
        score += 5
    if canonical:
        notes["canonical"] = canonical
        notes["canonical_status"] = canonical_status
        notes["canonicals"] = canonicals
        if canonical_status == "self":
            score += 10
        elif canonical_status == "CANONICAL_MISMATCH":
            score += 3
            notes["canonical_differs"] = True
        elif canonical_status == "multiple":
            score += 2
            notes["multiple_canonical"] = True
        else:
            score += 3
    else:
        notes["canonical_status"] = canonical_status
        score += 5
    if page.redirect_chain:
        score = max(0, score - min(10, 2 * len(page.redirect_chain)))
        notes["redirects"] = page.redirect_chain
        notes["redirect_statuses"] = getattr(page, "redirect_statuses", [])
        notes["original_url"] = page_url
        notes["final_url"] = page.final_url

    if canonical_status == "CANONICAL_MISMATCH" and canonical:
        canon_probe = await probe_url(canonical, timeout=timeout, transport=transport)
        notes["canonical_http_status"] = canon_probe.http_status
        notes["canonical_reachable"] = bool(canon_probe.ok)
        if not canon_probe.ok:
            notes["canonical_dead"] = True
            notes["canonical_error"] = canon_probe.error or f"HTTP {canon_probe.http_status}"

    score = max(0, min(100, score))
    return CrawlabilityResult(
        score=score,
        band=crawlability_band(score),
        robots_allowed=robots_allowed,
        meta_robots=meta,
        x_robots_tag=x_robots,
        canonical=canonical,
        noindex=noindex,
        nofollow=nofollow,
        is_https=is_https,
        is_html=is_html,
        page_available=page_available,
        notes=notes,
        canonical_status=canonical_status,
    )

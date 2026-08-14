"""Verify that a source page actually contains a backlink to the target URL."""
from __future__ import annotations

from dataclasses import dataclass, field
from html.parser import HTMLParser
from typing import List, Optional
from urllib.parse import parse_qsl, urljoin, urlparse, urlunparse

from app.modules.indexing.engine.http_probe import HttpProbeResult, probe_url
from app.modules.indexing.indexer_dispatch import normalise_url


@dataclass(slots=True)
class FoundLink:
    href: str
    resolved: str
    anchor_text: str
    rel: List[str]
    surrounding_text: str
    match_type: str


@dataclass(slots=True)
class BacklinkCheckResult:
    backlink_found: bool
    href: Optional[str] = None
    resolved_href: Optional[str] = None
    anchor_text: Optional[str] = None
    surrounding_text: Optional[str] = None
    rel_attributes: Optional[str] = None
    match_type: Optional[str] = None
    links: List[FoundLink] = field(default_factory=list)
    error: Optional[str] = None

    @property
    def status(self) -> str:
        return "BACKLINK_VERIFIED" if self.backlink_found else "BACKLINK_NOT_FOUND"


def _strip_tracking(url: str) -> str:
    parsed = urlparse(url)
    query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in {"fbclid", "gclid", "ref"}
    ]
    return urlunparse(
        (
            parsed.scheme.lower(),
            (parsed.hostname or "").lower()
            + (f":{parsed.port}" if parsed.port else ""),
            parsed.path.rstrip("/") or "/",
            "",
            "&".join(f"{k}={v}" for k, v in query),
            "",
        )
    )


def normalise_href(href: str, base: str) -> Optional[str]:
    if not href or href.startswith(("javascript:", "mailto:", "tel:", "#")):
        return None
    absolute = urljoin(base, href.strip())
    return normalise_url(absolute) or absolute


def urls_equivalent(a: str, b: str) -> bool:
    na = normalise_url(a) or a
    nb = normalise_url(b) or b
    return _fingerprint(na) == _fingerprint(nb)


def _fingerprint(url: str) -> str:
    """Scheme-agnostic comparison: ignore fragment, trailing slash, tracking params, www."""
    stripped = _strip_tracking(url)
    parsed = urlparse(stripped)
    host = (parsed.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    path = parsed.path.rstrip("/") or "/"
    return f"{host}{path}?{parsed.query}"


class _AnchorParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.anchors: List[dict] = []
        self._current: Optional[dict] = None
        self._text_chunks: List[str] = []
        self._all_text: List[str] = []

    def handle_starttag(self, tag: str, attrs: List[tuple[str, Optional[str]]]) -> None:
        if tag != "a":
            return
        attr = {k.lower(): (v or "") for k, v in attrs}
        self._current = {
            "href": attr.get("href", ""),
            "rel": [p for p in attr.get("rel", "").split() if p],
        }
        self._text_chunks = []

    def handle_data(self, data: str) -> None:
        text = " ".join(data.split())
        if not text:
            return
        self._all_text.append(text)
        if self._current is not None:
            self._text_chunks.append(text)

    def handle_endtag(self, tag: str) -> None:
        if tag != "a" or self._current is None:
            return
        href = self._current["href"]
        resolved = normalise_href(href, self.base_url)
        if resolved:
            surrounding = " ".join(self._all_text[-6:])
            self.anchors.append(
                {
                    "href": href,
                    "resolved": resolved,
                    "rel": list(self._current["rel"]),
                    "anchor_text": " ".join(self._text_chunks).strip(),
                    "surrounding_text": surrounding[:500],
                }
            )
        self._current = None
        self._text_chunks = []


def extract_anchors(html: str, base_url: str) -> List[dict]:
    parser = _AnchorParser(base_url)
    try:
        parser.feed(html or "")
        parser.close()
    except Exception:
        pass
    return parser.anchors


def classify_match(href: str, resolved: str, target: str, target_final: Optional[str]) -> Optional[str]:
    target_norm = normalise_url(target) or target
    if href.strip() == target.strip():
        return "exact"
    if urls_equivalent(resolved, target_norm):
        return "normalized"
    if target_final and urls_equivalent(resolved, target_final):
        return "redirect"
    # Prefix match: target home page linked as origin, or vice versa.
    if urls_equivalent(resolved.rstrip("/"), target_norm.rstrip("/")):
        return "normalized"
    return None


def inspect_html(
    html: str,
    *,
    source_url: str,
    target_url: str,
    target_final: Optional[str] = None,
) -> BacklinkCheckResult:
    anchors = extract_anchors(html, source_url)
    matches: List[FoundLink] = []
    for item in anchors:
        match = classify_match(item["href"], item["resolved"], target_url, target_final)
        if not match:
            continue
        matches.append(
            FoundLink(
                href=item["href"],
                resolved=item["resolved"],
                anchor_text=item["anchor_text"],
                rel=item["rel"],
                surrounding_text=item["surrounding_text"],
                match_type=match,
            )
        )
    if not matches:
        return BacklinkCheckResult(backlink_found=False, error="target URL not found in page anchors")
    best = matches[0]
    rel = " ".join(best.rel) if best.rel else None
    return BacklinkCheckResult(
        backlink_found=True,
        href=best.href,
        resolved_href=best.resolved,
        anchor_text=best.anchor_text or None,
        surrounding_text=best.surrounding_text or None,
        rel_attributes=rel,
        match_type=best.match_type,
        links=matches,
    )


async def check_backlink(
    source_url: str,
    target_url: str,
    *,
    probe: Optional[HttpProbeResult] = None,
    target_final: Optional[str] = None,
    timeout: float = 15.0,
    transport: Optional[object] = None,
) -> BacklinkCheckResult:
    page = probe or await probe_url(source_url, timeout=timeout, transport=transport)
    if not page.ok or not page.body:
        return BacklinkCheckResult(
            backlink_found=False,
            error=page.error or f"source page unreachable (HTTP {page.http_status})",
        )
    return inspect_html(
        page.body,
        source_url=page.final_url or source_url,
        target_url=target_url,
        target_final=target_final,
    )

"""Optional second-stage backlink scan for JS-embedded URLs.

Static HTML parsing remains the default. This scanner looks at JSON-LD and
quoted http(s) URLs inside <script> tags. It is not a browser and does not
execute JavaScript. Playwright rendering is never required.
"""
from __future__ import annotations

import json
import re
from typing import Iterable, List

from app.modules.indexing.engine.backlink_checker import (
    BacklinkCheckResult,
    FoundLink,
    urls_equivalent,
)

_URL_IN_SCRIPT = re.compile(r"https?://[^\s\"'<>\\]+", re.IGNORECASE)
_SCRIPT = re.compile(r"<script\b([^>]*)>(.*?)</script>", re.IGNORECASE | re.DOTALL)
_DATA_HREF = re.compile(r"""data-(?:href|url)\s*=\s*["']([^"']+)["']""", re.IGNORECASE)


def _walk_json(value, found: List[str]) -> None:
    if isinstance(value, str) and value.startswith(("http://", "https://")):
        found.append(value)
    elif isinstance(value, dict):
        for item in value.values():
            _walk_json(item, found)
    elif isinstance(value, list):
        for item in value:
            _walk_json(item, found)


def extract_js_candidate_urls(html: str) -> List[str]:
    urls: List[str] = []
    for match in _SCRIPT.finditer(html or ""):
        attrs = match.group(1) or ""
        body = match.group(2) or ""
        if "ld+json" in attrs.lower():
            try:
                parsed = json.loads(body)
            except (ValueError, TypeError):
                parsed = None
            if parsed is not None:
                _walk_json(parsed, urls)
                continue
        urls.extend(_URL_IN_SCRIPT.findall(body))
    urls.extend(_DATA_HREF.findall(html or ""))
    # De-dupe while preserving order.
    seen = set()
    out = []
    for url in urls:
        cleaned = url.rstrip(").,;")
        if cleaned not in seen:
            seen.add(cleaned)
            out.append(cleaned)
    return out


def inspect_js_backlink(
    html: str,
    *,
    target_url: str,
    target_final: str | None = None,
) -> BacklinkCheckResult:
    matches: List[FoundLink] = []
    for candidate in extract_js_candidate_urls(html):
        if urls_equivalent(candidate, target_url) or (
            target_final and urls_equivalent(candidate, target_final)
        ):
            matches.append(
                FoundLink(
                    href=candidate,
                    resolved=candidate,
                    anchor_text="",
                    rel=[],
                    surrounding_text="js/json-ld candidate",
                    match_type="JS_BACKLINK_FOUND",
                )
            )
    if not matches:
        return BacklinkCheckResult(
            backlink_found=False,
            error="target URL not found in JSON-LD or script string literals",
            match_type=None,
        )
    best = matches[0]
    return BacklinkCheckResult(
        backlink_found=True,
        href=best.href,
        resolved_href=best.resolved,
        match_type="JS_BACKLINK_FOUND",
        links=matches,
    )


def merge_static_and_js(
    static: BacklinkCheckResult, js: BacklinkCheckResult
) -> BacklinkCheckResult:
    """Keep STATIC and JS findings distinct. Static wins for publishing."""
    if static.backlink_found:
        static.match_type = static.match_type or "STATIC_BACKLINK_FOUND"
        if static.match_type in {"exact", "normalized", "redirect"}:
            static.match_type = f"STATIC_BACKLINK_FOUND:{static.match_type}"
        return static
    if js.backlink_found:
        return js
    return static


__all__ = [
    "extract_js_candidate_urls",
    "inspect_js_backlink",
    "merge_static_and_js",
]

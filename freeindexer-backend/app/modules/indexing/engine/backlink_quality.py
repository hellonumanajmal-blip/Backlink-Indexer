"""Backlink quality scoring.

Quality Score is a readiness heuristic for our discovery workflow. It is not a
predicted Google ranking and is never treated as an indexing probability.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from app.modules.indexing.engine.quality import looks_like_spam


@dataclass(slots=True)
class QualityInput:
    http_ok: bool = False
    http_status: Optional[int] = None
    is_html: bool = False
    backlink_found: Optional[bool] = None
    rel_attributes: Optional[str] = None
    surrounding_text: Optional[str] = None
    target_url: Optional[str] = None
    canonical_status: str = "missing"
    robots_allowed: Optional[bool] = None
    noindex: bool = False
    page_available: bool = True
    outbound_link_count: int = 0
    content_length: int = 0
    submitted_at: Optional[datetime] = None
    source_url: str = ""
    duplicate: bool = False
    is_https: bool = False


@dataclass(slots=True)
class QualityResult:
    score: int
    factors: Dict[str, int] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    recommendation: str = ""

    def as_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "factors": self.factors,
            "warnings": self.warnings,
            "recommendation": self.recommendation,
            "meaning": (
                "Backlink quality / discovery readiness — not a Google indexing probability"
            ),
        }


class BacklinkQualityEngine:
    """Score a backlink using observable page signals only."""

    def score(self, inp: QualityInput) -> QualityResult:
        factors: Dict[str, int] = {}
        warnings: List[str] = []

        if inp.http_ok and inp.http_status == 200:
            factors["http_200"] = 15
        elif inp.http_status and inp.http_status >= 400:
            factors["dead_page"] = -40
            warnings.append("dead page")
        else:
            factors["http_200"] = 0
            warnings.append("HTTP not 200")

        factors["html_page"] = 10 if inp.is_html else 0
        if not inp.is_html:
            warnings.append("response is not HTML")

        if inp.backlink_found is True:
            factors["backlink_found"] = 15
        elif inp.backlink_found is False:
            factors["backlink_found"] = 0
            warnings.append("backlink not found")
        else:
            factors["backlink_found"] = 6

        rel = (inp.rel_attributes or "").lower().split()
        if inp.backlink_found is True:
            if "nofollow" in rel or "ugc" in rel:
                factors["dofollow"] = 2
                warnings.append("link is nofollow/ugc")
            else:
                factors["dofollow"] = 10

        if inp.backlink_found is True and inp.target_url and inp.surrounding_text:
            host = (urlparse(inp.target_url).hostname or "").lower().removeprefix("www.")
            if host and host.split(".")[0] in (inp.surrounding_text or "").lower():
                factors["relevant_content"] = 8
            else:
                factors["relevant_content"] = 3
        else:
            factors["relevant_content"] = 0

        if inp.canonical_status == "self":
            factors["canonical_valid"] = 8
        elif inp.canonical_status == "CANONICAL_MISMATCH":
            factors["canonical_valid"] = 1
            warnings.append("CANONICAL_MISMATCH — source may not be the indexed URL")
        elif inp.canonical_status == "multiple":
            factors["canonical_valid"] = 2
            warnings.append("multiple canonical tags")
        else:
            factors["canonical_valid"] = 4

        crawlable = inp.page_available and not inp.noindex and inp.robots_allowed is not False
        if inp.noindex:
            factors["crawlable"] = -40
            warnings.append("noindex")
        elif inp.robots_allowed is False:
            factors["crawlable"] = -40
            warnings.append("robots blocked")
        elif crawlable:
            factors["crawlable"] = 12
        else:
            factors["crawlable"] = 4

        if inp.content_length < 50:
            factors["empty_content"] = -20
            warnings.append("empty content")
        else:
            factors["empty_content"] = 0

        if inp.outbound_link_count > 100:
            factors["outbound_ratio"] = -10
            warnings.append("excessive outbound links")
        elif inp.outbound_link_count <= 40:
            factors["outbound_ratio"] = 8
        else:
            factors["outbound_ratio"] = 3

        spam = looks_like_spam(inp.source_url) if inp.source_url else None
        if spam:
            factors["spam"] = -20
            warnings.append(spam)
        else:
            factors["spam"] = 0

        if inp.duplicate:
            factors["duplicate"] = -10
            warnings.append("duplicate URL")

        fresh = False
        if inp.submitted_at:
            submitted = inp.submitted_at
            if submitted.tzinfo is None:
                submitted = submitted.replace(tzinfo=timezone.utc)
            fresh = datetime.now(timezone.utc) - submitted <= timedelta(days=7)
        factors["fresh_content"] = 6 if fresh else 2

        if inp.is_https and not spam:
            factors["domain_signals"] = 8
        elif inp.is_https:
            factors["domain_signals"] = 3
        else:
            factors["domain_signals"] = 0

        score = max(0, min(100, sum(factors.values())))
        recommendation = _recommendation(score, warnings)
        return QualityResult(
            score=score, factors=factors, warnings=warnings, recommendation=recommendation
        )


def _recommendation(score: int, warnings: List[str]) -> str:
    if "noindex" in warnings or "robots blocked" in warnings or "dead page" in warnings:
        return "Do not publish. Google cannot usefully crawl this URL."
    if "backlink not found" in warnings:
        return "Fix the source page so the target href exists in static HTML before discovery."
    if score >= 70:
        return "High-quality candidate for public discovery. Still not a guarantee of indexing."
    if score >= 40:
        return "Acceptable candidate. Publish only if crawlable and the backlink is present."
    return "Weak signals. Prefer not to list on the public hub until quality improves."


def source_domain(url: str) -> str:
    host = (urlparse(url).hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    return host


__all__ = [
    "BacklinkQualityEngine",
    "QualityInput",
    "QualityResult",
    "source_domain",
]

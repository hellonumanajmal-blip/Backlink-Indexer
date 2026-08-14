"""Priority scoring. High-priority jobs are processed first.

Score is a discovery-readiness heuristic, not a predicted Google ranking.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.modules.indexing.engine.states import PriorityBand


@dataclass(slots=True)
class PriorityInput:
    crawlability_score: int = 0
    http_ok: bool = False
    backlink_found: Optional[bool] = None
    is_html: bool = False
    is_https: bool = False
    our_crawler_visited: bool = False
    googlebot_visited: bool = False
    previous_discovery_accepted: bool = False
    attempt_count: int = 0
    quality_score: int = 0
    domain_success_boost: int = 0
    fresh: bool = True


def band_for(score: int) -> PriorityBand:
    if score >= 70:
        return PriorityBand.HIGH
    if score >= 40:
        return PriorityBand.MEDIUM
    return PriorityBand.LOW


def compute_priority(inp: PriorityInput) -> tuple[int, PriorityBand]:
    score = 0
    score += max(0, min(25, int(inp.quality_score * 0.25))) if inp.quality_score else max(
        0, min(30, int(inp.crawlability_score * 0.3))
    )
    if inp.http_ok:
        score += 18
    if inp.backlink_found is True:
        score += 18
    elif inp.backlink_found is False:
        score += 0
    else:
        score += 8
    if inp.is_html:
        score += 6
    if inp.is_https:
        score += 6
    if inp.fresh:
        score += 8
    if inp.googlebot_visited:
        score += 8
    elif inp.our_crawler_visited:
        score += 3
    if inp.previous_discovery_accepted:
        score += 4
    score += max(0, min(10, inp.domain_success_boost))
    score -= min(10, inp.attempt_count * 2)
    score = max(0, min(100, score))
    return score, band_for(score)

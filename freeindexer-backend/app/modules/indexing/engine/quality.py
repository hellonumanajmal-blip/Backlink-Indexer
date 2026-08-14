"""Quality gates and DiscoveryScore.

DiscoveryScore is the readiness of *our* discovery workflow, not the probability
that Google will index the URL.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse

from app.modules.indexing.engine.states import PipelineStatus

SPAM_TLDS = {".xyz", ".top", ".click", ".gq", ".tk", ".ml", ".ga", ".cf", ".zip", ".mov"}
PRIVATE_PROJECT_MARKERS = ("private", "opt-out", "optout", "internal")
FEED_EXCLUDE = {
    PipelineStatus.INVALID_URL.value,
    PipelineStatus.URL_UNREACHABLE.value,
    PipelineStatus.ROBOTS_BLOCKED.value,
    PipelineStatus.NOINDEX.value,
    PipelineStatus.BACKLINK_NOT_FOUND.value,
    PipelineStatus.BACKLINK_REMOVED.value,
}


@dataclass(slots=True)
class DiscoveryScore:
    score: int
    components: Dict[str, int] = field(default_factory=dict)
    notes: List[str] = field(default_factory=list)

    def as_dict(self) -> Dict[str, Any]:
        return {
            "score": self.score,
            "components": self.components,
            "notes": self.notes,
            "meaning": "Quality/readiness of our discovery workflow — not an indexing probability",
        }


def looks_like_spam(url: str) -> Optional[str]:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if not host:
        return "missing host"
    if len(url) > 1500:
        return "URL exceeds quality length cap"
    try:
        import ipaddress

        ipaddress.ip_address(host.strip("[]"))
        return "raw IP hostnames are not listed on the public hub"
    except ValueError:
        pass
    if host.count("-") >= 6:
        return "hostname looks generated"
    q = parse_qs(parsed.query)
    if len(q) > 8:
        return "excessive query parameters"
    for tld in SPAM_TLDS:
        if host.endswith(tld) and host.count(".") >= 3:
            return f"low-trust multi-subdomain TLD {tld}"
    return None


def project_is_private(project: Optional[str]) -> bool:
    name = (project or "").strip().lower()
    return any(marker in name for marker in PRIVATE_PROJECT_MARKERS)


def job_is_feed_eligible(job) -> bool:
    """Only qualifying URLs enter the public discovery feed/hub."""
    if project_is_private(getattr(job, "project", None)):
        return False
    if getattr(job, "public_listed", True) is False:
        return False
    status = getattr(job, "pipeline_status", "")
    if status in FEED_EXCLUDE:
        return False
    if getattr(job, "http_status", None) not in (200, None) and (
        getattr(job, "http_status", 0) or 0
    ) >= 400:
        return False
    if getattr(job, "http_status", None) == 200 or getattr(job, "http_class", None) == "200_OK":
        pass
    elif getattr(job, "http_status", None) not in (None, 200):
        return False
    target = getattr(job, "target_url", None)
    if target and getattr(job, "backlink_found", None) is not True:
        return False
    spam = looks_like_spam(getattr(job, "source_url", "") or "")
    if spam:
        return False
    quality = getattr(job, "quality_score", None)
    if quality is not None and quality < 40:
        return False
    return True


def compute_discovery_score(
    *,
    http_ok: bool,
    backlink_found: Optional[bool],
    robots_allowed: Optional[bool],
    noindex: bool,
    canonical_status: str,
    feed_published: bool,
    submitted_at: Optional[datetime],
    googlebot_visited: bool = False,
) -> DiscoveryScore:
    components: Dict[str, int] = {}
    notes: List[str] = [
        "DiscoveryScore describes workflow readiness, not Google indexing chance"
    ]
    components["http_healthy"] = 25 if http_ok else 0
    if backlink_found is True:
        components["backlink_verified"] = 20
    elif backlink_found is False:
        components["backlink_verified"] = 0
        notes.append("No static backlink — not listed on the public hub")
    else:
        components["backlink_verified"] = 10
        notes.append("No target URL — backlink check skipped")
    if noindex:
        components["crawlable"] = 0
        notes.append("noindex pages are never published")
    elif robots_allowed is False:
        components["crawlable"] = 0
    elif robots_allowed is True:
        components["crawlable"] = 20
    else:
        components["crawlable"] = 10
    if canonical_status == "self":
        components["canonical"] = 10
    elif canonical_status == "missing":
        components["canonical"] = 6
    elif canonical_status == "CANONICAL_MISMATCH":
        components["canonical"] = 2
        notes.append("CANONICAL_MISMATCH — source URL may not be the indexed URL")
    else:
        components["canonical"] = 4
    components["feed_published"] = 15 if feed_published else 0
    fresh = False
    if submitted_at:
        now = datetime.now(timezone.utc)
        submitted = submitted_at if submitted_at.tzinfo else submitted_at.replace(tzinfo=timezone.utc)
        fresh = now - submitted <= timedelta(days=7)
    components["feed_freshness"] = 10 if fresh else 4
    if googlebot_visited:
        components["previous_crawl_evidence"] = 10
        notes.append("GOOGLEBOT_VISITED is from verification evidence, not our crawler")
    else:
        components["previous_crawl_evidence"] = 0
    score = max(0, min(100, sum(components.values())))
    return DiscoveryScore(score=score, components=components, notes=notes)


def assign_experiment_group(url_hash: str) -> str:
    """Stable A/B/C/D assignment from the URL fingerprint (hash % 4).

    A = Control (monitor only, no discovery signal)
    B = Public Hub (HTML + RSS + Atom + JSON inventory)
    C = Public Hub + WebSub
    D = All legitimate third-party signals (hub + WebSub; owner-only stays off)
    """
    if not url_hash:
        return "B"
    bucket = int(url_hash[:8], 16) % 4
    return ("A", "B", "C", "D")[bucket]


__all__ = [
    "DiscoveryScore",
    "assign_experiment_group",
    "compute_discovery_score",
    "job_is_feed_eligible",
    "looks_like_spam",
    "project_is_private",
]

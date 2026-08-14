"""Empirical indexing experiment metrics.

Only jobs with experiment_started_at are in the study. BASELINE_ALREADY_INDEXED
URLs are excluded from index-rate denominators. No fabricated rates.
"""
from __future__ import annotations

import csv
import io
import math
from datetime import datetime, timezone
from statistics import median
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from app.modules.indexing.engine.experiments import GROUP_LABELS
from app.modules.indexing.engine.states import PipelineStatus, VisibilityStatus

MIN_N = 30
PREFERRED_N = 100
CUMULATIVE_DAYS = (0, 1, 3, 7, 14)

PAID_INDEXER_CLAIMS = [
    {
        "name": "SpeedyIndex",
        "marketing_claim": "Public materials advertise multi-day crawl cycles and later index reports (not independently measured here).",
    },
    {
        "name": "IndexBolt",
        "marketing_claim": "Public materials advertise indexing campaigns with later status checks (not independently measured here).",
    },
    {
        "name": "Omega Indexer",
        "marketing_claim": "Public materials advertise URL submission + reporting (not independently measured here).",
    },
    {
        "name": "Rapid URL Indexer",
        "marketing_claim": "Public materials advertise day-4 / day-14 reports and limited retries (not independently measured here).",
    },
    {
        "name": "Indexceptional",
        "marketing_claim": "Public materials advertise indexing packages with success-rate marketing (not independently measured here).",
    },
    {
        "name": "IndexMeNow",
        "marketing_claim": "Public materials advertise frequent index checks (not independently measured here).",
    },
]

SECRET_KEYS = ("token", "secret", "password", "authorization", "api_key", "apikey", "gsc_access")


def rel_type_from_rel(rel: Optional[str]) -> str:
    tokens = set((rel or "").lower().split())
    if "sponsored" in tokens:
        return "sponsored"
    if "ugc" in tokens:
        return "ugc"
    if "nofollow" in tokens:
        return "nofollow"
    return "dofollow"


def quality_band(score: Optional[int]) -> str:
    if score is None:
        return "unknown"
    if score >= 80:
        return "high"
    if score >= 60:
        return "medium"
    if score >= 40:
        return "low"
    return "low"


def experiment_channel_names(group: str) -> Tuple[str, ...]:
    if group == "A":
        return ()
    if group == "B":
        return ("public_hub",)
    return ("public_hub", "websub")


def _seconds(start: Optional[datetime], end: Optional[datetime]) -> Optional[float]:
    if not start or not end:
        return None
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)
    return (end - start).total_seconds()


def _median(values: Sequence[float]) -> Optional[float]:
    if not values:
        return None
    return float(median(values))


def _mean(values: Sequence[float]) -> Optional[float]:
    if not values:
        return None
    return round(sum(values) / len(values), 4)


def wilson_interval(successes: int, n: int, z: float = 1.96) -> Optional[Tuple[float, float]]:
    if n <= 0:
        return None
    p = successes / n
    z2 = z * z
    denom = 1 + z2 / n
    center = (p + z2 / (2 * n)) / denom
    margin = z * math.sqrt((p * (1 - p) / n) + z2 / (4 * n * n)) / denom
    return round(max(0.0, center - margin), 4), round(min(1.0, center + margin), 4)


def two_proportion_p(s1: int, n1: int, s2: int, n2: int) -> Optional[float]:
    """Two-sided p-value for H0: p1 == p2. None if undefined."""
    if n1 <= 0 or n2 <= 0:
        return None
    p1, p2 = s1 / n1, s2 / n2
    pooled = (s1 + s2) / (n1 + n2)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2))
    if se == 0:
        return 1.0 if abs(p1 - p2) < 1e-12 else 0.0
    z = abs(p2 - p1) / se
    return round(math.erfc(z / math.sqrt(2.0)), 6)


def _in_study(job) -> bool:
    return getattr(job, "experiment_started_at", None) is not None


def _eligible(job) -> bool:
    return bool(getattr(job, "experiment_eligible", False)) and _in_study(job)


def _indexed(job) -> bool:
    return getattr(job, "visibility_status", "") == VisibilityStatus.INDEXED.value


def _not_indexed(job) -> bool:
    return getattr(job, "visibility_status", "") == VisibilityStatus.NOT_INDEXED.value


def _failed(job) -> bool:
    return getattr(job, "pipeline_status", "") in {
        PipelineStatus.INVALID_URL.value,
        PipelineStatus.URL_UNREACHABLE.value,
        PipelineStatus.BACKLINK_NOT_FOUND.value,
        PipelineStatus.ROBOTS_BLOCKED.value,
        PipelineStatus.NOINDEX.value,
        PipelineStatus.DISCOVERY_FAILED.value,
        PipelineStatus.TIMEOUT.value,
    }


def _crawl_evidence(job) -> bool:
    return bool(getattr(job, "googlebot_visited", False)) or getattr(job, "visibility_status", "") == VisibilityStatus.CRAWLED.value


def _days(seconds: Optional[float]) -> Optional[float]:
    if seconds is None:
        return None
    return round(seconds / 86400.0, 3)


def _group_metrics(jobs: List[Any]) -> Dict[str, Any]:
    eligible = [j for j in jobs if _eligible(j)]
    n = len(eligible)
    indexed = [j for j in eligible if _indexed(j)]
    not_indexed = [j for j in eligible if _not_indexed(j)]
    unknown = [
        j
        for j in eligible
        if not _indexed(j) and not _not_indexed(j) and not _failed(j)
    ]
    failed = [j for j in eligible if _failed(j)]
    crawled = [j for j in eligible if _crawl_evidence(j)]
    listed = [j for j in eligible if getattr(j, "public_listed", False)]
    discovered = [
        j
        for j in eligible
        if getattr(j, "visibility_status", "") == VisibilityStatus.DISCOVERED.value
    ]
    times = [
        t
        for j in indexed
        if (t := _seconds(j.experiment_started_at, j.indexed_at)) is not None
    ]
    ci = wilson_interval(len(indexed), n) if n else None
    return {
        "eligible": n,
        "indexed": len(indexed),
        "not_indexed": len(not_indexed),
        "unknown": len(unknown),
        "failed": len(failed),
        "crawl_evidence": len(crawled),
        "discovery_signal_accepted": len(listed),
        "target_url_discovered": len(discovered),
        "target_url_crawled": len(crawled),
        "target_url_indexed": len(indexed),
        "verified_index_rate": round((len(indexed) / n), 4) if n else None,
        "crawl_evidence_rate": round((len(crawled) / n), 4) if n else None,
        "unknown_rate": round((len(unknown) / n), 4) if n else None,
        "failure_rate": round((len(failed) / n), 4) if n else None,
        "median_time_to_index_days": _days(_median(times)),
        "average_time_to_index_days": _days(_mean(times)),
        "wilson_ci_95": {"low": ci[0], "high": ci[1]} if ci else None,
        "sample_status": "OK" if n >= MIN_N else "INSUFFICIENT_DATA",
        "n_preferred": n >= PREFERRED_N,
    }


def _cumulative_curve(jobs: Iterable[Any]) -> List[Dict[str, Any]]:
    eligible = [j for j in jobs if _eligible(j)]
    n = len(eligible)
    rows = []
    for day in CUMULATIVE_DAYS:
        count = 0
        for job in eligible:
            delta = _seconds(job.experiment_started_at, job.indexed_at)
            if delta is not None and delta <= day * 86400 and _indexed(job):
                count += 1
        rows.append(
            {
                "day": day,
                "indexed": count,
                "eligible": n,
                "verified_index_rate": round(count / n, 4) if n else None,
            }
        )
    return rows


def _breakdown(jobs: Iterable[Any], attr: str) -> Dict[str, Any]:
    buckets: Dict[str, List[Any]] = {}
    for job in jobs:
        if not _eligible(job):
            continue
        key = str(getattr(job, attr, None) or "unknown")
        buckets.setdefault(key, []).append(job)
    out: Dict[str, Any] = {}
    for key, group in sorted(buckets.items()):
        n = len(group)
        indexed = sum(1 for j in group if _indexed(j))
        times = [
            t
            for j in group
            if _indexed(j) and (t := _seconds(j.experiment_started_at, j.indexed_at)) is not None
        ]
        out[key] = {
            "eligible": n,
            "indexed": indexed,
            "verified_index_rate": round(indexed / n, 4) if n else None,
            "median_days": _days(_median(times)),
            "sample_status": "OK" if n >= MIN_N else "INSUFFICIENT_DATA",
        }
    return out


def _priority_efficiency(jobs: Iterable[Any]) -> Dict[str, Any]:
    buckets: Dict[str, List[Any]] = {}
    for job in jobs:
        if not _in_study(job):
            continue
        band = str(getattr(job, "priority_band", None) or "unknown")
        buckets.setdefault(band, []).append(job)
    out: Dict[str, Any] = {}
    for band, group in buckets.items():
        disc = [t for j in group if (t := _seconds(j.experiment_started_at, j.discovery_completed_at)) is not None]
        wait = [t for j in group if (t := _seconds(j.experiment_started_at, j.discovery_started_at)) is not None]
        ver = [t for j in group if (t := _seconds(j.experiment_started_at, j.last_checked_at)) is not None]
        out[band] = {
            "n": len(group),
            "median_time_to_discovery_seconds": _median(disc),
            "median_queue_wait_seconds": _median(wait),
            "median_verification_time_seconds": _median(ver),
            "note": "Priority orders our queue. It does not control Google.",
        }
    return out


def _retry_value(jobs: Iterable[Any]) -> Dict[str, Any]:
    eligible = [j for j in jobs if _eligible(j)]
    before = sum(1 for j in eligible if _indexed(j) and getattr(j, "indexed_before_retry", None) is True)
    after = sum(1 for j in eligible if _indexed(j) and getattr(j, "indexed_before_retry", None) is False)
    never = sum(1 for j in eligible if _indexed(j) and getattr(j, "indexed_before_retry", None) is None and (getattr(j, "attempt_count", 0) or 0) <= 1)
    return {
        "indexed_before_retry": before + never,
        "indexed_after_retry": after,
        "eligible": len(eligible),
        "note": "Retry value is measured only when INDEXED evidence exists. Discovery retries are not indexing.",
    }


def _verdict(groups: Dict[str, Any]) -> Dict[str, Any]:
    control = groups["A"]
    treated_n = sum(groups[g]["eligible"] for g in ("B", "C", "D"))
    treated_indexed = sum(groups[g]["indexed"] for g in ("B", "C", "D"))
    n_a, i_a = control["eligible"], control["indexed"]
    pairwise = {}
    for key in ("B", "C", "D"):
        row = groups[key]
        pairwise[key] = {
            "p_value": two_proportion_p(i_a, n_a, row["indexed"], row["eligible"]),
            "sample_status": "OK"
            if n_a >= MIN_N and row["eligible"] >= MIN_N
            else "INSUFFICIENT_DATA",
        }

    if n_a < MIN_N or any(groups[g]["eligible"] < MIN_N for g in ("B", "C", "D")):
        answer = "INCONCLUSIVE"
        reason = (
            f"Need at least {MIN_N} eligible URLs per group "
            f"(preferred {PREFERRED_N}). Control n={n_a}, "
            f"B={groups['B']['eligible']}, C={groups['C']['eligible']}, D={groups['D']['eligible']}."
        )
    elif n_a + treated_n == 0:
        answer = "INCONCLUSIVE"
        reason = "No eligible experiment URLs."
    else:
        p = two_proportion_p(i_a, n_a, treated_indexed, treated_n)
        rate_a = (i_a / n_a) if n_a else 0.0
        rate_t = (treated_indexed / treated_n) if treated_n else 0.0
        if p is None:
            answer = "INCONCLUSIVE"
            reason = "Statistical comparison is undefined."
        elif rate_t > rate_a and p < 0.05:
            answer = "YES"
            reason = (
                f"Pooled B+C+D index rate {rate_t:.3f} > control {rate_a:.3f} "
                f"(two-proportion p={p})."
            )
        elif rate_t > rate_a:
            answer = "POSSIBLE"
            reason = (
                f"Pooled treated rate {rate_t:.3f} > control {rate_a:.3f} "
                f"but p={p} is not < 0.05. Do not call a winner."
            )
        elif rate_t <= rate_a:
            answer = "NO"
            reason = (
                f"Pooled treated rate {rate_t:.3f} is not higher than control {rate_a:.3f} "
                f"(p={p})."
            )
        else:
            answer = "INCONCLUSIVE"
            reason = "Not enough verification evidence to compare."
        if all((groups[g]["indexed"] == 0 and groups[g]["unknown"] == groups[g]["eligible"]) for g in GROUP_LABELS if groups[g]["eligible"]):
            answer = "INCONCLUSIVE"
            reason = "Every eligible URL is still UNKNOWN — no indexing evidence yet."

    return {
        "answer": answer,
        "question": "Does our FREE discovery system measurably improve Google indexing outcomes compared with the control group?",
        "reason": reason,
        "min_n": MIN_N,
        "preferred_n": PREFERRED_N,
        "pooled_treated": {
            "eligible": treated_n,
            "indexed": treated_indexed,
            "verified_index_rate": round(treated_indexed / treated_n, 4) if treated_n else None,
        },
        "pairwise_vs_control": pairwise,
        "disclaimer": (
            "YES requires n>=30 per group and p<0.05. "
            "This is not a Google Indexing API and not a guarantee."
        ),
    }


def build_experiment_report(jobs: Iterable[Any]) -> Dict[str, Any]:
    jobs = list(jobs)
    study = [j for j in jobs if _in_study(j)]
    already = [j for j in study if getattr(j, "baseline_status", "") == "BASELINE_ALREADY_INDEXED"]
    by_group: Dict[str, List[Any]] = {k: [] for k in GROUP_LABELS}
    for job in study:
        g = getattr(job, "experiment_group", None) or "B"
        if g in by_group:
            by_group[g].append(job)
    groups = {key: {"label": GROUP_LABELS[key], **_group_metrics(by_group[key])} for key in GROUP_LABELS}
    quality_corr = _breakdown(study, "quality_band")
    quality_note = (
        "Quality score is a workflow/readiness heuristic unless a bucket has n>=30 "
        "and a clear rate difference. It is not an indexing probability."
    )
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "engine": "FREE BACKLINK INDEXING OPTIMIZATION PLATFORM — empirical experiment",
        "totals": {
            "submitted_in_study": len(study),
            "eligible": sum(g["eligible"] for g in groups.values()),
            "baseline_already_indexed_excluded": len(already),
            "verified_indexed": sum(g["indexed"] for g in groups.values()),
            "unknown": sum(g["unknown"] for g in groups.values()),
            "not_indexed": sum(g["not_indexed"] for g in groups.values()),
        },
        "groups": groups,
        "funnel": {
            "discovery_signal_accepted": sum(g["discovery_signal_accepted"] for g in groups.values()),
            "target_url_discovered": sum(g["target_url_discovered"] for g in groups.values()),
            "target_url_crawled": sum(g["target_url_crawled"] for g in groups.values()),
            "target_url_indexed": sum(g["target_url_indexed"] for g in groups.values()),
            "note": "These layers are not interchangeable. Hub listing is not Google discovery, crawl, or indexing.",
        },
        "cumulative_verified_index_rate": _cumulative_curve(study),
        "domains": _breakdown(study, "source_domain"),
        "backlink_types": _breakdown(study, "backlink_rel_type"),
        "page_freshness": _breakdown(study, "page_freshness"),
        "quality_score_validation": {"buckets": quality_corr, "note": quality_note},
        "priority_engine_validation": _priority_efficiency(study),
        "retry_engine_validation": _retry_value(study),
        "verdict": _verdict(groups),
        "paid_indexer_comparison": {
            "our_measured_result": groups,
            "their_marketing_claim": PAID_INDEXER_CLAIMS,
            "note": (
                "Do not claim parity with paid indexers. Marketing claims are not our measurements. "
                "Our numbers are verification evidence only."
            ),
        },
        "disclaimer": (
            "INDEXED requires reliable verification evidence. "
            "Discovery is not indexing. Crawl is not indexing. "
            "This is not a Google Indexing API."
        ),
    }


def export_rows(jobs: Iterable[Any]) -> List[Dict[str, Any]]:
    rows = []
    for job in jobs:
        if not _in_study(job):
            continue
        tti = _seconds(job.experiment_started_at, job.indexed_at) if _indexed(job) else None
        snapshot = getattr(job, "channel_snapshot", None) or {}
        channels = ",".join(sorted(snapshot.keys()))
        accepted = any(bool((snapshot.get(k) or {}).get("accepted")) for k in snapshot)
        row = {
            "url": job.source_url,
            "domain": job.source_domain,
            "experiment_group": job.experiment_group,
            "quality_score": job.quality_score,
            "priority": job.priority_band,
            "backlink_type": job.backlink_rel_type,
            "discovery_channels": channels,
            "discovery_accepted": accepted or bool(job.public_listed),
            "crawl_evidence": _crawl_evidence(job),
            "verification_result": job.verification_status or job.visibility_status,
            "indexed_at": job.indexed_at.isoformat() if job.indexed_at else None,
            "time_to_index_seconds": tti,
            "attempts": job.attempt_count,
            "final_status": job.visibility_status,
            "baseline_status": job.baseline_status,
            "experiment_eligible": job.experiment_eligible,
        }
        blob = str(row).lower()
        if any(k in blob for k in SECRET_KEYS):
            continue
        rows.append(row)
    return rows


def export_csv(jobs: Iterable[Any]) -> str:
    rows = export_rows(jobs)
    buffer = io.StringIO()
    fieldnames = [
        "url",
        "domain",
        "experiment_group",
        "quality_score",
        "priority",
        "backlink_type",
        "discovery_channels",
        "discovery_accepted",
        "crawl_evidence",
        "verification_result",
        "indexed_at",
        "time_to_index_seconds",
        "attempts",
        "final_status",
        "baseline_status",
        "experiment_eligible",
    ]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow({k: row.get(k, "") for k in fieldnames})
    return buffer.getvalue()


__all__ = [
    "MIN_N",
    "PREFERRED_N",
    "build_experiment_report",
    "experiment_channel_names",
    "export_csv",
    "export_rows",
    "quality_band",
    "rel_type_from_rel",
    "two_proportion_p",
    "wilson_interval",
]

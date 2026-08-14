"""Controlled discovery-signal experiments.

Groups are assigned from the URL hash so a URL always stays in one bucket.
Effectiveness may only be claimed from measured verification evidence.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Iterable, Optional

from app.modules.indexing.engine.quality import assign_experiment_group
from app.modules.indexing.engine.states import VisibilityStatus

GROUP_LABELS = {
    "A": "Control — monitor only, no discovery signal",
    "B": "Public Hub (HTML + RSS + Atom + JSON)",
    "C": "Public Hub + WebSub",
    "D": "All legitimate third-party signals (hub + WebSub)",
}


def _seconds(start: Optional[datetime], end: Optional[datetime]) -> Optional[float]:
    if not start or not end:
        return None
    if start.tzinfo is None or end.tzinfo is None:
        start = start.replace(tzinfo=start.tzinfo)
        end = end.replace(tzinfo=end.tzinfo)
    return round((end - start).total_seconds(), 2)


def summarize_experiments(jobs: Iterable[Any]) -> Dict[str, Any]:
    buckets: Dict[str, Dict[str, Any]] = {
        key: {
            "label": GROUP_LABELS[key],
            "n": 0,
            "public_listed": 0,
            "discovery_submitted": 0,
            "verified_indexed": 0,
            "time_to_discovery": [],
            "time_to_crawl": [],
            "time_to_index": [],
        }
        for key in GROUP_LABELS
    }
    for job in jobs:
        group = getattr(job, "experiment_group", None) or assign_experiment_group(
            getattr(job, "source_url_hash", "") or ""
        )
        if group not in buckets:
            continue
        row = buckets[group]
        row["n"] += 1
        if getattr(job, "public_listed", False):
            row["public_listed"] += 1
        if getattr(job, "discovery_completed_at", None):
            row["discovery_submitted"] += 1
            delta = _seconds(job.submitted_at, job.discovery_completed_at)
            if delta is not None:
                row["time_to_discovery"].append(delta)
        if getattr(job, "crawl_detected_at", None):
            delta = _seconds(job.submitted_at, job.crawl_detected_at)
            if delta is not None:
                row["time_to_crawl"].append(delta)
        if getattr(job, "visibility_status", "") == VisibilityStatus.INDEXED.value:
            row["verified_indexed"] += 1
            delta = _seconds(job.submitted_at, job.indexed_at)
            if delta is not None:
                row["time_to_index"].append(delta)

    out: Dict[str, Any] = {}
    for key, row in buckets.items():
        n = row["n"] or 0
        indexed = row["verified_indexed"]
        def _avg(values: list) -> Optional[float]:
            return round(sum(values) / len(values), 2) if values else None

        out[key] = {
            "label": row["label"],
            "n": n,
            "public_listed": row["public_listed"],
            "discovery_submitted": row["discovery_submitted"],
            "verified_indexed": indexed,
            "verified_index_rate": round((indexed / n) * 100, 2) if n else 0.0,
            "time_to_discovery_seconds": _avg(row["time_to_discovery"]),
            "time_to_crawl_seconds": _avg(row["time_to_crawl"]),
            "time_to_index_seconds": _avg(row["time_to_index"]),
        }
    return {
        "groups": out,
        "note": (
            "Experiment metrics are descriptive only. A higher rate in one group is not "
            "proof that Google prefers that signal until a controlled sample is large enough. "
            "Do not treat this as an indexing guarantee."
        ),
    }


__all__ = ["GROUP_LABELS", "summarize_experiments"]

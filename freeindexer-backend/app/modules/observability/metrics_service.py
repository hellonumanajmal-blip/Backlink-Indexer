"""Metrics aggregation and snapshot helpers for Phase 34."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from app.observability import metrics


class MetricsService:
    """Collects and aggregates platform metrics for dashboards and workers."""

    def __init__(self) -> None:
        self._snapshots: Dict[str, List[Dict[str, Any]]] = {}

    def record(
        self,
        tenant_id: str,
        name: str,
        value: float,
        *,
        labels: Dict[str, str] | None = None,
    ) -> Dict[str, Any]:
        entry = {
            "name": name,
            "value": value,
            "labels": labels or {},
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        self._snapshots.setdefault(tenant_id, []).append(entry)
        metrics.observability_metrics_recorded_total.labels(
            tenant_id=tenant_id, metric_name=name
        ).inc()
        return entry

    def list_metrics(self, tenant_id: str, *, limit: int = 100) -> List[Dict[str, Any]]:
        rows = self._snapshots.get(tenant_id, [])
        return list(reversed(rows[-limit:]))

    def aggregate(self, tenant_id: str) -> Dict[str, Any]:
        rows = self._snapshots.get(tenant_id, [])
        by_name: Dict[str, List[float]] = {}
        for row in rows:
            by_name.setdefault(row["name"], []).append(float(row["value"]))
        aggregates = {
            name: {
                "count": len(values),
                "sum": sum(values),
                "avg": (sum(values) / len(values)) if values else 0.0,
                "max": max(values) if values else 0.0,
                "min": min(values) if values else 0.0,
            }
            for name, values in by_name.items()
        }
        metrics.observability_metrics_aggregations_total.labels(tenant_id=tenant_id).inc()
        return {"tenant_id": tenant_id, "metrics": aggregates, "sample_count": len(rows)}

    def cleanup(self, tenant_id: str, keep: int = 500) -> int:
        rows = self._snapshots.get(tenant_id, [])
        if len(rows) <= keep:
            return 0
        removed = len(rows) - keep
        self._snapshots[tenant_id] = rows[-keep:]
        return removed

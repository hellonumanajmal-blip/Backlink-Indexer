"""SLA / SLO evaluation and tracking."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.observability import metrics


class SLAMonitor:
    """Tracks uptime and latency SLAs and evaluates compliance."""

    DEFAULT_TARGETS = {
        "availability": 0.999,
        "latency_p99_ms": 500.0,
        "error_rate": 0.01,
    }

    def __init__(self) -> None:
        self._samples: Dict[str, List[Dict[str, Any]]] = {}

    def record_sample(
        self,
        tenant_id: str,
        *,
        available: bool,
        latency_ms: float,
        errored: bool = False,
    ) -> Dict[str, Any]:
        sample = {
            "available": available,
            "latency_ms": latency_ms,
            "errored": errored,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        bucket = self._samples.setdefault(tenant_id, [])
        bucket.append(sample)
        if len(bucket) > 1000:
            del bucket[0 : len(bucket) - 1000]
        return sample

    def evaluate(
        self,
        tenant_id: str,
        *,
        targets: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        goals = {**self.DEFAULT_TARGETS, **(targets or {})}
        samples = self._samples.get(tenant_id, [])
        if not samples:
            result = {
                "tenant_id": tenant_id,
                "compliance_ratio": 1.0,
                "status": "compliant",
                "targets": goals,
                "observed": {
                    "availability": 1.0,
                    "latency_p99_ms": 0.0,
                    "error_rate": 0.0,
                },
                "breaches": [],
                "evaluated_at": datetime.now(timezone.utc).isoformat(),
            }
            metrics.observability_sla_compliance.labels(tenant_id=tenant_id).set(1.0)
            return result

        availability = sum(1 for s in samples if s["available"]) / len(samples)
        latencies = sorted(s["latency_ms"] for s in samples)
        idx = max(0, int(len(latencies) * 0.99) - 1)
        latency_p99 = latencies[idx]
        error_rate = sum(1 for s in samples if s["errored"]) / len(samples)

        breaches: List[str] = []
        if availability < goals["availability"]:
            breaches.append("availability")
        if latency_p99 > goals["latency_p99_ms"]:
            breaches.append("latency_p99_ms")
        if error_rate > goals["error_rate"]:
            breaches.append("error_rate")

        checks = 3
        compliance_ratio = (checks - len(breaches)) / checks
        status = "compliant" if not breaches else "breach"
        metrics.observability_sla_compliance.labels(tenant_id=tenant_id).set(compliance_ratio)
        metrics.observability_sla_evaluations_total.labels(
            tenant_id=tenant_id, status=status
        ).inc()
        return {
            "tenant_id": tenant_id,
            "compliance_ratio": round(compliance_ratio, 4),
            "status": status,
            "targets": goals,
            "observed": {
                "availability": round(availability, 6),
                "latency_p99_ms": round(latency_p99, 3),
                "error_rate": round(error_rate, 6),
            },
            "breaches": breaches,
            "sample_count": len(samples),
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

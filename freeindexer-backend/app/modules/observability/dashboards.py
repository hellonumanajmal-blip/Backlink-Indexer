"""Observability dashboard aggregations."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List


class DashboardService:
    """Builds overview payloads for the observability console."""

    def platform_overview(
        self,
        *,
        health: Dict[str, Any],
        alerts: List[Dict[str, Any]],
        incidents: List[Dict[str, Any]],
        metrics_summary: Dict[str, Any],
        sla: Dict[str, Any],
        security_open: int,
        compliance_ready: bool,
    ) -> Dict[str, Any]:
        open_incidents = [i for i in incidents if i.get("status") in {"open", "acknowledged", "investigating"}]
        firing_alerts = [a for a in alerts if a.get("status") == "firing"]
        return {
            "health_status": health.get("status", "unknown"),
            "dependency_count": len(health.get("dependencies", [])),
            "open_incidents": len(open_incidents),
            "firing_alerts": len(firing_alerts),
            "security_events_open": security_open,
            "sla_compliance": sla.get("compliance_ratio", 1.0),
            "metrics_sample_count": metrics_summary.get("sample_count", 0),
            "compliance_ready": compliance_ready,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "sections": [
                "Platform Overview",
                "Health Dashboard",
                "Metrics",
                "Traces",
                "Logs",
                "Incidents",
                "Alerts",
                "Governance",
                "Compliance",
                "Diagnostics",
            ],
        }

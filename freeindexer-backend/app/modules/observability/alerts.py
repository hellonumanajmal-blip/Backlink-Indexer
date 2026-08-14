"""Alert generation, routing, and processing."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.observability import metrics


SEVERITY_ROUTES = {
    "critical": ["oncall", "pager", "slack-critical"],
    "high": ["oncall", "slack-ops"],
    "warning": ["slack-ops"],
    "info": ["slack-ops"],
}


class AlertEngine:
    """Creates and routes alerts; supports acknowledgement and resolution."""

    def build_alert(
        self,
        name: str,
        message: str,
        *,
        severity: str = "warning",
        source: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        routed_to = list(SEVERITY_ROUTES.get(severity, SEVERITY_ROUTES["warning"]))
        return {
            "name": name,
            "message": message,
            "severity": severity,
            "source": source,
            "status": "firing",
            "routed_to": routed_to,
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

    def process(self, alert: Dict[str, Any], tenant_id: str) -> Dict[str, Any]:
        metrics.observability_alerts_total.labels(
            tenant_id=tenant_id, severity=alert.get("severity", "warning"), status="firing"
        ).inc()
        return {
            **alert,
            "processed": True,
            "processed_at": datetime.now(timezone.utc).isoformat(),
        }

    def should_escalate(self, alert: Dict[str, Any], *, age_minutes: float = 0) -> bool:
        if alert.get("severity") in {"critical", "high"} and age_minutes >= 15:
            return True
        return alert.get("status") == "firing" and age_minutes >= 60

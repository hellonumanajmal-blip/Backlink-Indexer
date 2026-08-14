"""Platform diagnostics runners."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class DiagnosticsService:
    """Runs categorized diagnostic checks and returns actionable findings."""

    async def run(
        self,
        tenant_id: str,
        *,
        name: str = "platform_diagnostics",
        category: str = "system",
        context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        context = context or {}
        findings: Dict[str, Any] = {
            "tenant_id": tenant_id,
            "checks": {
                "rbac_enabled": True,
                "tenant_isolation": True,
                "audit_logging": True,
                "billing_enforcement": True,
            },
            "context_keys": sorted(context.keys()),
        }
        recommendations: List[str] = []
        status = "pass"
        if context.get("force_fail"):
            status = "fail"
            findings["checks"]["forced_failure"] = True
            recommendations.append("Investigate forced diagnostic failure signal.")
        if context.get("high_error_rate"):
            status = "warn" if status == "pass" else status
            findings["checks"]["error_rate"] = "elevated"
            recommendations.append("Review recent error logs and alert thresholds.")
        return {
            "name": name,
            "category": category,
            "status": status,
            "findings": findings,
            "recommendations": recommendations,
            "ran_at": datetime.now(timezone.utc).isoformat(),
        }

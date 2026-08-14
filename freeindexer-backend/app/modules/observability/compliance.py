"""Compliance engine — GDPR readiness, retention, consent, reporting."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class ComplianceEngine:
    """Supports GDPR readiness, audit exports, retention, and deletion workflows."""

    def __init__(self) -> None:
        self._consents: Dict[str, List[Dict[str, Any]]] = {}
        self._retention: Dict[str, Dict[str, Any]] = {}
        self._deletion_requests: Dict[str, List[Dict[str, Any]]] = {}

    def track_consent(
        self,
        tenant_id: str,
        *,
        subject_id: str,
        purpose: str,
        granted: bool,
        actor: str,
    ) -> Dict[str, Any]:
        record = {
            "subject_id": subject_id,
            "purpose": purpose,
            "granted": granted,
            "actor": actor,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
        }
        self._consents.setdefault(tenant_id, []).append(record)
        return record

    def set_retention_policy(
        self,
        tenant_id: str,
        *,
        resource_type: str,
        retain_days: int,
        legal_basis: str = "legitimate_interest",
    ) -> Dict[str, Any]:
        policy = {
            "resource_type": resource_type,
            "retain_days": retain_days,
            "legal_basis": legal_basis,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        self._retention.setdefault(tenant_id, {})[resource_type] = policy
        return policy

    def request_deletion(
        self,
        tenant_id: str,
        *,
        subject_id: str,
        resource_types: Optional[List[str]] = None,
        actor: str = "system",
    ) -> Dict[str, Any]:
        request = {
            "subject_id": subject_id,
            "resource_types": resource_types or ["all"],
            "status": "queued",
            "actor": actor,
            "requested_at": datetime.now(timezone.utc).isoformat(),
        }
        self._deletion_requests.setdefault(tenant_id, []).append(request)
        return request

    def gdpr_readiness(self, tenant_id: str) -> Dict[str, Any]:
        consents = self._consents.get(tenant_id, [])
        retention = self._retention.get(tenant_id, {})
        deletions = self._deletion_requests.get(tenant_id, [])
        checks = {
            "consent_tracking": len(consents) > 0,
            "retention_policies": len(retention) > 0,
            "deletion_workflow": True,
            "audit_export": True,
        }
        score = sum(1 for v in checks.values() if v) / len(checks)
        return {
            "framework": "gdpr",
            "ready": score >= 0.75,
            "score": round(score, 4),
            "checks": checks,
            "consent_records": len(consents),
            "retention_policies": len(retention),
            "deletion_requests": len(deletions),
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

    def build_report(
        self,
        tenant_id: str,
        *,
        report_type: str = "gdpr_readiness",
        framework: str = "gdpr",
    ) -> Dict[str, Any]:
        readiness = self.gdpr_readiness(tenant_id)
        export_payload = {
            "tenant_id": tenant_id,
            "consents": self._consents.get(tenant_id, []),
            "retention": self._retention.get(tenant_id, {}),
            "deletion_requests": self._deletion_requests.get(tenant_id, []),
            "readiness": readiness,
        }
        return {
            "report_type": report_type,
            "framework": framework,
            "status": "generated",
            "findings": readiness,
            "export_payload": export_payload,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def audit_export(self, tenant_id: str) -> Dict[str, Any]:
        return {
            "tenant_id": tenant_id,
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "consents": self._consents.get(tenant_id, []),
            "retention": self._retention.get(tenant_id, {}),
            "deletion_requests": self._deletion_requests.get(tenant_id, []),
        }

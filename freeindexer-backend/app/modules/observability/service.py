"""Enterprise observability orchestration service (Phase 34)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_log
from app.modules.observability.alerts import AlertEngine
from app.modules.observability.compliance import ComplianceEngine
from app.modules.observability.dashboards import DashboardService
from app.modules.observability.diagnostics import DiagnosticsService
from app.modules.observability.governance import GovernanceService
from app.modules.observability.health_service import HealthService
from app.modules.observability.incidents import IncidentManager
from app.modules.observability.logging_service import LoggingService
from app.modules.observability.metrics_service import MetricsService
from app.modules.observability.models import (
    Alert,
    ComplianceReport,
    Diagnostic,
    GovernancePolicy,
    HealthCheck,
    Incident,
    SecurityEvent,
    TraceRecord,
)
from app.modules.observability.repository import (
    AlertRepository,
    ComplianceReportRepository,
    DiagnosticRepository,
    GovernancePolicyRepository,
    HealthCheckRepository,
    IncidentRepository,
    SecurityEventRepository,
    TraceRepository,
)
from app.modules.observability.security_center import SecurityCenter
from app.modules.observability.sla_monitor import SLAMonitor
from app.modules.observability.tracing import TracingService
from app.observability import metrics

# Process-local shared collaborators so ring buffers survive across requests.
_METRICS = MetricsService()
_TRACING = TracingService()
_LOGGING = LoggingService()
_SLA = SLAMonitor()
_SECURITY = SecurityCenter()
_COMPLIANCE = ComplianceEngine()
_GOVERNANCE = GovernanceService()
_ALERTS = AlertEngine()
_INCIDENTS = IncidentManager()
_DIAGNOSTICS = DiagnosticsService()
_DASHBOARDS = DashboardService()


class ObservabilityService:
    """Production-grade orchestrator for observability, security, governance, and compliance."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.metrics_svc = _METRICS
        self.tracing = _TRACING
        self.logging = _LOGGING
        self.sla = _SLA
        self.security = _SECURITY
        self.compliance = _COMPLIANCE
        self.governance = _GOVERNANCE
        self.alerts = _ALERTS
        self.incidents_mgr = _INCIDENTS
        self.diagnostics = _DIAGNOSTICS
        self.dashboards = _DASHBOARDS
        self.health = HealthService(session)

        self.incident_repo = IncidentRepository(session)
        self.alert_repo = AlertRepository(session)
        self.trace_repo = TraceRepository(session)
        self.diagnostic_repo = DiagnosticRepository(session)
        self.policy_repo = GovernancePolicyRepository(session)
        self.compliance_repo = ComplianceReportRepository(session)
        self.security_repo = SecurityEventRepository(session)
        self.health_repo = HealthCheckRepository(session)

    # ------------------------------------------------------------------ overview
    async def platform_overview(self, tenant_id: str) -> Dict[str, Any]:
        health = await self.health.check_all()
        alerts = await self.list_alerts(tenant_id)
        incidents = await self.list_incidents(tenant_id)
        metrics_summary = self.metrics_svc.aggregate(tenant_id)
        sla = self.sla.evaluate(tenant_id)
        security_events = await self.list_security_events(tenant_id)
        open_security = len([e for e in security_events if e.get("status") == "open"])
        readiness = self.compliance.gdpr_readiness(tenant_id)
        return self.dashboards.platform_overview(
            health=health,
            alerts=alerts,
            incidents=incidents,
            metrics_summary=metrics_summary,
            sla=sla,
            security_open=open_security,
            compliance_ready=bool(readiness.get("ready")),
        )

    # ------------------------------------------------------------------ health
    async def get_health(self, tenant_id: str) -> Dict[str, Any]:
        report = await self.health.check_all()
        for dep in report["dependencies"]:
            row = HealthCheck(
                tenant_id=tenant_id,
                service_name="platform",
                dependency=dep["dependency"],
                status=dep["status"],
                latency_ms=dep["latency_ms"],
                uptime_ratio=dep["uptime_ratio"],
                details=dep["details"],
            )
            await self.health_repo.add(row)
            self.sla.record_sample(
                tenant_id,
                available=dep["status"] == "healthy",
                latency_ms=dep["latency_ms"],
                errored=dep["status"] == "unhealthy",
            )
        metrics.observability_health_checks_total.labels(
            tenant_id=tenant_id, status=report["status"]
        ).inc()
        return report

    async def list_health_checks(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.health_repo.list_for_tenant(tenant_id)
        return [
            {
                "id": r.id,
                "service_name": r.service_name,
                "dependency": r.dependency,
                "status": r.status,
                "latency_ms": r.latency_ms,
                "uptime_ratio": r.uptime_ratio,
                "details": r.details,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    # ------------------------------------------------------------------ metrics / traces / logs
    async def record_metric(
        self,
        tenant_id: str,
        name: str,
        value: float,
        *,
        labels: Optional[Dict[str, str]] = None,
        actor: str = "system",
    ) -> Dict[str, Any]:
        entry = self.metrics_svc.record(tenant_id, name, value, labels=labels)
        audit_log(
            "observability.metric.record",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="metric",
            metadata={"name": name, "value": value},
        )
        return entry

    async def list_metrics(self, tenant_id: str) -> Dict[str, Any]:
        return {
            "items": self.metrics_svc.list_metrics(tenant_id),
            "aggregate": self.metrics_svc.aggregate(tenant_id),
        }

    async def start_trace(
        self,
        tenant_id: str,
        service_name: str,
        operation: str,
        *,
        parent_span_id: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None,
        actor: str = "system",
    ) -> Dict[str, Any]:
        span = self.tracing.start_span(
            tenant_id,
            service_name,
            operation,
            parent_span_id=parent_span_id,
            attributes=attributes,
        )
        row = TraceRecord(
            tenant_id=tenant_id,
            trace_id=span["trace_id"],
            span_id=span["span_id"],
            parent_span_id=span.get("parent_span_id"),
            correlation_id=span["correlation_id"],
            service_name=service_name,
            operation=operation,
            status=span["status"],
            duration_ms=0.0,
            attributes=span.get("attributes") or {},
        )
        await self.trace_repo.add(row)
        audit_log(
            "observability.trace.start",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="trace",
            resource_id=row.id,
            metadata={"operation": operation, "service_name": service_name},
        )
        return {**span, "id": row.id}

    async def finish_trace(
        self,
        tenant_id: str,
        span_id: str,
        *,
        status: str = "ok",
        duration_ms: float = 0.0,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        finished = self.tracing.finish_span(
            tenant_id,
            span_id,
            status=status,
            duration_ms=duration_ms,
            attributes=attributes,
        )
        rows = await self.trace_repo.list_for_tenant(tenant_id, limit=500)
        for row in rows:
            if row.span_id == span_id:
                row.status = status
                row.duration_ms = duration_ms
                if attributes:
                    row.attributes = {**(row.attributes or {}), **attributes}
                await self.session.flush()
                break
        return finished

    async def list_traces(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.trace_repo.list_for_tenant(tenant_id)
        return [
            {
                "id": r.id,
                "trace_id": r.trace_id,
                "span_id": r.span_id,
                "parent_span_id": r.parent_span_id,
                "correlation_id": r.correlation_id,
                "service_name": r.service_name,
                "operation": r.operation,
                "status": r.status,
                "duration_ms": r.duration_ms,
                "attributes": r.attributes,
            }
            for r in rows
        ]

    async def emit_log(
        self,
        tenant_id: str,
        level: str,
        message: str,
        *,
        service: str = "platform",
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return self.logging.emit(
            tenant_id, level, message, service=service, extra=extra
        )

    async def list_logs(self, tenant_id: str, *, level: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.logging.list_logs(tenant_id, level=level)

    # ------------------------------------------------------------------ alerts
    async def create_alert(
        self,
        tenant_id: str,
        name: str,
        message: str,
        *,
        severity: str = "warning",
        source: str = "system",
        metadata: Optional[Dict[str, Any]] = None,
        actor: str = "system",
    ) -> Dict[str, Any]:
        payload = self.alerts.build_alert(
            name, message, severity=severity, source=source, metadata=metadata
        )
        processed = self.alerts.process(payload, tenant_id)
        row = Alert(
            tenant_id=tenant_id,
            name=processed["name"],
            source=processed["source"],
            severity=processed["severity"],
            status=processed["status"],
            message=processed["message"],
            routed_to=processed["routed_to"],
            metadata=processed.get("metadata") or {},
        )
        await self.alert_repo.add(row)
        audit_log(
            "observability.alert.create",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="alert",
            resource_id=row.id,
            metadata={"severity": severity, "name": name},
        )
        return {
            "id": row.id,
            "name": row.name,
            "severity": row.severity,
            "status": row.status,
            "message": row.message,
            "routed_to": row.routed_to,
            "source": row.source,
        }

    async def list_alerts(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.alert_repo.list_for_tenant(tenant_id)
        return [
            {
                "id": r.id,
                "name": r.name,
                "severity": r.severity,
                "status": r.status,
                "message": r.message,
                "routed_to": r.routed_to,
                "source": r.source,
                "incident_id": r.incident_id,
            }
            for r in rows
        ]

    async def acknowledge_alert(
        self, tenant_id: str, alert_id: str, *, actor: str
    ) -> Optional[Dict[str, Any]]:
        row = await self.alert_repo.get_for_tenant(alert_id, tenant_id)
        if not row:
            return None
        row.status = "acknowledged"
        await self.session.flush()
        metrics.observability_alerts_total.labels(
            tenant_id=tenant_id, severity=row.severity, status="acknowledged"
        ).inc()
        audit_log(
            "observability.alert.acknowledge",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="alert",
            resource_id=row.id,
        )
        return {"id": row.id, "status": row.status}

    # ------------------------------------------------------------------ incidents
    async def create_incident(
        self,
        tenant_id: str,
        title: str,
        *,
        description: str = "",
        severity: str = "medium",
        metadata: Optional[Dict[str, Any]] = None,
        actor: str = "system",
    ) -> Dict[str, Any]:
        payload = self.incidents_mgr.create_payload(
            title, description=description, severity=severity, metadata=metadata, actor=actor
        )
        row = Incident(
            tenant_id=tenant_id,
            title=payload["title"],
            description=payload["description"],
            severity=payload["severity"],
            status=payload["status"],
            escalation_level=payload["escalation_level"],
            history=payload["history"],
            metadata=payload.get("metadata") or {},
        )
        await self.incident_repo.add(row)
        metrics.observability_incidents_total.labels(
            tenant_id=tenant_id, severity=severity, status="open"
        ).inc()
        audit_log(
            "observability.incident.create",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="incident",
            resource_id=row.id,
            metadata={"severity": severity, "title": title},
        )
        return await self.get_incident(tenant_id, row.id)  # type: ignore[return-value]

    async def list_incidents(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.incident_repo.list_for_tenant(tenant_id)
        return [self._incident_dict(r) for r in rows]

    async def get_incident(self, tenant_id: str, incident_id: str) -> Optional[Dict[str, Any]]:
        row = await self.incident_repo.get_for_tenant(incident_id, tenant_id)
        return self._incident_dict(row) if row else None

    async def acknowledge_incident(
        self, tenant_id: str, incident_id: str, *, actor: str
    ) -> Optional[Dict[str, Any]]:
        row = await self.incident_repo.get_for_tenant(incident_id, tenant_id)
        if not row:
            return None
        updated = self.incidents_mgr.acknowledge(self._incident_dict(row), actor=actor)
        row.status = updated["status"]
        row.acknowledged_by = updated["acknowledged_by"]
        row.acknowledged_at = datetime.now(timezone.utc)
        row.history = updated["history"]
        await self.session.flush()
        audit_log(
            "observability.incident.acknowledge",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="incident",
            resource_id=row.id,
        )
        return self._incident_dict(row)

    async def escalate_incident(
        self, tenant_id: str, incident_id: str, *, actor: str
    ) -> Optional[Dict[str, Any]]:
        row = await self.incident_repo.get_for_tenant(incident_id, tenant_id)
        if not row:
            return None
        updated = self.incidents_mgr.escalate(self._incident_dict(row), actor=actor)
        row.status = updated["status"]
        row.escalation_level = updated["escalation_level"]
        row.history = updated["history"]
        await self.session.flush()
        audit_log(
            "observability.incident.escalate",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="incident",
            resource_id=row.id,
            metadata={"level": row.escalation_level},
        )
        return self._incident_dict(row)

    async def resolve_incident(
        self,
        tenant_id: str,
        incident_id: str,
        *,
        actor: str,
        rca: Optional[str] = None,
    ) -> Optional[Dict[str, Any]]:
        row = await self.incident_repo.get_for_tenant(incident_id, tenant_id)
        if not row:
            return None
        updated = self.incidents_mgr.resolve(self._incident_dict(row), actor=actor, rca=rca)
        row.status = updated["status"]
        row.resolved_by = updated["resolved_by"]
        row.resolved_at = datetime.now(timezone.utc)
        row.rca = updated.get("rca")
        row.history = updated["history"]
        await self.session.flush()
        metrics.observability_incidents_total.labels(
            tenant_id=tenant_id, severity=row.severity, status="resolved"
        ).inc()
        audit_log(
            "observability.incident.resolve",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="incident",
            resource_id=row.id,
            metadata={"rca": rca},
        )
        return self._incident_dict(row)

    def _incident_dict(self, row: Incident) -> Dict[str, Any]:
        return {
            "id": row.id,
            "title": row.title,
            "description": row.description,
            "severity": row.severity,
            "status": row.status,
            "acknowledged_by": row.acknowledged_by,
            "acknowledged_at": row.acknowledged_at.isoformat() if row.acknowledged_at else None,
            "resolved_by": row.resolved_by,
            "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
            "escalation_level": row.escalation_level,
            "rca": row.rca,
            "history": row.history or [],
            "metadata": getattr(row, "metadata_payload", {}) or {},
        }

    # ------------------------------------------------------------------ governance
    async def create_policy(
        self,
        tenant_id: str,
        name: str,
        policy_type: str,
        rules: Dict[str, Any],
        *,
        metadata: Optional[Dict[str, Any]] = None,
        actor: str = "system",
    ) -> Dict[str, Any]:
        payload = self.governance.create_policy_payload(
            name, policy_type, rules, metadata=metadata
        )
        row = GovernancePolicy(
            tenant_id=tenant_id,
            name=payload["name"],
            policy_type=payload["policy_type"],
            version=payload["version"],
            status=payload["status"],
            rules=payload["rules"],
            approval_status=payload["approval_status"],
            metadata=payload.get("metadata") or {},
        )
        await self.policy_repo.add(row)
        audit_log(
            "observability.governance.policy.create",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="governance_policy",
            resource_id=row.id,
            metadata={"policy_type": policy_type, "name": name},
        )
        return self._policy_dict(row)

    async def list_policies(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.policy_repo.list_for_tenant(tenant_id)
        return [self._policy_dict(r) for r in rows]

    async def approve_policy(
        self, tenant_id: str, policy_id: str, *, actor: str
    ) -> Optional[Dict[str, Any]]:
        row = await self.policy_repo.get_for_tenant(policy_id, tenant_id)
        if not row:
            return None
        updated = self.governance.approve(self._policy_dict(row), actor=actor)
        row.status = updated["status"]
        row.approval_status = updated["approval_status"]
        row.approved_by = updated["approved_by"]
        await self.session.flush()
        audit_log(
            "observability.governance.policy.approve",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="governance_policy",
            resource_id=row.id,
        )
        return self._policy_dict(row)

    async def version_policy(
        self,
        tenant_id: str,
        policy_id: str,
        rules: Dict[str, Any],
        *,
        actor: str,
    ) -> Optional[Dict[str, Any]]:
        row = await self.policy_repo.get_for_tenant(policy_id, tenant_id)
        if not row:
            return None
        updated = self.governance.bump_version(self._policy_dict(row), rules)
        row.version = updated["version"]
        row.rules = updated["rules"]
        row.status = updated["status"]
        row.approval_status = updated["approval_status"]
        row.approved_by = None
        await self.session.flush()
        audit_log(
            "observability.governance.policy.version",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="governance_policy",
            resource_id=row.id,
            metadata={"version": row.version},
        )
        return self._policy_dict(row)

    def _policy_dict(self, row: GovernancePolicy) -> Dict[str, Any]:
        return {
            "id": row.id,
            "name": row.name,
            "policy_type": row.policy_type,
            "version": row.version,
            "status": row.status,
            "rules": row.rules,
            "approval_status": row.approval_status,
            "approved_by": row.approved_by,
            "metadata": getattr(row, "metadata_payload", {}) or {},
        }

    # ------------------------------------------------------------------ compliance
    async def track_consent(
        self,
        tenant_id: str,
        *,
        subject_id: str,
        purpose: str,
        granted: bool,
        actor: str,
    ) -> Dict[str, Any]:
        record = self.compliance.track_consent(
            tenant_id, subject_id=subject_id, purpose=purpose, granted=granted, actor=actor
        )
        audit_log(
            "observability.compliance.consent",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="consent",
            metadata=record,
        )
        return record

    async def set_retention(
        self,
        tenant_id: str,
        *,
        resource_type: str,
        retain_days: int,
        legal_basis: str,
        actor: str,
    ) -> Dict[str, Any]:
        policy = self.compliance.set_retention_policy(
            tenant_id,
            resource_type=resource_type,
            retain_days=retain_days,
            legal_basis=legal_basis,
        )
        audit_log(
            "observability.compliance.retention",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="retention_policy",
            metadata=policy,
        )
        return policy

    async def request_deletion(
        self,
        tenant_id: str,
        *,
        subject_id: str,
        resource_types: Optional[List[str]],
        actor: str,
    ) -> Dict[str, Any]:
        request = self.compliance.request_deletion(
            tenant_id, subject_id=subject_id, resource_types=resource_types, actor=actor
        )
        audit_log(
            "observability.compliance.deletion",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="deletion_request",
            metadata=request,
        )
        return request

    async def compliance_readiness(self, tenant_id: str) -> Dict[str, Any]:
        return self.compliance.gdpr_readiness(tenant_id)

    async def generate_compliance_report(
        self,
        tenant_id: str,
        *,
        report_type: str = "gdpr_readiness",
        framework: str = "gdpr",
        actor: str = "system",
    ) -> Dict[str, Any]:
        payload = self.compliance.build_report(
            tenant_id, report_type=report_type, framework=framework
        )
        row = ComplianceReport(
            tenant_id=tenant_id,
            report_type=payload["report_type"],
            status=payload["status"],
            framework=payload["framework"],
            findings=payload["findings"],
            export_payload=payload["export_payload"],
        )
        await self.compliance_repo.add(row)
        metrics.observability_compliance_reports_total.labels(
            tenant_id=tenant_id, framework=framework
        ).inc()
        audit_log(
            "observability.compliance.report",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="compliance_report",
            resource_id=row.id,
        )
        return {
            "id": row.id,
            "report_type": row.report_type,
            "status": row.status,
            "framework": row.framework,
            "findings": row.findings,
            "export_payload": row.export_payload,
        }

    async def list_compliance_reports(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.compliance_repo.list_for_tenant(tenant_id)
        return [
            {
                "id": r.id,
                "report_type": r.report_type,
                "status": r.status,
                "framework": r.framework,
                "findings": r.findings,
            }
            for r in rows
        ]

    async def audit_export(self, tenant_id: str) -> Dict[str, Any]:
        return self.compliance.audit_export(tenant_id)

    # ------------------------------------------------------------------ security
    async def record_security_event(
        self,
        tenant_id: str,
        event_type: str,
        *,
        actor: Optional[str] = None,
        ip_address: Optional[str] = None,
        resource: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        token_fingerprint: Optional[str] = None,
        signature_valid: Optional[bool] = None,
        secret_name: Optional[str] = None,
        endpoint: Optional[str] = None,
        acting_user: str = "system",
    ) -> Dict[str, Any]:
        if event_type == "failed_login":
            payload = self.security.record_failed_login(
                tenant_id, actor=actor or "unknown", ip_address=ip_address
            )
        elif event_type == "token_abuse":
            payload = self.security.record_token_abuse(
                tenant_id,
                actor=actor or "unknown",
                token_fingerprint=token_fingerprint or "unknown",
            )
        elif event_type == "rate_limit":
            payload = self.security.record_rate_limit(
                tenant_id,
                actor=actor,
                ip_address=ip_address,
                endpoint=endpoint or resource or "/api",
            )
        elif event_type == "webhook_validation":
            payload = self.security.validate_webhook(
                tenant_id,
                signature_valid=bool(signature_valid),
                source=actor or "webhook",
            )
        elif event_type == "secret_rotation":
            payload = self.security.track_secret_rotation(
                tenant_id, secret_name=secret_name or "secret", actor=actor or acting_user
            )
        elif event_type == "suspicious_activity":
            payload = self.security.detect_suspicious_activity(
                tenant_id, signals=details or {}
            )
        else:
            payload = {
                "event_type": event_type,
                "severity": "info",
                "actor": actor,
                "ip_address": ip_address,
                "resource": resource,
                "details": details or {},
                "status": "open",
            }
            metrics.observability_security_events_total.labels(
                tenant_id=tenant_id, event_type=event_type, severity="info"
            ).inc()

        row = SecurityEvent(
            tenant_id=tenant_id,
            event_type=payload["event_type"],
            severity=payload["severity"],
            actor=payload.get("actor"),
            ip_address=payload.get("ip_address"),
            resource=payload.get("resource"),
            details=payload.get("details") or {},
            status=payload.get("status") or "open",
        )
        await self.security_repo.add(row)
        audit_log(
            "observability.security.event",
            tenant_id=tenant_id,
            actor=acting_user,
            resource_type="security_event",
            resource_id=row.id,
            metadata={"event_type": event_type},
        )
        return {
            "id": row.id,
            "event_type": row.event_type,
            "severity": row.severity,
            "actor": row.actor,
            "ip_address": row.ip_address,
            "resource": row.resource,
            "details": row.details,
            "status": row.status,
        }

    async def list_security_events(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.security_repo.list_for_tenant(tenant_id)
        return [
            {
                "id": r.id,
                "event_type": r.event_type,
                "severity": r.severity,
                "actor": r.actor,
                "ip_address": r.ip_address,
                "resource": r.resource,
                "details": r.details,
                "status": r.status,
            }
            for r in rows
        ]

    async def ip_reputation(self, tenant_id: str, ip_address: str) -> Dict[str, Any]:
        return {"ip_address": ip_address, **self.security.ip_reputation(tenant_id, ip_address)}

    # ------------------------------------------------------------------ diagnostics / SLA
    async def run_diagnostics(
        self,
        tenant_id: str,
        *,
        name: str = "platform_diagnostics",
        category: str = "system",
        context: Optional[Dict[str, Any]] = None,
        actor: str = "system",
    ) -> Dict[str, Any]:
        result = await self.diagnostics.run(
            tenant_id, name=name, category=category, context=context
        )
        row = Diagnostic(
            tenant_id=tenant_id,
            name=result["name"],
            category=result["category"],
            status=result["status"],
            findings=result["findings"],
            recommendations=result["recommendations"],
        )
        await self.diagnostic_repo.add(row)
        metrics.observability_diagnostics_total.labels(
            tenant_id=tenant_id, status=result["status"]
        ).inc()
        audit_log(
            "observability.diagnostics.run",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="diagnostic",
            resource_id=row.id,
        )
        return {
            "id": row.id,
            "name": row.name,
            "category": row.category,
            "status": row.status,
            "findings": row.findings,
            "recommendations": row.recommendations,
        }

    async def list_diagnostics(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.diagnostic_repo.list_for_tenant(tenant_id)
        return [
            {
                "id": r.id,
                "name": r.name,
                "category": r.category,
                "status": r.status,
                "findings": r.findings,
                "recommendations": r.recommendations,
            }
            for r in rows
        ]

    async def evaluate_sla(self, tenant_id: str) -> Dict[str, Any]:
        return self.sla.evaluate(tenant_id)

    # ------------------------------------------------------------------ workers
    async def process_alerts_job(self, tenant_id: str) -> Dict[str, Any]:
        alerts = await self.list_alerts(tenant_id)
        processed = 0
        for alert in alerts:
            if alert.get("status") == "firing":
                self.alerts.process(alert, tenant_id)
                processed += 1
        return {"tenant_id": tenant_id, "processed": processed}

    async def compliance_scan_job(self, tenant_id: str) -> Dict[str, Any]:
        report = await self.generate_compliance_report(tenant_id, actor="system")
        return {"tenant_id": tenant_id, "report_id": report["id"], "findings": report["findings"]}

    async def log_cleanup_job(self, tenant_id: str, keep: int = 200) -> Dict[str, Any]:
        removed_logs = self.logging.cleanup(tenant_id, keep=keep)
        removed_metrics = self.metrics_svc.cleanup(tenant_id, keep=keep)
        return {
            "tenant_id": tenant_id,
            "removed_logs": removed_logs,
            "removed_metrics": removed_metrics,
        }

    async def metrics_aggregation_job(self, tenant_id: str) -> Dict[str, Any]:
        return self.metrics_svc.aggregate(tenant_id)

    async def health_monitoring_job(self, tenant_id: str) -> Dict[str, Any]:
        return await self.get_health(tenant_id)

    async def sla_evaluation_job(self, tenant_id: str) -> Dict[str, Any]:
        health = await self.get_health(tenant_id)
        return {"health": health, "sla": self.sla.evaluate(tenant_id)}

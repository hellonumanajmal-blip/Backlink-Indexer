"""API router for the enterprise observability platform."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal
from app.database import get_db
from app.modules.observability.dtos import (
    AlertCreateRequest,
    ConsentRequest,
    DeletionRequest,
    DiagnosticRunRequest,
    IncidentCreateRequest,
    IncidentResolveRequest,
    LogEmitRequest,
    MetricRecordRequest,
    PolicyCreateRequest,
    PolicyVersionRequest,
    RetentionRequest,
    SecurityEventRequest,
    TraceFinishRequest,
    TraceStartRequest,
)
from app.modules.observability.service import ObservabilityService
from app.rbac import require_permission

router = APIRouter(prefix="/observability", tags=["observability"])


def _service(db: AsyncSession = Depends(get_db)) -> ObservabilityService:
    return ObservabilityService(db)


@router.get("/overview")
async def platform_overview(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.platform_overview(principal.tenant_id)


@router.get("/health")
async def health(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.get_health(principal.tenant_id)


@router.get("/health/checks")
async def health_checks(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> List[dict]:
    return await svc.list_health_checks(principal.tenant_id)


@router.get("/metrics")
async def list_metrics(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.list_metrics(principal.tenant_id)


@router.post("/metrics", status_code=status.HTTP_201_CREATED)
async def record_metric(
    body: MetricRecordRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.record_metric(
        principal.tenant_id,
        body.name,
        body.value,
        labels=body.labels,
        actor=principal.user_id,
    )


@router.get("/traces")
async def list_traces(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> List[dict]:
    return await svc.list_traces(principal.tenant_id)


@router.post("/traces", status_code=status.HTTP_201_CREATED)
async def start_trace(
    body: TraceStartRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.start_trace(
        principal.tenant_id,
        body.service_name,
        body.operation,
        parent_span_id=body.parent_span_id,
        attributes=body.attributes,
        actor=principal.user_id,
    )


@router.post("/traces/finish")
async def finish_trace(
    body: TraceFinishRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    result = await svc.finish_trace(
        principal.tenant_id,
        body.span_id,
        status=body.status,
        duration_ms=body.duration_ms,
        attributes=body.attributes,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Span not found")
    return result


@router.get("/logs")
async def list_logs(
    level: Optional[str] = Query(default=None),
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> List[dict]:
    return await svc.list_logs(principal.tenant_id, level=level)


@router.post("/logs", status_code=status.HTTP_201_CREATED)
async def emit_log(
    body: LogEmitRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.emit_log(
        principal.tenant_id,
        body.level,
        body.message,
        service=body.service,
        extra=body.extra,
    )


@router.get("/alerts")
async def list_alerts(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> List[dict]:
    return await svc.list_alerts(principal.tenant_id)


@router.post("/alerts", status_code=status.HTTP_201_CREATED)
async def create_alert(
    body: AlertCreateRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.create_alert(
        principal.tenant_id,
        body.name,
        body.message,
        severity=body.severity,
        source=body.source,
        metadata=body.metadata,
        actor=principal.user_id,
    )


@router.post("/alerts/{alert_id}/acknowledge")
async def acknowledge_alert(
    alert_id: str,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    result = await svc.acknowledge_alert(principal.tenant_id, alert_id, actor=principal.user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Alert not found")
    return result


@router.get("/incidents")
async def list_incidents(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> List[dict]:
    return await svc.list_incidents(principal.tenant_id)


@router.post("/incidents", status_code=status.HTTP_201_CREATED)
async def create_incident(
    body: IncidentCreateRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.create_incident(
        principal.tenant_id,
        body.title,
        description=body.description,
        severity=body.severity,
        metadata=body.metadata,
        actor=principal.user_id,
    )


@router.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    result = await svc.get_incident(principal.tenant_id, incident_id)
    if not result:
        raise HTTPException(status_code=404, detail="Incident not found")
    return result


@router.post("/incidents/{incident_id}/acknowledge")
async def acknowledge_incident(
    incident_id: str,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    result = await svc.acknowledge_incident(
        principal.tenant_id, incident_id, actor=principal.user_id
    )
    if not result:
        raise HTTPException(status_code=404, detail="Incident not found")
    return result


@router.post("/incidents/{incident_id}/escalate")
async def escalate_incident(
    incident_id: str,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    result = await svc.escalate_incident(
        principal.tenant_id, incident_id, actor=principal.user_id
    )
    if not result:
        raise HTTPException(status_code=404, detail="Incident not found")
    return result


@router.post("/incidents/{incident_id}/resolve")
async def resolve_incident(
    incident_id: str,
    body: IncidentResolveRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    result = await svc.resolve_incident(
        principal.tenant_id, incident_id, actor=principal.user_id, rca=body.rca
    )
    if not result:
        raise HTTPException(status_code=404, detail="Incident not found")
    return result


@router.get("/governance/policies")
async def list_policies(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> List[dict]:
    return await svc.list_policies(principal.tenant_id)


@router.post("/governance/policies", status_code=status.HTTP_201_CREATED)
async def create_policy(
    body: PolicyCreateRequest,
    principal: Principal = Depends(require_permission("observability:admin")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    try:
        return await svc.create_policy(
            principal.tenant_id,
            body.name,
            body.policy_type,
            body.rules,
            metadata=body.metadata,
            actor=principal.user_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/governance/policies/{policy_id}/approve")
async def approve_policy(
    policy_id: str,
    principal: Principal = Depends(require_permission("observability:admin")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    result = await svc.approve_policy(principal.tenant_id, policy_id, actor=principal.user_id)
    if not result:
        raise HTTPException(status_code=404, detail="Policy not found")
    return result


@router.post("/governance/policies/{policy_id}/version")
async def version_policy(
    policy_id: str,
    body: PolicyVersionRequest,
    principal: Principal = Depends(require_permission("observability:admin")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    result = await svc.version_policy(
        principal.tenant_id, policy_id, body.rules, actor=principal.user_id
    )
    if not result:
        raise HTTPException(status_code=404, detail="Policy not found")
    return result


@router.get("/compliance/readiness")
async def compliance_readiness(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.compliance_readiness(principal.tenant_id)


@router.get("/compliance/reports")
async def list_compliance_reports(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> List[dict]:
    return await svc.list_compliance_reports(principal.tenant_id)


@router.post("/compliance/reports", status_code=status.HTTP_201_CREATED)
async def generate_compliance_report(
    principal: Principal = Depends(require_permission("observability:admin")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.generate_compliance_report(principal.tenant_id, actor=principal.user_id)


@router.post("/compliance/consent", status_code=status.HTTP_201_CREATED)
async def track_consent(
    body: ConsentRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.track_consent(
        principal.tenant_id,
        subject_id=body.subject_id,
        purpose=body.purpose,
        granted=body.granted,
        actor=principal.user_id,
    )


@router.post("/compliance/retention", status_code=status.HTTP_201_CREATED)
async def set_retention(
    body: RetentionRequest,
    principal: Principal = Depends(require_permission("observability:admin")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.set_retention(
        principal.tenant_id,
        resource_type=body.resource_type,
        retain_days=body.retain_days,
        legal_basis=body.legal_basis,
        actor=principal.user_id,
    )


@router.post("/compliance/deletion", status_code=status.HTTP_201_CREATED)
async def request_deletion(
    body: DeletionRequest,
    principal: Principal = Depends(require_permission("observability:admin")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.request_deletion(
        principal.tenant_id,
        subject_id=body.subject_id,
        resource_types=body.resource_types,
        actor=principal.user_id,
    )


@router.get("/compliance/export")
async def audit_export(
    principal: Principal = Depends(require_permission("observability:admin")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.audit_export(principal.tenant_id)


@router.get("/security/events")
async def list_security_events(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> List[dict]:
    return await svc.list_security_events(principal.tenant_id)


@router.post("/security/events", status_code=status.HTTP_201_CREATED)
async def record_security_event(
    body: SecurityEventRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.record_security_event(
        principal.tenant_id,
        body.event_type,
        actor=body.actor,
        ip_address=body.ip_address,
        resource=body.resource,
        details=body.details,
        token_fingerprint=body.token_fingerprint,
        signature_valid=body.signature_valid,
        secret_name=body.secret_name,
        endpoint=body.endpoint,
        acting_user=principal.user_id,
    )


@router.get("/security/ip/{ip_address}")
async def ip_reputation(
    ip_address: str,
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.ip_reputation(principal.tenant_id, ip_address)


@router.get("/diagnostics")
async def list_diagnostics(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> List[dict]:
    return await svc.list_diagnostics(principal.tenant_id)


@router.post("/diagnostics", status_code=status.HTTP_201_CREATED)
async def run_diagnostics(
    body: DiagnosticRunRequest,
    principal: Principal = Depends(require_permission("observability:write")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.run_diagnostics(
        principal.tenant_id,
        name=body.name,
        category=body.category,
        context=body.context,
        actor=principal.user_id,
    )


@router.get("/sla")
async def evaluate_sla(
    principal: Principal = Depends(require_permission("observability:read")),
    svc: ObservabilityService = Depends(_service),
) -> dict:
    return await svc.evaluate_sla(principal.tenant_id)

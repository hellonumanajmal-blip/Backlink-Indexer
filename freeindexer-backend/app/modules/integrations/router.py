"""REST API router for the Enterprise Integrations Hub.

Mounted at ``/api/integrations``. All endpoints enforce RBAC permissions and
tenant isolation via the current principal.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal, get_current_principal
from app.database import get_db
from app.modules.integrations.dtos import (
    ConnectionTestResult,
    ConnectorCapability,
    ConnectorRead,
    CredentialCreate,
    CredentialRead,
    HealthRead,
    IntegrationCreate,
    IntegrationRead,
    IntegrationUpdate,
    OverviewRead,
    SyncJobRead,
    SyncRequest,
    WebhookDeliveryRead,
    WebhookEndpointCreate,
    WebhookEndpointRead,
    InboundWebhook,
)
from app.modules.integrations.service import SUPPORTED_EVENTS, IntegrationService
from app.rbac import require_permission

router = APIRouter(prefix="/integrations", tags=["integrations"])


def _service(db: AsyncSession = Depends(get_db)) -> IntegrationService:
    return IntegrationService(db)


# ---------------------------------------------------------------------------
# Overview
# ---------------------------------------------------------------------------
@router.get("", response_model=OverviewRead)
async def get_overview(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> OverviewRead:
    return await svc.overview(principal.tenant_id)


@router.get("/events", response_model=List[str])
async def list_supported_events(
    principal: Principal = Depends(require_permission("integrations:read")),
) -> List[str]:
    return SUPPORTED_EVENTS


# ---------------------------------------------------------------------------
# Integrations CRUD
# ---------------------------------------------------------------------------
@router.get("/list", response_model=List[IntegrationRead])
async def list_integrations(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> List[IntegrationRead]:
    items = await svc.list_integrations(principal.tenant_id)
    return [IntegrationRead.model_validate(i) for i in items]


@router.post("", response_model=IntegrationRead, status_code=status.HTTP_201_CREATED)
async def create_integration(
    body: IntegrationCreate,
    principal: Principal = Depends(require_permission("integrations:write")),
    svc: IntegrationService = Depends(_service),
) -> IntegrationRead:
    try:
        integration = await svc.create_integration(
            principal.tenant_id, principal.user_id,
            name=body.name, connector_type=body.connector_type,
            config=body.config, enabled=body.enabled,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return IntegrationRead.model_validate(integration)


@router.get("/{integration_id}", response_model=IntegrationRead)
async def get_integration(
    integration_id: str,
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> IntegrationRead:
    integration = await svc.get_integration(principal.tenant_id, integration_id)
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
    return IntegrationRead.model_validate(integration)


@router.patch("/{integration_id}", response_model=IntegrationRead)
async def update_integration(
    integration_id: str,
    body: IntegrationUpdate,
    principal: Principal = Depends(require_permission("integrations:write")),
    svc: IntegrationService = Depends(_service),
) -> IntegrationRead:
    integration = await svc.update_integration(
        principal.tenant_id, principal.user_id, integration_id,
        **body.model_dump(exclude_unset=True),
    )
    if integration is None:
        raise HTTPException(status_code=404, detail="Integration not found")
    return IntegrationRead.model_validate(integration)


@router.delete("/{integration_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_integration(
    integration_id: str,
    principal: Principal = Depends(require_permission("integrations:admin")),
    svc: IntegrationService = Depends(_service),
) -> None:
    deleted = await svc.delete_integration(principal.tenant_id, principal.user_id, integration_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Integration not found")


# ---------------------------------------------------------------------------
# Connectors
# ---------------------------------------------------------------------------
@router.get("/connectors/types", response_model=List[ConnectorCapability])
async def list_connector_types(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> List[ConnectorCapability]:
    return [ConnectorCapability(**c) for c in svc.list_connector_types()]


@router.get("/connectors/{integration_id}", response_model=List[ConnectorRead])
async def list_connectors(
    integration_id: str,
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> List[ConnectorRead]:
    items = await svc.list_connectors(principal.tenant_id, integration_id)
    return [ConnectorRead.model_validate(c) for c in items]


# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------
@router.post("/credentials", response_model=CredentialRead, status_code=status.HTTP_201_CREATED)
async def store_credential(
    body: CredentialCreate,
    principal: Principal = Depends(require_permission("integrations:credentials")),
    svc: IntegrationService = Depends(_service),
) -> CredentialRead:
    try:
        cred = await svc.store_credential(
            principal.tenant_id, principal.user_id,
            integration_id=body.integration_id, kind=body.kind, secret=body.secret,
            expires_at=body.expires_at, extra=body.extra,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return CredentialRead.model_validate(cred)


@router.get("/credentials/{integration_id}", response_model=List[CredentialRead])
async def list_credentials(
    integration_id: str,
    principal: Principal = Depends(require_permission("integrations:credentials")),
    svc: IntegrationService = Depends(_service),
) -> List[CredentialRead]:
    items = await svc.list_credentials(principal.tenant_id, integration_id)
    return [CredentialRead.model_validate(c) for c in items]


@router.post("/credentials/{credential_id}/rotate", response_model=CredentialRead)
async def rotate_credential(
    credential_id: str,
    body: dict,
    principal: Principal = Depends(require_permission("integrations:credentials")),
    svc: IntegrationService = Depends(_service),
) -> CredentialRead:
    new_secret = body.get("secret")
    if not new_secret:
        raise HTTPException(status_code=400, detail="secret is required")
    cred = await svc.rotate_credential(
        principal.tenant_id, principal.user_id, credential_id, new_secret
    )
    if cred is None:
        raise HTTPException(status_code=404, detail="Credential not found")
    return CredentialRead.model_validate(cred)


@router.post("/credentials/test/{integration_id}", response_model=ConnectionTestResult)
async def test_connection(
    integration_id: str,
    principal: Principal = Depends(require_permission("integrations:credentials")),
    svc: IntegrationService = Depends(_service),
) -> ConnectionTestResult:
    return await svc.test_connection(principal.tenant_id, integration_id)


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------
@router.post("/sync", response_model=SyncJobRead, status_code=status.HTTP_202_ACCEPTED)
async def run_sync(
    body: SyncRequest,
    principal: Principal = Depends(require_permission("integrations:sync")),
    svc: IntegrationService = Depends(_service),
) -> SyncJobRead:
    try:
        job = await svc.run_sync(
            principal.tenant_id, principal.user_id,
            integration_id=body.integration_id, mode=body.mode,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return SyncJobRead.model_validate(job)


@router.get("/sync/{integration_id}", response_model=List[SyncJobRead])
async def list_sync_jobs(
    integration_id: str,
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> List[SyncJobRead]:
    jobs = await svc.list_sync_jobs(principal.tenant_id, integration_id)
    return [SyncJobRead.model_validate(j) for j in jobs]


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------
@router.post("/webhooks/endpoints", response_model=WebhookEndpointRead, status_code=status.HTTP_201_CREATED)
async def create_endpoint(
    body: WebhookEndpointCreate,
    principal: Principal = Depends(require_permission("integrations:webhooks")),
    svc: IntegrationService = Depends(_service),
) -> WebhookEndpointRead:
    endpoint = await svc.create_endpoint(
        principal.tenant_id, principal.user_id,
        direction=body.direction, url=body.url, event_types=body.event_types,
        secret=body.secret, active=body.active, filters=body.filters,
        description=body.description,
    )
    return WebhookEndpointRead.model_validate(endpoint)


@router.get("/webhooks/endpoints", response_model=List[WebhookEndpointRead])
async def list_endpoints(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> List[WebhookEndpointRead]:
    items = await svc.list_endpoints(principal.tenant_id)
    return [WebhookEndpointRead.model_validate(e) for e in items]


@router.post("/webhooks/inbound/{endpoint_id}", response_model=WebhookDeliveryRead)
async def receive_inbound(
    endpoint_id: str,
    body: InboundWebhook,
    principal: Principal = Depends(get_current_principal),
    svc: IntegrationService = Depends(_service),
) -> WebhookDeliveryRead:
    try:
        delivery = await svc.receive_inbound(
            principal.tenant_id, endpoint_id, event_type=body.event_type,
            payload=body.payload, signature=body.signature, timestamp=body.timestamp,
            idempotency_key=body.idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return WebhookDeliveryRead.model_validate(delivery)


@router.get("/webhooks/deliveries/{endpoint_id}", response_model=List[WebhookDeliveryRead])
async def list_deliveries(
    endpoint_id: str,
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> List[WebhookDeliveryRead]:
    items = await svc.list_deliveries(principal.tenant_id, endpoint_id)
    return [WebhookDeliveryRead.model_validate(d) for d in items]


@router.post("/webhooks/deliveries/{delivery_id}/retry", response_model=WebhookDeliveryRead)
async def retry_delivery(
    delivery_id: str,
    principal: Principal = Depends(require_permission("integrations:webhooks")),
    svc: IntegrationService = Depends(_service),
) -> WebhookDeliveryRead:
    delivery = await svc.retry_delivery(principal.tenant_id, delivery_id)
    if delivery is None:
        raise HTTPException(status_code=404, detail="Delivery not found")
    return WebhookDeliveryRead.model_validate(delivery)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@router.post("/health/{integration_id}", response_model=HealthRead)
async def check_health(
    integration_id: str,
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> HealthRead:
    try:
        record = await svc.check_health(principal.tenant_id, integration_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return HealthRead.model_validate(record)


@router.get("/health/{integration_id}", response_model=HealthRead)
async def latest_health(
    integration_id: str,
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: IntegrationService = Depends(_service),
) -> HealthRead:
    record = await svc.latest_health(principal.tenant_id, integration_id)
    if record is None:
        raise HTTPException(status_code=404, detail="No health record")
    return HealthRead.model_validate(record)

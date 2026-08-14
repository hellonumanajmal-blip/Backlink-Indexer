"""Pydantic DTOs for the Enterprise Integrations Hub API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Integrations
# ---------------------------------------------------------------------------
class IntegrationCreate(BaseModel):
    name: str
    connector_type: str
    config: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class IntegrationUpdate(BaseModel):
    name: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    enabled: Optional[bool] = None
    status: Optional[str] = None


class IntegrationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    connector_type: str
    status: str
    config: Dict[str, Any]
    enabled: bool
    last_synced_at: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Connectors
# ---------------------------------------------------------------------------
class ConnectorCreate(BaseModel):
    integration_id: str
    connector_type: str
    version: str = "1.0.0"
    capabilities: List[str] = Field(default_factory=list)
    config: Dict[str, Any] = Field(default_factory=dict)


class ConnectorRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    integration_id: str
    connector_type: str
    version: str
    capabilities: List[str]
    config: Dict[str, Any]
    status: str
    created_at: datetime


class ConnectorCapability(BaseModel):
    """Describes a registered connector type's metadata (from the SDK)."""

    connector_type: str
    version: str
    capabilities: List[str]
    config_schema: Dict[str, Any]
    supported: bool


# ---------------------------------------------------------------------------
# Credentials
# ---------------------------------------------------------------------------
class CredentialCreate(BaseModel):
    integration_id: str
    kind: str = "api_key"  # api_key|oauth|refresh_token|basic
    secret: str
    expires_at: Optional[datetime] = None
    extra: Dict[str, Any] = Field(default_factory=dict)


class CredentialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    integration_id: str
    kind: str
    masked_hint: Optional[str] = None
    expires_at: Optional[datetime] = None
    rotated_at: Optional[datetime] = None
    created_at: datetime


class ConnectionTestResult(BaseModel):
    ok: bool
    latency_ms: int = 0
    message: str = ""


# ---------------------------------------------------------------------------
# Sync
# ---------------------------------------------------------------------------
class SyncRequest(BaseModel):
    integration_id: str
    mode: str = "manual"  # manual|scheduled|incremental|full


class SyncJobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    integration_id: str
    mode: str
    status: str
    checkpoint: Dict[str, Any]
    stats: Dict[str, Any]
    error: Optional[str] = None
    attempts: int
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    created_at: datetime


class SyncHistoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sync_job_id: str
    integration_id: str
    mode: str
    status: str
    records_processed: int
    records_failed: int
    duration_ms: int
    created_at: datetime


# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------
class WebhookEndpointCreate(BaseModel):
    direction: str = "outbound"
    url: Optional[str] = None
    event_types: List[str] = Field(default_factory=list)
    secret: Optional[str] = None
    active: bool = True
    filters: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None


class WebhookEndpointRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    direction: str
    url: Optional[str] = None
    event_types: List[str]
    active: bool
    filters: Dict[str, Any]
    description: Optional[str] = None
    created_at: datetime


class WebhookDeliveryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    endpoint_id: str
    direction: str
    event_type: str
    status: str
    attempts: int
    response_status: Optional[int] = None
    idempotency_key: Optional[str] = None
    delivered_at: Optional[datetime] = None
    created_at: datetime


class InboundWebhook(BaseModel):
    event_type: str
    payload: Dict[str, Any] = Field(default_factory=dict)
    idempotency_key: Optional[str] = None
    signature: Optional[str] = None
    timestamp: Optional[int] = None


# ---------------------------------------------------------------------------
# Events / subscriptions
# ---------------------------------------------------------------------------
class EventSubscriptionCreate(BaseModel):
    event_types: List[str]
    url: str
    filters: Dict[str, Any] = Field(default_factory=dict)
    secret: Optional[str] = None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
class HealthRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    integration_id: str
    status: str
    score: int
    latency_ms: int
    message: Optional[str] = None
    checked_at: Optional[datetime] = None
    details: Dict[str, Any] = Field(default_factory=dict)


class OverviewRead(BaseModel):
    total_integrations: int
    active: int
    error: int
    paused: int
    total_connectors: int
    healthy_connectors: int
    sync_jobs_24h: int
    webhook_deliveries_24h: int
    supported_connector_types: List[str]

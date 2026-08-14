"""SQLAlchemy models for the Enterprise Integrations Hub (Phase 29).

Tables:
- integrations
- connectors
- connector_credentials
- sync_jobs
- sync_history
- webhook_endpoints
- webhook_deliveries
- integration_health
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Integration(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A tenant's installed integration instance."""

    __tablename__ = "integrations"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    connector_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False, index=True
    )  # pending|active|paused|error|disabled
    config: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_synced_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    connectors: Mapped[list["Connector"]] = relationship(
        back_populates="integration", cascade="all, delete-orphan"
    )
    credentials: Mapped[list["ConnectorCredential"]] = relationship(
        back_populates="integration", cascade="all, delete-orphan"
    )


class Connector(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A configured connector bound to an integration."""

    __tablename__ = "connectors"

    integration_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connector_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(50), default="1.0.0", nullable=False)
    capabilities: Mapped[Dict[str, Any]] = mapped_column(JSON, default=list, nullable=False)
    config: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)

    integration: Mapped[Integration] = relationship(back_populates="connectors")


class ConnectorCredential(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Encrypted credential material for a connector/integration."""

    __tablename__ = "connector_credentials"

    integration_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    kind: Mapped[str] = mapped_column(
        String(50), default="api_key", nullable=False
    )  # api_key|oauth|refresh_token|basic
    # Encrypted payload (Fernet token). Never store plaintext.
    secret_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    masked_hint: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rotated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    extra: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    integration: Mapped[Integration] = relationship(back_populates="credentials")


class SyncJob(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A single synchronization run."""

    __tablename__ = "sync_jobs"

    integration_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    mode: Mapped[str] = mapped_column(
        String(50), default="manual", nullable=False
    )  # manual|scheduled|incremental|full
    status: Mapped[str] = mapped_column(
        String(50), default="queued", nullable=False, index=True
    )  # queued|running|succeeded|failed|partial
    checkpoint: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    stats: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)


class SyncHistory(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Historical record of sync outcomes for auditing/reporting."""

    __tablename__ = "sync_history"

    sync_job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("sync_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    integration_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    records_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    records_failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    detail: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class WebhookEndpoint(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """An inbound or outbound webhook endpoint/subscription."""

    __tablename__ = "webhook_endpoints"

    direction: Mapped[str] = mapped_column(
        String(20), default="outbound", nullable=False
    )  # inbound|outbound
    url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    event_types: Mapped[Dict[str, Any]] = mapped_column(JSON, default=list, nullable=False)
    secret_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    filters: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class WebhookDelivery(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A single webhook delivery attempt record."""

    __tablename__ = "webhook_deliveries"

    endpoint_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("webhook_endpoints.id", ondelete="CASCADE"), nullable=False, index=True
    )
    direction: Mapped[str] = mapped_column(String(20), default="outbound", nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    idempotency_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[str] = mapped_column(
        String(50), default="pending", nullable=False, index=True
    )  # pending|delivered|failed|retrying
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    response_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class IntegrationHealth(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Latest health snapshot for an integration/connector."""

    __tablename__ = "integration_health"

    integration_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(
        String(50), default="unknown", nullable=False
    )  # healthy|degraded|warning|error|unknown
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # 0-100
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

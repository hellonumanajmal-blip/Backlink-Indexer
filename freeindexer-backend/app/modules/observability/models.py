"""Persistence models for the enterprise observability platform (Phase 34)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import JSON, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Incident(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "incidents"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    severity: Mapped[str] = mapped_column(String(40), default="medium", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="open", nullable=False, index=True)
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    escalation_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rca: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    history: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)


class Alert(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "alerts"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(120), default="system", nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(40), default="warning", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="firing", nullable=False, index=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    incident_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    routed_to: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)


class TraceRecord(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "traces"

    trace_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    span_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    parent_span_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    correlation_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    service_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    operation: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="ok", nullable=False, index=True)
    duration_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    attributes: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class Diagnostic(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "diagnostics"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), default="system", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="pass", nullable=False, index=True)
    findings: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    recommendations: Mapped[List[str]] = mapped_column(JSON, default=list, nullable=False)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)


class GovernancePolicy(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "governance_policies"

    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    policy_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="draft", nullable=False, index=True)
    rules: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    approval_status: Mapped[str] = mapped_column(String(40), default="pending", nullable=False, index=True)
    approved_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)


class ComplianceReport(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "compliance_reports"

    report_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="generated", nullable=False, index=True)
    framework: Mapped[str] = mapped_column(String(80), default="gdpr", nullable=False, index=True)
    findings: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    export_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)


class SecurityEvent(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "security_events"

    event_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(40), default="info", nullable=False, index=True)
    actor: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    resource: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="open", nullable=False, index=True)


class HealthCheck(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "health_checks"

    service_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    dependency: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(40), default="healthy", nullable=False, index=True)
    latency_ms: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    uptime_ratio: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

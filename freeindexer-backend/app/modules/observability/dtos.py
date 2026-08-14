"""Request/response DTOs for the observability API."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class MetricRecordRequest(BaseModel):
    name: str
    value: float
    labels: Dict[str, str] = Field(default_factory=dict)


class TraceStartRequest(BaseModel):
    service_name: str
    operation: str
    parent_span_id: Optional[str] = None
    attributes: Dict[str, Any] = Field(default_factory=dict)


class TraceFinishRequest(BaseModel):
    span_id: str
    status: str = "ok"
    duration_ms: float = 0.0
    attributes: Dict[str, Any] = Field(default_factory=dict)


class LogEmitRequest(BaseModel):
    level: str = "info"
    message: str
    service: str = "platform"
    extra: Dict[str, Any] = Field(default_factory=dict)


class AlertCreateRequest(BaseModel):
    name: str
    message: str
    severity: str = "warning"
    source: str = "system"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IncidentCreateRequest(BaseModel):
    title: str
    description: str = ""
    severity: str = "medium"
    metadata: Dict[str, Any] = Field(default_factory=dict)


class IncidentResolveRequest(BaseModel):
    rca: Optional[str] = None


class PolicyCreateRequest(BaseModel):
    name: str
    policy_type: str
    rules: Dict[str, Any] = Field(default_factory=dict)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PolicyVersionRequest(BaseModel):
    rules: Dict[str, Any] = Field(default_factory=dict)


class ConsentRequest(BaseModel):
    subject_id: str
    purpose: str
    granted: bool = True


class RetentionRequest(BaseModel):
    resource_type: str
    retain_days: int = 90
    legal_basis: str = "legitimate_interest"


class DeletionRequest(BaseModel):
    subject_id: str
    resource_types: Optional[List[str]] = None


class SecurityEventRequest(BaseModel):
    event_type: str
    actor: Optional[str] = None
    ip_address: Optional[str] = None
    resource: Optional[str] = None
    details: Dict[str, Any] = Field(default_factory=dict)
    token_fingerprint: Optional[str] = None
    signature_valid: Optional[bool] = None
    secret_name: Optional[str] = None
    endpoint: Optional[str] = None


class DiagnosticRunRequest(BaseModel):
    name: str = "platform_diagnostics"
    category: str = "system"
    context: Dict[str, Any] = Field(default_factory=dict)

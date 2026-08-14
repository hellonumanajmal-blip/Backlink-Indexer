"""Pydantic DTOs for the production AI Platform API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ProviderCreate(BaseModel):
    name: str
    provider_type: str
    base_url: Optional[str] = None
    enabled: bool = True
    config: Dict[str, Any] = Field(default_factory=dict)
    priority: int = 1
    concurrency_limit: int = 4
    rate_limit_per_minute: int = 60
    fallback_provider: Optional[str] = None


class ProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    provider_type: str
    base_url: Optional[str]
    enabled: bool
    config: Dict[str, Any] = Field(default_factory=dict)
    priority: int
    concurrency_limit: int
    rate_limit_per_minute: int
    fallback_provider: Optional[str]
    health_status: str
    created_at: datetime
    updated_at: datetime


class ToolCreate(BaseModel):
    name: str
    category: str
    kind: str = "internal"
    description: Optional[str] = None
    schema: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True
    source: str = "internal"
    endpoint_url: Optional[str] = None
    transport: str = "http"
    auth_scope: Optional[str] = None


class ToolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    category: str
    kind: str
    description: Optional[str]
    schema: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool
    source: str
    endpoint_url: Optional[str]
    transport: str
    auth_scope: Optional[str]
    created_at: datetime
    updated_at: datetime


class PromptTemplateCreate(BaseModel):
    name: str
    category: str
    environment: str = "prod"
    status: str = "draft"
    prompt_text: str
    variables: Dict[str, Any] = Field(default_factory=dict)
    approval_state: str = "pending"
    active: bool = True


class PromptTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    category: str
    environment: str
    status: str
    prompt_text: str
    variables: Dict[str, Any] = Field(default_factory=dict)
    approval_state: str
    active: bool
    created_at: datetime
    updated_at: datetime


class PromptVersionCreate(BaseModel):
    template_id: str
    version: str
    prompt_text: str
    changes: Dict[str, Any] = Field(default_factory=dict)
    environment: str = "prod"


class PromptVersionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    template_id: str
    version: str
    prompt_text: str
    changes: Dict[str, Any] = Field(default_factory=dict)
    approved_by: Optional[str]
    approved_at: Optional[datetime]
    test_results: Dict[str, Any] = Field(default_factory=dict)
    environment: str
    created_at: datetime
    updated_at: datetime


class KnowledgeDocumentCreate(BaseModel):
    title: str
    document_type: str = "wiki"
    source_uri: Optional[str] = None
    content_text: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class KnowledgeDocumentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    title: str
    document_type: str
    source_uri: Optional[str]
    content_text: str
    status: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ConversationCreate(BaseModel):
    agent_id: Optional[str] = None
    session_key: str
    title: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    agent_id: Optional[str]
    session_key: str
    title: Optional[str]
    status: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class MemoryRecordCreate(BaseModel):
    scope: str
    kind: str
    key: str
    content: Dict[str, Any] = Field(default_factory=dict)
    summary: Optional[str] = None
    vector_json: Optional[Dict[str, Any]] = None
    tags: List[str] = Field(default_factory=list)


class MemoryRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    scope: str
    kind: str
    key: str
    content: Dict[str, Any] = Field(default_factory=dict)
    summary: Optional[str]
    vector_json: Optional[Dict[str, Any]]
    usage_count: int
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class MCPServerCreate(BaseModel):
    name: str
    transport: str = "http"
    endpoint: Optional[str] = None
    auth_type: str = "none"
    permissions: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class MCPServerRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    transport: str
    endpoint: Optional[str]
    auth_type: str
    permissions: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool
    created_at: datetime
    updated_at: datetime


class AuditAnalyticsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    metric_name: str
    metric_value: float
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class CostRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    execution_id: Optional[str]
    provider_id: Optional[str]
    currency: str
    amount: float
    tokens: int
    latency_ms: int
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime

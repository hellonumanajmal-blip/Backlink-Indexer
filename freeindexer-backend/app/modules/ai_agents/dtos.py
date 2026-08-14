"""Pydantic DTOs for the AI Agent Platform."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class AgentCreate(BaseModel):
    name: str
    agent_type: str
    provider: str = "openai"
    status: str = "draft"
    capabilities: Dict[str, Any] = Field(default_factory=dict)
    config: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None


class AgentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    agent_type: str
    provider: str
    status: str
    capabilities: Dict[str, Any] = Field(default_factory=dict)
    config: Dict[str, Any] = Field(default_factory=dict)
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ProviderCreate(BaseModel):
    name: str
    provider_type: str
    base_url: Optional[str] = None
    enabled: bool = True
    config: Dict[str, Any] = Field(default_factory=dict)


class ProviderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    provider_type: str
    base_url: Optional[str]
    enabled: bool
    config: Dict[str, Any] = Field(default_factory=dict)
    health: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class ConversationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    agent_id: str
    session_id: str
    title: Optional[str]
    status: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class SessionCreate(BaseModel):
    agent_id: Optional[str] = None
    session_key: str
    state: Dict[str, Any] = Field(default_factory=dict)
    status: str = "open"


class SessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    agent_id: Optional[str]
    session_key: str
    state: Dict[str, Any] = Field(default_factory=dict)
    status: str
    created_at: datetime
    updated_at: datetime


class MessageCreate(BaseModel):
    role: str
    content: str
    provider: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ExecutionCreate(BaseModel):
    agent_id: str
    session_id: str
    workflow_name: str
    input_data: Dict[str, Any] = Field(default_factory=dict)
    status: str = "queued"


class ExecutionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    agent_id: str
    session_id: str
    workflow_name: str
    status: str
    input_data: Dict[str, Any] = Field(default_factory=dict)
    output_data: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str]
    metrics: Dict[str, Any] = Field(default_factory=dict)
    started_at: Optional[datetime]
    finished_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class PromptTemplateCreate(BaseModel):
    name: str
    category: str
    version: str = "1.0.0"
    prompt_text: str
    variables: Dict[str, Any] = Field(default_factory=dict)
    validation_rules: Dict[str, Any] = Field(default_factory=dict)
    scoring: Dict[str, Any] = Field(default_factory=dict)
    active: bool = True


class PromptTemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    category: str
    version: str
    prompt_text: str
    variables: Dict[str, Any] = Field(default_factory=dict)
    validation_rules: Dict[str, Any] = Field(default_factory=dict)
    scoring: Dict[str, Any] = Field(default_factory=dict)
    active: bool
    created_at: datetime
    updated_at: datetime


class MemoryCreate(BaseModel):
    scope: str
    kind: str
    key: str
    content: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)


class MemoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    scope: str
    kind: str
    key: str
    content: Dict[str, Any] = Field(default_factory=dict)
    embedding: Optional[Dict[str, Any]] = None
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ToolCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    parameters_schema: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class ToolRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    category: str
    description: Optional[str]
    parameters_schema: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool
    created_at: datetime
    updated_at: datetime


class TemplateCreate(BaseModel):
    name: str
    scope: str
    content: str
    template_schema: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)


class TemplateRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    name: str
    scope: str
    content: str
    template_schema: Dict[str, Any] = Field(default_factory=dict)
    tags: List[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class AnalyticsRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    agent_id: Optional[str]
    provider: Optional[str]
    metrics: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class CostRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    execution_id: Optional[str]
    provider: Optional[str]
    currency: str
    amount: float
    tokens: int
    latency_ms: int
    details: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime
    updated_at: datetime


class OverviewRead(BaseModel):
    agents_total: int
    sessions_total: int
    conversations_total: int
    executions_total: int
    providers_total: int
    prompts_total: int
    tools_total: int
    costs_total: float

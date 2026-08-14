"""Production persistence models for the Enterprise AI Platform."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AIPlatformProvider(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_providers"

    name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    provider_type: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    base_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    config: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    concurrency_limit: Mapped[int] = mapped_column(Integer, default=4, nullable=False)
    rate_limit_per_minute: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    health_status: Mapped[str] = mapped_column(String(40), default="unknown", nullable=False, index=True)
    fallback_provider: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)

    health: Mapped[list["AIPlatformProviderHealth"]] = relationship(
        back_populates="provider", cascade="all, delete-orphan"
    )
    executions: Mapped[list["AIPlatformAgentExecution"]] = relationship(back_populates="provider")
    cost_records: Mapped[list["AIPlatformCostRecord"]] = relationship(back_populates="provider")
    tool_definitions: Mapped[list["AIPlatformToolDefinition"]] = relationship(back_populates="provider")


class AIPlatformProviderHealth(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_provider_health"

    provider_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_platform_providers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[str] = mapped_column(String(40), default="unknown", nullable=False, index=True)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    success_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    failure_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    provider: Mapped[AIPlatformProvider] = relationship(back_populates="health")


class AIPlatformToolDefinition(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_tools"

    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(40), default="internal", nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    schema: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(80), default="internal", nullable=False)
    endpoint_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    transport: Mapped[str] = mapped_column(String(40), default="http", nullable=False)
    auth_scope: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    provider_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ai_platform_providers.id", ondelete="SET NULL"), nullable=True, index=True
    )

    provider: Mapped[Optional[AIPlatformProvider]] = relationship(back_populates="tool_definitions")
    executions: Mapped[list["AIPlatformToolExecution"]] = relationship(back_populates="tool_definition")


class AIPlatformToolExecution(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_tool_executions"

    tool_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_platform_tools.id", ondelete="CASCADE"), nullable=False, index=True
    )
    execution_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    workflow_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True, index=True)
    input_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    output_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="queued", nullable=False, index=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    rollback_applied: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    tool_definition: Mapped[AIPlatformToolDefinition] = relationship(back_populates="executions")


class AIPlatformPromptTemplate(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_prompt_templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    environment: Mapped[str] = mapped_column(String(40), default="prod", nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="draft", nullable=False, index=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    approval_state: Mapped[str] = mapped_column(String(40), default="pending", nullable=False, index=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    versions: Mapped[list["AIPlatformPromptVersion"]] = relationship(
        back_populates="template", cascade="all, delete-orphan"
    )


class AIPlatformPromptVersion(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_prompt_versions"

    template_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_platform_prompt_templates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    version: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    changes: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    approved_by: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    test_results: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    environment: Mapped[str] = mapped_column(String(40), default="prod", nullable=False, index=True)

    template: Mapped[AIPlatformPromptTemplate] = relationship(back_populates="versions")


class AIPlatformKnowledgeDocument(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_knowledge_documents"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(80), default="wiki", nullable=False, index=True)
    source_uri: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="indexed", nullable=False, index=True)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    chunks: Mapped[list["AIPlatformKnowledgeChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )
    citations: Mapped[list["AIPlatformCitation"]] = relationship(back_populates="document")


class AIPlatformKnowledgeChunk(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_knowledge_chunks"

    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_platform_knowledge_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    document: Mapped[AIPlatformKnowledgeDocument] = relationship(back_populates="chunks")
    embeddings: Mapped[list["AIPlatformEmbedding"]] = relationship(back_populates="chunk", cascade="all, delete-orphan")
    citations: Mapped[list["AIPlatformCitation"]] = relationship(back_populates="chunk")


class AIPlatformEmbedding(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_embeddings"

    chunk_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_platform_knowledge_chunks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    vector_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    dimensions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(120), nullable=False, index=True)

    chunk: Mapped[AIPlatformKnowledgeChunk] = relationship(back_populates="embeddings")


class AIPlatformCitation(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_citations"

    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_platform_knowledge_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ai_platform_knowledge_chunks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    citation_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_uri: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    section: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    document: Mapped[AIPlatformKnowledgeDocument] = relationship(back_populates="citations")
    chunk: Mapped[Optional[AIPlatformKnowledgeChunk]] = relationship(back_populates="citations")


class AIPlatformConversation(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_conversations"

    agent_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    session_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(40), default="active", nullable=False, index=True)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    messages: Mapped[list["AIPlatformConversationMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )
    executions: Mapped[list["AIPlatformAgentExecution"]] = relationship(back_populates="conversation")


class AIPlatformConversationMessage(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_conversation_messages"

    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_platform_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    conversation: Mapped[AIPlatformConversation] = relationship(back_populates="messages")


class AIPlatformMemoryRecord(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_memory_records"

    scope: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    content: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    vector_json: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict, nullable=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    tags: Mapped[Dict[str, Any]] = mapped_column(JSON, default=list, nullable=False)


class AIPlatformMCPServer(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_mcp_servers"

    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    transport: Mapped[str] = mapped_column(String(40), default="http", nullable=False, index=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    auth_type: Mapped[str] = mapped_column(String(40), default="none", nullable=False)
    permissions: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    connections: Mapped[list["AIPlatformMCPConnection"]] = relationship(
        back_populates="server", cascade="all, delete-orphan"
    )


class AIPlatformMCPConnection(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_mcp_connections"

    server_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("ai_platform_mcp_servers.id", ondelete="CASCADE"), nullable=False, index=True
    )
    connection_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="connected", nullable=False, index=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    auth_token_ref: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    server: Mapped[AIPlatformMCPServer] = relationship(back_populates="connections")


class AIPlatformAgentExecution(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_agent_executions"

    provider_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ai_platform_providers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    conversation_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ai_platform_conversations.id", ondelete="SET NULL"), nullable=True, index=True
    )
    workflow_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), default="queued", nullable=False, index=True)
    input_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    output_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metrics: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    provider: Mapped[Optional[AIPlatformProvider]] = relationship(back_populates="executions")
    conversation: Mapped[Optional[AIPlatformConversation]] = relationship(back_populates="executions")
    cost_records: Mapped[list["AIPlatformCostRecord"]] = relationship(back_populates="execution")


class AIPlatformAnalytics(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_analytics"

    provider_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ai_platform_providers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    tool_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ai_platform_tools.id", ondelete="SET NULL"), nullable=True, index=True
    )
    execution_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ai_platform_agent_executions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    metric_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    metric_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)


class AIPlatformCostRecord(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "ai_platform_cost_records"

    execution_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ai_platform_agent_executions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    provider_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("ai_platform_providers.id", ondelete="SET NULL"), nullable=True, index=True
    )
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    execution: Mapped[Optional[AIPlatformAgentExecution]] = relationship(back_populates="cost_records")
    provider: Mapped[Optional[AIPlatformProvider]] = relationship(back_populates="cost_records")

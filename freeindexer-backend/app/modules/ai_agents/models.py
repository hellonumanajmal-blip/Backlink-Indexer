"""SQLAlchemy models for the Enterprise AI Agent Platform (Phase 30)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class AIAgent(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "agents"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    agent_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="draft", nullable=False, index=True)
    capabilities: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    config: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    conversations: Mapped[list["AIConversation"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )
    executions: Mapped[list["AIExecution"]] = relationship(
        back_populates="agent", cascade="all, delete-orphan"
    )


class AIConversation(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "conversations"

    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    conversation_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    agent: Mapped[AIAgent] = relationship(back_populates="conversations")
    messages: Mapped[list["AIMessage"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class AIMessage(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "messages"

    conversation_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    message_metadata: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    conversation: Mapped[AIConversation] = relationship(back_populates="messages")


class AIExecution(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "executions"

    agent_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    session_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    workflow_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="queued", nullable=False, index=True)
    input_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    output_data: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metrics: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    agent: Mapped[AIAgent] = relationship(back_populates="executions")


class AIProvider(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "providers"

    name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    provider_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    base_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    config: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    health: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class PromptTemplate(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "prompts"

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    version: Mapped[str] = mapped_column(String(50), default="1.0.0", nullable=False)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    validation_rules: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    scoring: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AITemplate(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "templates"

    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    scope: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    schema: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    tags: Mapped[Dict[str, Any]] = mapped_column(JSON, default=list, nullable=False)


class AIMemory(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "memories"

    scope: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    content: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    embedding: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict, nullable=True)
    tags: Mapped[Dict[str, Any]] = mapped_column(JSON, default=list, nullable=False)


class AITool(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "tools"

    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    schema: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class AIAnalyticsSnapshot(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "analytics"

    agent_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    period_start: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    metrics: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class AICostRecord(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "costs"

    execution_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    currency: Mapped[str] = mapped_column(String(10), default="USD", nullable=False)
    amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tokens: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class AISession(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "sessions"

    agent_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True, index=True)
    session_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    state: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="open", nullable=False, index=True)

"""Persistence models for the enterprise knowledge platform."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import JSON, String, Text, ForeignKey, Integer, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin


class KnowledgeProviderConfig(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "knowledge_provider_configs"

    provider_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    config: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class KnowledgeDocument(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "knowledge_documents"

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    document_type: Mapped[str] = mapped_column(String(80), default="wiki", nullable=False, index=True)
    source_uri: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(40), default="indexed", nullable=False, index=True)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    chunks: Mapped[list["KnowledgeChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan"
    )
    citations: Mapped[list["KnowledgeCitation"]] = relationship(back_populates="document")


class KnowledgeChunk(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "knowledge_chunks"

    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

    document: Mapped[KnowledgeDocument] = relationship(back_populates="chunks")
    embeddings: Mapped[list["KnowledgeEmbedding"]] = relationship(back_populates="chunk", cascade="all, delete-orphan")
    citations: Mapped[list["KnowledgeCitation"]] = relationship(back_populates="chunk")


class KnowledgeEmbedding(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "knowledge_embeddings"

    chunk_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("knowledge_chunks.id", ondelete="CASCADE"), nullable=False, index=True
    )
    model_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    vector_json: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    dimensions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_hash: Mapped[str] = mapped_column(String(120), nullable=False, index=True)

    chunk: Mapped[KnowledgeChunk] = relationship(back_populates="embeddings")


class KnowledgeCitation(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "knowledge_citations"

    document_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("knowledge_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    chunk_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("knowledge_chunks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    citation_text: Mapped[str] = mapped_column(Text, nullable=False)
    source_uri: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    section: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    document: Mapped[KnowledgeDocument] = relationship(back_populates="citations")
    chunk: Mapped[Optional[KnowledgeChunk]] = relationship(back_populates="citations")


class KnowledgeRetrievalLog(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "knowledge_retrieval_logs"

    query: Mapped[str] = mapped_column(Text, nullable=False)
    results: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)


class KnowledgeAnalytics(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "knowledge_analytics"

    metric_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    metric_value: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    metadata_payload: Mapped[Dict[str, Any]] = mapped_column("metadata", JSON, default=dict, nullable=False)

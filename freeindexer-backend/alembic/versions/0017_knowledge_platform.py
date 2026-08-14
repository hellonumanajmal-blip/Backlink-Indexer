"""Phase 33 enterprise knowledge platform persistence

Revision ID: 0017
Revises: 0016
Create Date: 2026-08-04
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017"
down_revision: Union[str, None] = "0016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_provider_configs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("provider_name", sa.String(120), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_knowledge_provider_configs_tenant_id",
        "knowledge_provider_configs",
        ["tenant_id"],
    )
    op.create_index(
        "ix_knowledge_provider_configs_provider_name",
        "knowledge_provider_configs",
        ["provider_name"],
    )

    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("document_type", sa.String(80), nullable=False, server_default="wiki"),
        sa.Column("source_uri", sa.String(2048), nullable=True),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="indexed"),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_knowledge_documents_tenant_id",
        "knowledge_documents",
        ["tenant_id"],
    )
    op.create_index(
        "ix_knowledge_documents_title",
        "knowledge_documents",
        ["title"],
    )
    op.create_index(
        "ix_knowledge_documents_document_type",
        "knowledge_documents",
        ["document_type"],
    )
    op.create_index(
        "ix_knowledge_documents_status",
        "knowledge_documents",
        ["status"],
    )

    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_knowledge_chunks_tenant_id",
        "knowledge_chunks",
        ["tenant_id"],
    )
    op.create_index(
        "ix_knowledge_chunks_document_id",
        "knowledge_chunks",
        ["document_id"],
    )
    op.create_index(
        "ix_knowledge_chunks_chunk_index",
        "knowledge_chunks",
        ["chunk_index"],
    )

    op.create_table(
        "knowledge_embeddings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "chunk_id",
            sa.String(36),
            sa.ForeignKey("knowledge_chunks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("model_name", sa.String(120), nullable=False),
        sa.Column("vector_json", sa.JSON(), nullable=False),
        sa.Column("dimensions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_hash", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_knowledge_embeddings_tenant_id",
        "knowledge_embeddings",
        ["tenant_id"],
    )
    op.create_index(
        "ix_knowledge_embeddings_chunk_id",
        "knowledge_embeddings",
        ["chunk_id"],
    )
    op.create_index(
        "ix_knowledge_embeddings_model_name",
        "knowledge_embeddings",
        ["model_name"],
    )
    op.create_index(
        "ix_knowledge_embeddings_content_hash",
        "knowledge_embeddings",
        ["content_hash"],
    )

    op.create_table(
        "knowledge_citations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("knowledge_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chunk_id",
            sa.String(36),
            sa.ForeignKey("knowledge_chunks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("citation_text", sa.Text(), nullable=False),
        sa.Column("source_uri", sa.String(2048), nullable=True),
        sa.Column("section", sa.String(120), nullable=True),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_knowledge_citations_tenant_id",
        "knowledge_citations",
        ["tenant_id"],
    )
    op.create_index(
        "ix_knowledge_citations_document_id",
        "knowledge_citations",
        ["document_id"],
    )
    op.create_index(
        "ix_knowledge_citations_chunk_id",
        "knowledge_citations",
        ["chunk_id"],
    )

    op.create_table(
        "knowledge_retrieval_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("query", sa.Text(), nullable=False),
        sa.Column("results", sa.JSON(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_knowledge_retrieval_logs_tenant_id",
        "knowledge_retrieval_logs",
        ["tenant_id"],
    )

    op.create_table(
        "knowledge_analytics",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("metric_name", sa.String(120), nullable=False),
        sa.Column("metric_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_knowledge_analytics_tenant_id",
        "knowledge_analytics",
        ["tenant_id"],
    )
    op.create_index(
        "ix_knowledge_analytics_metric_name",
        "knowledge_analytics",
        ["metric_name"],
    )


def downgrade() -> None:
    op.drop_table("knowledge_analytics")
    op.drop_table("knowledge_retrieval_logs")
    op.drop_table("knowledge_citations")
    op.drop_table("knowledge_embeddings")
    op.drop_table("knowledge_chunks")
    op.drop_table("knowledge_documents")
    op.drop_table("knowledge_provider_configs")

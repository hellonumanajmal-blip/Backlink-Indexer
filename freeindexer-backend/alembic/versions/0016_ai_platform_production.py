"""Phase 32 production AI platform persistence

Revision ID: 0016
Revises: 0015
Create Date: 2026-08-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016"
down_revision: Union[str, None] = "0015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_platform_providers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("provider_type", sa.String(80), nullable=False),
        sa.Column("base_url", sa.String(2048), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("concurrency_limit", sa.Integer(), nullable=False, server_default="4"),
        sa.Column("rate_limit_per_minute", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("health_status", sa.String(40), nullable=False, server_default="unknown"),
        sa.Column("fallback_provider", sa.String(120), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_providers_tenant_id", "ai_platform_providers", ["tenant_id"])
    op.create_index("ix_ai_platform_providers_name", "ai_platform_providers", ["name"])
    op.create_index("ix_ai_platform_providers_provider_type", "ai_platform_providers", ["provider_type"])
    op.create_index("ix_ai_platform_providers_enabled", "ai_platform_providers", ["enabled"])
    op.create_index("ix_ai_platform_providers_health_status", "ai_platform_providers", ["health_status"])

    op.create_table(
        "ai_platform_provider_health",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "provider_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_providers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(40), nullable=False, server_default="unknown"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("success_rate", sa.Float(), nullable=False, server_default="0"),
        sa.Column("failure_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_provider_health_tenant_id", "ai_platform_provider_health", ["tenant_id"])
    op.create_index("ix_ai_platform_provider_health_provider_id", "ai_platform_provider_health", ["provider_id"])
    op.create_index("ix_ai_platform_provider_health_status", "ai_platform_provider_health", ["status"])

    op.create_table(
        "ai_platform_tools",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False, server_default="internal"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("schema", sa.JSON(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("source", sa.String(80), nullable=False, server_default="internal"),
        sa.Column("endpoint_url", sa.String(2048), nullable=True),
        sa.Column("transport", sa.String(40), nullable=False, server_default="http"),
        sa.Column("auth_scope", sa.String(80), nullable=True),
        sa.Column(
            "provider_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_providers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_tools_tenant_id", "ai_platform_tools", ["tenant_id"])
    op.create_index("ix_ai_platform_tools_name", "ai_platform_tools", ["name"])
    op.create_index("ix_ai_platform_tools_category", "ai_platform_tools", ["category"])
    op.create_index("ix_ai_platform_tools_kind", "ai_platform_tools", ["kind"])
    op.create_index("ix_ai_platform_tools_enabled", "ai_platform_tools", ["enabled"])
    op.create_index("ix_ai_platform_tools_provider_id", "ai_platform_tools", ["provider_id"])

    op.create_table(
        "ai_platform_tool_executions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "tool_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_tools.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("execution_id", sa.String(36), nullable=True),
        sa.Column("workflow_name", sa.String(150), nullable=True),
        sa.Column("input_data", sa.JSON(), nullable=False),
        sa.Column("output_data", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="queued"),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rollback_applied", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_tool_executions_tenant_id", "ai_platform_tool_executions", ["tenant_id"])
    op.create_index("ix_ai_platform_tool_executions_tool_id", "ai_platform_tool_executions", ["tool_id"])
    op.create_index("ix_ai_platform_tool_executions_status", "ai_platform_tool_executions", ["status"])
    op.create_index("ix_ai_platform_tool_executions_workflow_name", "ai_platform_tool_executions", ["workflow_name"])

    op.create_table(
        "ai_platform_prompt_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("category", sa.String(80), nullable=False),
        sa.Column("environment", sa.String(40), nullable=False, server_default="prod"),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("variables", sa.JSON(), nullable=False),
        sa.Column("approval_state", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_prompt_templates_tenant_id", "ai_platform_prompt_templates", ["tenant_id"])
    op.create_index("ix_ai_platform_prompt_templates_name", "ai_platform_prompt_templates", ["name"])
    op.create_index("ix_ai_platform_prompt_templates_category", "ai_platform_prompt_templates", ["category"])
    op.create_index("ix_ai_platform_prompt_templates_environment", "ai_platform_prompt_templates", ["environment"])
    op.create_index("ix_ai_platform_prompt_templates_status", "ai_platform_prompt_templates", ["status"])
    op.create_index("ix_ai_platform_prompt_templates_approval_state", "ai_platform_prompt_templates", ["approval_state"])

    op.create_table(
        "ai_platform_prompt_versions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "template_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_prompt_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("changes", sa.JSON(), nullable=False),
        sa.Column("approved_by", sa.String(120), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("test_results", sa.JSON(), nullable=False),
        sa.Column("environment", sa.String(40), nullable=False, server_default="prod"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_prompt_versions_tenant_id", "ai_platform_prompt_versions", ["tenant_id"])
    op.create_index("ix_ai_platform_prompt_versions_template_id", "ai_platform_prompt_versions", ["template_id"])
    op.create_index("ix_ai_platform_prompt_versions_version", "ai_platform_prompt_versions", ["version"])
    op.create_index("ix_ai_platform_prompt_versions_environment", "ai_platform_prompt_versions", ["environment"])

    op.create_table(
        "ai_platform_knowledge_documents",
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
    op.create_index("ix_ai_platform_knowledge_documents_tenant_id", "ai_platform_knowledge_documents", ["tenant_id"])
    op.create_index("ix_ai_platform_knowledge_documents_title", "ai_platform_knowledge_documents", ["title"])
    op.create_index("ix_ai_platform_knowledge_documents_document_type", "ai_platform_knowledge_documents", ["document_type"])
    op.create_index("ix_ai_platform_knowledge_documents_status", "ai_platform_knowledge_documents", ["status"])

    op.create_table(
        "ai_platform_knowledge_chunks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_knowledge_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_knowledge_chunks_tenant_id", "ai_platform_knowledge_chunks", ["tenant_id"])
    op.create_index("ix_ai_platform_knowledge_chunks_document_id", "ai_platform_knowledge_chunks", ["document_id"])
    op.create_index("ix_ai_platform_knowledge_chunks_chunk_index", "ai_platform_knowledge_chunks", ["chunk_index"])

    op.create_table(
        "ai_platform_embeddings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "chunk_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_knowledge_chunks.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("model_name", sa.String(120), nullable=False),
        sa.Column("vector_json", sa.JSON(), nullable=False),
        sa.Column("dimensions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_hash", sa.String(120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_embeddings_tenant_id", "ai_platform_embeddings", ["tenant_id"])
    op.create_index("ix_ai_platform_embeddings_chunk_id", "ai_platform_embeddings", ["chunk_id"])
    op.create_index("ix_ai_platform_embeddings_model_name", "ai_platform_embeddings", ["model_name"])
    op.create_index("ix_ai_platform_embeddings_content_hash", "ai_platform_embeddings", ["content_hash"])

    op.create_table(
        "ai_platform_citations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "document_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_knowledge_documents.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chunk_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_knowledge_chunks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("citation_text", sa.Text(), nullable=False),
        sa.Column("source_uri", sa.String(2048), nullable=True),
        sa.Column("section", sa.String(120), nullable=True),
        sa.Column("score", sa.Float(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_citations_tenant_id", "ai_platform_citations", ["tenant_id"])
    op.create_index("ix_ai_platform_citations_document_id", "ai_platform_citations", ["document_id"])
    op.create_index("ix_ai_platform_citations_chunk_id", "ai_platform_citations", ["chunk_id"])

    op.create_table(
        "ai_platform_conversations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("agent_id", sa.String(36), nullable=True),
        sa.Column("session_key", sa.String(120), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("status", sa.String(40), nullable=False, server_default="active"),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_conversations_tenant_id", "ai_platform_conversations", ["tenant_id"])
    op.create_index("ix_ai_platform_conversations_agent_id", "ai_platform_conversations", ["agent_id"])
    op.create_index("ix_ai_platform_conversations_session_key", "ai_platform_conversations", ["session_key"])
    op.create_index("ix_ai_platform_conversations_status", "ai_platform_conversations", ["status"])

    op.create_table(
        "ai_platform_conversation_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "conversation_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(40), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("provider", sa.String(120), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_conversation_messages_tenant_id", "ai_platform_conversation_messages", ["tenant_id"])
    op.create_index("ix_ai_platform_conversation_messages_conversation_id", "ai_platform_conversation_messages", ["conversation_id"])
    op.create_index("ix_ai_platform_conversation_messages_role", "ai_platform_conversation_messages", ["role"])
    op.create_index("ix_ai_platform_conversation_messages_provider", "ai_platform_conversation_messages", ["provider"])

    op.create_table(
        "ai_platform_memory_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("scope", sa.String(50), nullable=False),
        sa.Column("kind", sa.String(50), nullable=False),
        sa.Column("key", sa.String(255), nullable=False),
        sa.Column("content", sa.JSON(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("vector_json", sa.JSON(), nullable=True),
        sa.Column("usage_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("tags", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_memory_records_tenant_id", "ai_platform_memory_records", ["tenant_id"])
    op.create_index("ix_ai_platform_memory_records_scope", "ai_platform_memory_records", ["scope"])
    op.create_index("ix_ai_platform_memory_records_kind", "ai_platform_memory_records", ["kind"])
    op.create_index("ix_ai_platform_memory_records_key", "ai_platform_memory_records", ["key"])

    op.create_table(
        "ai_platform_mcp_servers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(150), nullable=False),
        sa.Column("transport", sa.String(40), nullable=False, server_default="http"),
        sa.Column("endpoint", sa.String(2048), nullable=True),
        sa.Column("auth_type", sa.String(40), nullable=False, server_default="none"),
        sa.Column("permissions", sa.JSON(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_mcp_servers_tenant_id", "ai_platform_mcp_servers", ["tenant_id"])
    op.create_index("ix_ai_platform_mcp_servers_name", "ai_platform_mcp_servers", ["name"])
    op.create_index("ix_ai_platform_mcp_servers_transport", "ai_platform_mcp_servers", ["transport"])
    op.create_index("ix_ai_platform_mcp_servers_enabled", "ai_platform_mcp_servers", ["enabled"])

    op.create_table(
        "ai_platform_mcp_connections",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "server_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_mcp_servers.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("connection_name", sa.String(150), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="connected"),
        sa.Column("endpoint", sa.String(2048), nullable=True),
        sa.Column("auth_token_ref", sa.String(255), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_mcp_connections_tenant_id", "ai_platform_mcp_connections", ["tenant_id"])
    op.create_index("ix_ai_platform_mcp_connections_server_id", "ai_platform_mcp_connections", ["server_id"])
    op.create_index("ix_ai_platform_mcp_connections_status", "ai_platform_mcp_connections", ["status"])

    op.create_table(
        "ai_platform_agent_executions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "provider_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_providers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "conversation_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_conversations.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("workflow_name", sa.String(150), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="queued"),
        sa.Column("input_data", sa.JSON(), nullable=False),
        sa.Column("output_data", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("metrics", sa.JSON(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_agent_executions_tenant_id", "ai_platform_agent_executions", ["tenant_id"])
    op.create_index("ix_ai_platform_agent_executions_provider_id", "ai_platform_agent_executions", ["provider_id"])
    op.create_index("ix_ai_platform_agent_executions_conversation_id", "ai_platform_agent_executions", ["conversation_id"])
    op.create_index("ix_ai_platform_agent_executions_workflow_name", "ai_platform_agent_executions", ["workflow_name"])
    op.create_index("ix_ai_platform_agent_executions_status", "ai_platform_agent_executions", ["status"])

    op.create_table(
        "ai_platform_analytics",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "provider_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_providers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "tool_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_tools.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "execution_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_agent_executions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("metric_name", sa.String(120), nullable=False),
        sa.Column("metric_value", sa.Float(), nullable=False, server_default="0"),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_analytics_tenant_id", "ai_platform_analytics", ["tenant_id"])
    op.create_index("ix_ai_platform_analytics_metric_name", "ai_platform_analytics", ["metric_name"])
    op.create_index("ix_ai_platform_analytics_provider_id", "ai_platform_analytics", ["provider_id"])
    op.create_index("ix_ai_platform_analytics_tool_id", "ai_platform_analytics", ["tool_id"])

    op.create_table(
        "ai_platform_cost_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "execution_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_agent_executions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "provider_id",
            sa.String(36),
            sa.ForeignKey("ai_platform_providers.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("currency", sa.String(10), nullable=False, server_default="USD"),
        sa.Column("amount", sa.Float(), nullable=False, server_default="0"),
        sa.Column("tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ai_platform_cost_records_tenant_id", "ai_platform_cost_records", ["tenant_id"])
    op.create_index("ix_ai_platform_cost_records_execution_id", "ai_platform_cost_records", ["execution_id"])
    op.create_index("ix_ai_platform_cost_records_provider_id", "ai_platform_cost_records", ["provider_id"])


def downgrade() -> None:
    op.drop_table("ai_platform_cost_records")
    op.drop_table("ai_platform_analytics")
    op.drop_table("ai_platform_agent_executions")
    op.drop_table("ai_platform_mcp_connections")
    op.drop_table("ai_platform_mcp_servers")
    op.drop_table("ai_platform_memory_records")
    op.drop_table("ai_platform_conversation_messages")
    op.drop_table("ai_platform_conversations")
    op.drop_table("ai_platform_citations")
    op.drop_table("ai_platform_embeddings")
    op.drop_table("ai_platform_knowledge_chunks")
    op.drop_table("ai_platform_knowledge_documents")
    op.drop_table("ai_platform_prompt_versions")
    op.drop_table("ai_platform_prompt_templates")
    op.drop_table("ai_platform_tool_executions")
    op.drop_table("ai_platform_tools")
    op.drop_table("ai_platform_provider_health")
    op.drop_table("ai_platform_providers")

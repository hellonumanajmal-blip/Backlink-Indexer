"""enterprise integrations hub

Revision ID: 0014
Revises: 0013
Create Date: 2026-08-04

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "integrations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("connector_type", sa.String(100), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_integrations_tenant_id", "integrations", ["tenant_id"])
    op.create_index("ix_integrations_connector_type", "integrations", ["connector_type"])
    op.create_index("ix_integrations_status", "integrations", ["status"])

    op.create_table(
        "connectors",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "integration_id",
            sa.String(36),
            sa.ForeignKey("integrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("connector_type", sa.String(100), nullable=False),
        sa.Column("version", sa.String(50), nullable=False, server_default="1.0.0"),
        sa.Column("capabilities", sa.JSON(), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(50), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_connectors_tenant_id", "connectors", ["tenant_id"])
    op.create_index("ix_connectors_integration_id", "connectors", ["integration_id"])

    op.create_table(
        "connector_credentials",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "integration_id",
            sa.String(36),
            sa.ForeignKey("integrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(50), nullable=False, server_default="api_key"),
        sa.Column("secret_encrypted", sa.Text(), nullable=False),
        sa.Column("masked_hint", sa.String(64), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("extra", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_connector_credentials_tenant_id", "connector_credentials", ["tenant_id"])
    op.create_index(
        "ix_connector_credentials_integration_id", "connector_credentials", ["integration_id"]
    )

    op.create_table(
        "sync_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "integration_id",
            sa.String(36),
            sa.ForeignKey("integrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mode", sa.String(50), nullable=False, server_default="manual"),
        sa.Column("status", sa.String(50), nullable=False, server_default="queued"),
        sa.Column("checkpoint", sa.JSON(), nullable=False),
        sa.Column("stats", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sync_jobs_tenant_id", "sync_jobs", ["tenant_id"])
    op.create_index("ix_sync_jobs_integration_id", "sync_jobs", ["integration_id"])
    op.create_index("ix_sync_jobs_status", "sync_jobs", ["status"])

    op.create_table(
        "sync_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "sync_job_id",
            sa.String(36),
            sa.ForeignKey("sync_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("integration_id", sa.String(36), nullable=False),
        sa.Column("mode", sa.String(50), nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("records_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("records_failed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("detail", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_sync_history_tenant_id", "sync_history", ["tenant_id"])
    op.create_index("ix_sync_history_sync_job_id", "sync_history", ["sync_job_id"])

    op.create_table(
        "webhook_endpoints",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("direction", sa.String(20), nullable=False, server_default="outbound"),
        sa.Column("url", sa.String(2048), nullable=True),
        sa.Column("event_types", sa.JSON(), nullable=False),
        sa.Column("secret_encrypted", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("filters", sa.JSON(), nullable=False),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_webhook_endpoints_tenant_id", "webhook_endpoints", ["tenant_id"])

    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "endpoint_id",
            sa.String(36),
            sa.ForeignKey("webhook_endpoints.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("direction", sa.String(20), nullable=False, server_default="outbound"),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("idempotency_key", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("response_status", sa.Integer(), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_webhook_deliveries_tenant_id", "webhook_deliveries", ["tenant_id"])
    op.create_index("ix_webhook_deliveries_endpoint_id", "webhook_deliveries", ["endpoint_id"])
    op.create_index("ix_webhook_deliveries_event_type", "webhook_deliveries", ["event_type"])
    op.create_index(
        "ix_webhook_deliveries_idempotency_key", "webhook_deliveries", ["idempotency_key"]
    )
    op.create_index("ix_webhook_deliveries_status", "webhook_deliveries", ["status"])

    op.create_table(
        "integration_health",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "integration_id",
            sa.String(36),
            sa.ForeignKey("integrations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", sa.String(50), nullable=False, server_default="unknown"),
        sa.Column("score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("latency_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_integration_health_tenant_id", "integration_health", ["tenant_id"])
    op.create_index(
        "ix_integration_health_integration_id", "integration_health", ["integration_id"]
    )


def downgrade() -> None:
    op.drop_table("integration_health")
    op.drop_table("webhook_deliveries")
    op.drop_table("webhook_endpoints")
    op.drop_table("sync_history")
    op.drop_table("sync_jobs")
    op.drop_table("connector_credentials")
    op.drop_table("connectors")
    op.drop_table("integrations")

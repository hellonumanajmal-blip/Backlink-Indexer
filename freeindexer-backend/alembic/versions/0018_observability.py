"""Phase 34 enterprise observability platform persistence

Revision ID: 0018
Revises: 0017
Create Date: 2026-08-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0018"
down_revision: Union[str, None] = "0017"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("severity", sa.String(40), nullable=False, server_default="medium"),
        sa.Column("status", sa.String(40), nullable=False, server_default="open"),
        sa.Column("acknowledged_by", sa.String(120), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_by", sa.String(120), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("escalation_level", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rca", sa.Text(), nullable=True),
        sa.Column("history", sa.JSON(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_incidents_tenant_id", "incidents", ["tenant_id"])
    op.create_index("ix_incidents_title", "incidents", ["title"])
    op.create_index("ix_incidents_severity", "incidents", ["severity"])
    op.create_index("ix_incidents_status", "incidents", ["status"])

    op.create_table(
        "alerts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source", sa.String(120), nullable=False, server_default="system"),
        sa.Column("severity", sa.String(40), nullable=False, server_default="warning"),
        sa.Column("status", sa.String(40), nullable=False, server_default="firing"),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("incident_id", sa.String(36), nullable=True),
        sa.Column("routed_to", sa.JSON(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_alerts_tenant_id", "alerts", ["tenant_id"])
    op.create_index("ix_alerts_name", "alerts", ["name"])
    op.create_index("ix_alerts_source", "alerts", ["source"])
    op.create_index("ix_alerts_severity", "alerts", ["severity"])
    op.create_index("ix_alerts_status", "alerts", ["status"])
    op.create_index("ix_alerts_incident_id", "alerts", ["incident_id"])

    op.create_table(
        "traces",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("trace_id", sa.String(64), nullable=False),
        sa.Column("span_id", sa.String(64), nullable=False),
        sa.Column("parent_span_id", sa.String(64), nullable=True),
        sa.Column("correlation_id", sa.String(64), nullable=False),
        sa.Column("service_name", sa.String(120), nullable=False),
        sa.Column("operation", sa.String(255), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="ok"),
        sa.Column("duration_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("attributes", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_traces_tenant_id", "traces", ["tenant_id"])
    op.create_index("ix_traces_trace_id", "traces", ["trace_id"])
    op.create_index("ix_traces_span_id", "traces", ["span_id"])
    op.create_index("ix_traces_correlation_id", "traces", ["correlation_id"])
    op.create_index("ix_traces_service_name", "traces", ["service_name"])
    op.create_index("ix_traces_operation", "traces", ["operation"])
    op.create_index("ix_traces_status", "traces", ["status"])

    op.create_table(
        "diagnostics",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("category", sa.String(80), nullable=False, server_default="system"),
        sa.Column("status", sa.String(40), nullable=False, server_default="pass"),
        sa.Column("findings", sa.JSON(), nullable=False),
        sa.Column("recommendations", sa.JSON(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_diagnostics_tenant_id", "diagnostics", ["tenant_id"])
    op.create_index("ix_diagnostics_name", "diagnostics", ["name"])
    op.create_index("ix_diagnostics_category", "diagnostics", ["category"])
    op.create_index("ix_diagnostics_status", "diagnostics", ["status"])

    op.create_table(
        "governance_policies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("policy_type", sa.String(80), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("status", sa.String(40), nullable=False, server_default="draft"),
        sa.Column("rules", sa.JSON(), nullable=False),
        sa.Column("approval_status", sa.String(40), nullable=False, server_default="pending"),
        sa.Column("approved_by", sa.String(120), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_governance_policies_tenant_id", "governance_policies", ["tenant_id"])
    op.create_index("ix_governance_policies_name", "governance_policies", ["name"])
    op.create_index("ix_governance_policies_policy_type", "governance_policies", ["policy_type"])
    op.create_index("ix_governance_policies_status", "governance_policies", ["status"])
    op.create_index(
        "ix_governance_policies_approval_status", "governance_policies", ["approval_status"]
    )

    op.create_table(
        "compliance_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("report_type", sa.String(80), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="generated"),
        sa.Column("framework", sa.String(80), nullable=False, server_default="gdpr"),
        sa.Column("findings", sa.JSON(), nullable=False),
        sa.Column("export_payload", sa.JSON(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_compliance_reports_tenant_id", "compliance_reports", ["tenant_id"])
    op.create_index("ix_compliance_reports_report_type", "compliance_reports", ["report_type"])
    op.create_index("ix_compliance_reports_status", "compliance_reports", ["status"])
    op.create_index("ix_compliance_reports_framework", "compliance_reports", ["framework"])

    op.create_table(
        "security_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("severity", sa.String(40), nullable=False, server_default="info"),
        sa.Column("actor", sa.String(120), nullable=True),
        sa.Column("ip_address", sa.String(64), nullable=True),
        sa.Column("resource", sa.String(255), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_security_events_tenant_id", "security_events", ["tenant_id"])
    op.create_index("ix_security_events_event_type", "security_events", ["event_type"])
    op.create_index("ix_security_events_severity", "security_events", ["severity"])
    op.create_index("ix_security_events_actor", "security_events", ["actor"])
    op.create_index("ix_security_events_ip_address", "security_events", ["ip_address"])
    op.create_index("ix_security_events_status", "security_events", ["status"])

    op.create_table(
        "health_checks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("service_name", sa.String(120), nullable=False),
        sa.Column("dependency", sa.String(120), nullable=True),
        sa.Column("status", sa.String(40), nullable=False, server_default="healthy"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0"),
        sa.Column("uptime_ratio", sa.Float(), nullable=False, server_default="1"),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_health_checks_tenant_id", "health_checks", ["tenant_id"])
    op.create_index("ix_health_checks_service_name", "health_checks", ["service_name"])
    op.create_index("ix_health_checks_dependency", "health_checks", ["dependency"])
    op.create_index("ix_health_checks_status", "health_checks", ["status"])


def downgrade() -> None:
    op.drop_table("health_checks")
    op.drop_table("security_events")
    op.drop_table("compliance_reports")
    op.drop_table("governance_policies")
    op.drop_table("diagnostics")
    op.drop_table("traces")
    op.drop_table("alerts")
    op.drop_table("incidents")

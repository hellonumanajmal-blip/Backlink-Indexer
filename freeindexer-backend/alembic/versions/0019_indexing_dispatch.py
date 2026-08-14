"""Backlink indexing dispatch persistence (backlinks + ping_logs)

Revision ID: 0019
Revises: 0018
Create Date: 2026-08-13
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0019"
down_revision: Union[str, None] = "0018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "backlinks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("url_hash", sa.String(64), nullable=False),
        sa.Column("domain", sa.String(255), nullable=False),
        sa.Column("title", sa.String(512), nullable=True),
        sa.Column("anchor_text", sa.String(512), nullable=True),
        sa.Column("source", sa.String(80), nullable=False, server_default="manual"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("index_status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("dispatch_status", sa.String(32), nullable=False, server_default="pending"),
        sa.Column("dispatch_method", sa.String(40), nullable=True),
        sa.Column("dispatch_attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_dispatched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("external_ref", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "url_hash", name="uq_backlinks_tenant_url"),
    )
    op.create_index("ix_backlinks_tenant_id", "backlinks", ["tenant_id"])
    op.create_index("ix_backlinks_url_hash", "backlinks", ["url_hash"])
    op.create_index("ix_backlinks_domain", "backlinks", ["domain"])
    op.create_index("ix_backlinks_index_status", "backlinks", ["index_status"])
    op.create_index("ix_backlinks_dispatch_status", "backlinks", ["dispatch_status"])
    op.create_index("ix_backlinks_dispatch_method", "backlinks", ["dispatch_method"])

    op.create_table(
        "ping_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "backlink_id",
            sa.String(36),
            sa.ForeignKey("backlinks.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("method", sa.String(40), nullable=False),
        sa.Column("endpoint", sa.String(512), nullable=True),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("response_code", sa.Integer(), nullable=True),
        sa.Column("response_body", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("attempt", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("duration_ms", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("external_ref", sa.String(255), nullable=True),
        sa.Column("request_payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ping_logs_tenant_id", "ping_logs", ["tenant_id"])
    op.create_index("ix_ping_logs_backlink_id", "ping_logs", ["backlink_id"])
    op.create_index("ix_ping_logs_method", "ping_logs", ["method"])
    op.create_index("ix_ping_logs_status", "ping_logs", ["status"])
    op.create_index("ix_ping_logs_response_code", "ping_logs", ["response_code"])


def downgrade() -> None:
    op.drop_table("ping_logs")
    op.drop_table("backlinks")

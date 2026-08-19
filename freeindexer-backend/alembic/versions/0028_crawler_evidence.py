"""Add crawler evidence verification (access log + attempt metadata)

Revision ID: 0028
Revises: 0027
Create Date: 2026-08-19

Adds:
- ``discovery_access_logs`` table recording inbound requests to the public
  discovery pages (salted IP hash, UA class, verified Googlebot flag set
  only after PTR + forward DNS verification).
- ``verification_attempts`` columns for crawler evidence metadata:
  crawler_user_agent, requested_url, verification_source.
"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0028"
down_revision: str | None = "0027"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "discovery_access_logs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.Column("url_hash", sa.String(64), nullable=True),
        sa.Column("requested_url", sa.String(2048), nullable=False),
        sa.Column("requested_path", sa.String(512), nullable=False),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("ua_class", sa.String(40), nullable=False),
        sa.Column("ip_hash", sa.String(64), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=False),
        sa.Column("referer", sa.String(2048), nullable=True),
        sa.Column("verified_googlebot", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("googlebot_hostname", sa.String(255), nullable=True),
        sa.Column("verification_source", sa.String(40), nullable=True),
    )
    op.create_index(
        "ix_discovery_access_logs_hash_verified",
        "discovery_access_logs",
        ["url_hash", "verified_googlebot"],
    )
    op.create_index(
        "ix_discovery_access_logs_created_at", "discovery_access_logs", ["created_at"]
    )
    op.create_index(
        "ix_discovery_access_logs_requested_path", "discovery_access_logs", ["requested_path"]
    )
    op.create_index("ix_discovery_access_logs_ua_class", "discovery_access_logs", ["ua_class"])

    op.add_column(
        "verification_attempts",
        sa.Column("crawler_user_agent", sa.String(255), nullable=True),
    )
    op.add_column(
        "verification_attempts",
        sa.Column("requested_url", sa.String(2048), nullable=True),
    )
    op.add_column(
        "verification_attempts",
        sa.Column("verification_source", sa.String(80), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("verification_attempts", "verification_source")
    op.drop_column("verification_attempts", "requested_url")
    op.drop_column("verification_attempts", "crawler_user_agent")
    op.drop_index("ix_discovery_access_logs_ua_class", table_name="discovery_access_logs")
    op.drop_index("ix_discovery_access_logs_requested_path", table_name="discovery_access_logs")
    op.drop_index("ix_discovery_access_logs_created_at", table_name="discovery_access_logs")
    op.drop_index("ix_discovery_access_logs_hash_verified", table_name="discovery_access_logs")
    op.drop_table("discovery_access_logs")
"""Discovery evidence, channel snapshot, crawl evidence

Revision ID: 0022
Revises: 0021
Create Date: 2026-08-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0022"
down_revision: Union[str, None] = "0021"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("indexing_jobs", sa.Column("discovery_stage", sa.String(40), nullable=True))
    op.add_column("indexing_jobs", sa.Column("discovery_quality", sa.Float(), nullable=True))
    op.add_column(
        "indexing_jobs",
        sa.Column("channel_snapshot", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.create_table(
        "crawl_evidence",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("indexing_jobs.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("url", sa.String(2048), nullable=False),
        sa.Column("crawler_identity", sa.String(80), nullable=False),
        sa.Column("user_agent", sa.String(255), nullable=True),
        sa.Column("source", sa.String(255), nullable=True),
        sa.Column("status_code", sa.Integer(), nullable=True),
        sa.Column("observed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("evidence_type", sa.String(40), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False, server_default="0"),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_crawl_evidence_tenant_id", "crawl_evidence", ["tenant_id"])
    op.create_index("ix_crawl_evidence_job_id", "crawl_evidence", ["job_id"])
    op.create_index("ix_crawl_evidence_evidence_type", "crawl_evidence", ["evidence_type"])


def downgrade() -> None:
    op.drop_table("crawl_evidence")
    op.drop_column("indexing_jobs", "channel_snapshot")
    op.drop_column("indexing_jobs", "discovery_quality")
    op.drop_column("indexing_jobs", "discovery_stage")

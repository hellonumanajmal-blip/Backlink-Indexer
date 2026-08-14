"""Empirical indexing experiment fields

Revision ID: 0025
Revises: 0024
Create Date: 2026-08-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0025"
down_revision: Union[str, None] = "0024"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("indexing_jobs", sa.Column("experiment_assigned_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("indexing_jobs", sa.Column("experiment_started_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("indexing_jobs", sa.Column("baseline_status", sa.String(40), nullable=True))
    op.add_column(
        "indexing_jobs",
        sa.Column("baseline_snapshot", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column("indexing_jobs", sa.Column("experiment_eligible", sa.Boolean(), nullable=True))
    op.add_column("indexing_jobs", sa.Column("experiment_checkpoint", sa.String(16), nullable=True))
    op.add_column("indexing_jobs", sa.Column("backlink_rel_type", sa.String(32), nullable=True))
    op.add_column("indexing_jobs", sa.Column("quality_band", sa.String(16), nullable=True))
    op.add_column("indexing_jobs", sa.Column("page_freshness", sa.String(16), nullable=True))
    op.add_column("indexing_jobs", sa.Column("indexed_before_retry", sa.Boolean(), nullable=True))
    op.create_index("ix_indexing_jobs_baseline_status", "indexing_jobs", ["baseline_status"])
    op.create_index("ix_indexing_jobs_experiment_eligible", "indexing_jobs", ["experiment_eligible"])
    op.create_index("ix_indexing_jobs_backlink_rel_type", "indexing_jobs", ["backlink_rel_type"])


def downgrade() -> None:
    op.drop_index("ix_indexing_jobs_backlink_rel_type", table_name="indexing_jobs")
    op.drop_index("ix_indexing_jobs_experiment_eligible", table_name="indexing_jobs")
    op.drop_index("ix_indexing_jobs_baseline_status", table_name="indexing_jobs")
    op.drop_column("indexing_jobs", "indexed_before_retry")
    op.drop_column("indexing_jobs", "page_freshness")
    op.drop_column("indexing_jobs", "quality_band")
    op.drop_column("indexing_jobs", "backlink_rel_type")
    op.drop_column("indexing_jobs", "experiment_checkpoint")
    op.drop_column("indexing_jobs", "experiment_eligible")
    op.drop_column("indexing_jobs", "baseline_snapshot")
    op.drop_column("indexing_jobs", "baseline_status")
    op.drop_column("indexing_jobs", "experiment_started_at")
    op.drop_column("indexing_jobs", "experiment_assigned_at")

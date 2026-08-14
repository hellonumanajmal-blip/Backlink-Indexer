"""Discovery quality, public listing, experiment groups

Revision ID: 0023
Revises: 0022
Create Date: 2026-08-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0023"
down_revision: Union[str, None] = "0022"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("indexing_jobs", sa.Column("discovery_score", sa.Integer(), nullable=True))
    op.add_column(
        "indexing_jobs",
        sa.Column("public_listed", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("indexing_jobs", sa.Column("experiment_group", sa.String(8), nullable=True))
    op.add_column(
        "indexing_jobs",
        sa.Column("js_backlink_found", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("indexing_jobs", sa.Column("canonical_status", sa.String(40), nullable=True))
    op.create_index("ix_indexing_jobs_experiment_group", "indexing_jobs", ["experiment_group"])
    op.add_column(
        "url_validations",
        sa.Column("redirect_statuses", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )


def downgrade() -> None:
    op.drop_column("url_validations", "redirect_statuses")
    op.drop_index("ix_indexing_jobs_experiment_group", table_name="indexing_jobs")
    op.drop_column("indexing_jobs", "canonical_status")
    op.drop_column("indexing_jobs", "js_backlink_found")
    op.drop_column("indexing_jobs", "experiment_group")
    op.drop_column("indexing_jobs", "public_listed")
    op.drop_column("indexing_jobs", "discovery_score")

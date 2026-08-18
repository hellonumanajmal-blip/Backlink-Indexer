"""Add discovery_eligible field to separate quality from discovery eligibility

Revision ID: 0027
Revises: 0026
Create Date: 2026-08-18

This migration separates:
- discovery_eligible: Can this URL attempt discovery? (separate from quality)
- public_listed: Should this URL be promoted to public featured feed? (UI ranking only)

Previously, public_listed was used for BOTH purposes, causing quality gates to block
discovery attempts. Now quality only affects UI presentation, not pipeline execution.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0027"
down_revision: Union[str, None] = "0026"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add discovery_eligible column to indexing_jobs
    # Default to True for existing jobs (they were eligible for discovery)
    op.add_column(
        "indexing_jobs",
        sa.Column("discovery_eligible", sa.Boolean(), nullable=False, server_default="true"),
    )
    # Create index for filtering
    op.create_index(
        "ix_indexing_jobs_discovery_eligible",
        "indexing_jobs",
        ["discovery_eligible"],
    )


def downgrade() -> None:
    op.drop_index("ix_indexing_jobs_discovery_eligible", table_name="indexing_jobs")
    op.drop_column("indexing_jobs", "discovery_eligible")

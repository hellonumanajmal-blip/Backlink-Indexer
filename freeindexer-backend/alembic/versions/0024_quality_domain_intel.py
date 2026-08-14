"""Quality, domain intelligence, workflow stage

Revision ID: 0024
Revises: 0023
Create Date: 2026-08-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0024"
down_revision: Union[str, None] = "0023"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("indexing_jobs", sa.Column("quality_score", sa.Integer(), nullable=True))
    op.add_column(
        "indexing_jobs",
        sa.Column("quality_factors", sa.JSON(), nullable=False, server_default=sa.text("'{}'")),
    )
    op.add_column(
        "indexing_jobs",
        sa.Column("quality_warnings", sa.JSON(), nullable=False, server_default=sa.text("'[]'")),
    )
    op.add_column("indexing_jobs", sa.Column("quality_recommendation", sa.Text(), nullable=True))
    op.add_column("indexing_jobs", sa.Column("workflow_stage", sa.String(40), nullable=True))
    op.add_column("indexing_jobs", sa.Column("source_domain", sa.String(255), nullable=True))
    op.create_index("ix_indexing_jobs_workflow_stage", "indexing_jobs", ["workflow_stage"])
    op.create_index("ix_indexing_jobs_source_domain", "indexing_jobs", ["source_domain"])
    op.create_table(
        "domain_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column("domain", sa.String(255), nullable=False),
        sa.Column("total_submissions", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("verified_indexed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("average_index_seconds", sa.Float(), nullable=True),
        sa.Column("success_rate", sa.Float(), nullable=True),
        sa.Column("last_submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "domain", name="uq_domain_profiles_tenant_domain"),
    )
    op.create_index("ix_domain_profiles_tenant_id", "domain_profiles", ["tenant_id"])
    op.create_index("ix_domain_profiles_domain", "domain_profiles", ["domain"])


def downgrade() -> None:
    op.drop_table("domain_profiles")
    op.drop_index("ix_indexing_jobs_source_domain", table_name="indexing_jobs")
    op.drop_index("ix_indexing_jobs_workflow_stage", table_name="indexing_jobs")
    op.drop_column("indexing_jobs", "source_domain")
    op.drop_column("indexing_jobs", "workflow_stage")
    op.drop_column("indexing_jobs", "quality_recommendation")
    op.drop_column("indexing_jobs", "quality_warnings")
    op.drop_column("indexing_jobs", "quality_factors")
    op.drop_column("indexing_jobs", "quality_score")

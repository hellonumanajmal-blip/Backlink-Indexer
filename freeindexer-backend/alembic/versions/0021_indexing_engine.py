"""Free indexing engine tables

Revision ID: 0021
Revises: 0020
Create Date: 2026-08-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0021"
down_revision: Union[str, None] = "0020"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "indexing_jobs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "backlink_id",
            sa.String(36),
            sa.ForeignKey("backlinks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("project", sa.String(120), nullable=True),
        sa.Column("source_url", sa.String(2048), nullable=False),
        sa.Column("source_url_hash", sa.String(64), nullable=False),
        sa.Column("target_url", sa.String(2048), nullable=True),
        sa.Column("property_type", sa.String(40), nullable=False, server_default="THIRD_PARTY_BACKLINK"),
        sa.Column("pipeline_status", sa.String(40), nullable=False, server_default="RECEIVED"),
        sa.Column("visibility_status", sa.String(32), nullable=False, server_default="UNKNOWN"),
        sa.Column("googlebot_visited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("our_crawler_visited", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("http_class", sa.String(40), nullable=True),
        sa.Column("crawlability_score", sa.Integer(), nullable=True),
        sa.Column("crawlability_band", sa.String(32), nullable=True),
        sa.Column("backlink_found", sa.Boolean(), nullable=True),
        sa.Column("priority_score", sa.Integer(), nullable=True),
        sa.Column("priority_band", sa.String(16), nullable=True),
        sa.Column("discovery_status", sa.String(40), nullable=True),
        sa.Column("verification_status", sa.String(40), nullable=True),
        sa.Column("verification_confidence", sa.Float(), nullable=True),
        sa.Column("verification_method", sa.String(80), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("validated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("backlink_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("discovery_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("discovery_completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("crawl_detected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verification_started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("indexed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_checked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_retry_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("tenant_id", "source_url_hash", name="uq_indexing_jobs_tenant_source"),
    )
    op.create_index("ix_indexing_jobs_tenant_id", "indexing_jobs", ["tenant_id"])
    op.create_index("ix_indexing_jobs_backlink_id", "indexing_jobs", ["backlink_id"])
    op.create_index("ix_indexing_jobs_project", "indexing_jobs", ["project"])
    op.create_index("ix_indexing_jobs_source_url_hash", "indexing_jobs", ["source_url_hash"])
    op.create_index("ix_indexing_jobs_property_type", "indexing_jobs", ["property_type"])
    op.create_index("ix_indexing_jobs_pipeline_status", "indexing_jobs", ["pipeline_status"])
    op.create_index("ix_indexing_jobs_visibility_status", "indexing_jobs", ["visibility_status"])
    op.create_index("ix_indexing_jobs_priority_score", "indexing_jobs", ["priority_score"])
    op.create_index("ix_indexing_jobs_priority_band", "indexing_jobs", ["priority_band"])
    op.create_index("ix_indexing_jobs_next_retry_at", "indexing_jobs", ["next_retry_at"])

    op.create_table(
        "indexing_status_history",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("indexing_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("from_status", sa.String(40), nullable=True),
        sa.Column("to_status", sa.String(40), nullable=False),
        sa.Column("visibility_status", sa.String(32), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("actor", sa.String(40), nullable=False, server_default="engine"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_indexing_status_history_tenant_id", "indexing_status_history", ["tenant_id"])
    op.create_index("ix_indexing_status_history_job_id", "indexing_status_history", ["job_id"])
    op.create_index("ix_indexing_status_history_to_status", "indexing_status_history", ["to_status"])

    op.create_table(
        "url_validations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("indexing_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ok", sa.Boolean(), nullable=False),
        sa.Column("classification", sa.String(40), nullable=False),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("response_time_ms", sa.Integer(), nullable=True),
        sa.Column("content_type", sa.String(255), nullable=True),
        sa.Column("content_length", sa.Integer(), nullable=True),
        sa.Column("requested_url", sa.String(2048), nullable=False),
        sa.Column("final_url", sa.String(2048), nullable=True),
        sa.Column("canonical_url", sa.String(2048), nullable=True),
        sa.Column("redirect_chain", sa.JSON(), nullable=False),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_url_validations_tenant_id", "url_validations", ["tenant_id"])
    op.create_index("ix_url_validations_job_id", "url_validations", ["job_id"])

    op.create_table(
        "backlink_inspections",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("indexing_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_url", sa.String(2048), nullable=False),
        sa.Column("target_url", sa.String(2048), nullable=False),
        sa.Column("backlink_found", sa.Boolean(), nullable=False),
        sa.Column("href", sa.String(2048), nullable=True),
        sa.Column("anchor_text", sa.String(512), nullable=True),
        sa.Column("surrounding_text", sa.Text(), nullable=True),
        sa.Column("rel_attributes", sa.String(255), nullable=True),
        sa.Column("match_type", sa.String(40), nullable=True),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=True),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_backlink_inspections_tenant_id", "backlink_inspections", ["tenant_id"])
    op.create_index("ix_backlink_inspections_job_id", "backlink_inspections", ["job_id"])

    op.create_table(
        "crawlability_reports",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("indexing_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("score", sa.Integer(), nullable=False),
        sa.Column("band", sa.String(32), nullable=False),
        sa.Column("robots_allowed", sa.Boolean(), nullable=True),
        sa.Column("meta_robots", sa.String(255), nullable=True),
        sa.Column("x_robots_tag", sa.String(255), nullable=True),
        sa.Column("canonical", sa.String(2048), nullable=True),
        sa.Column("noindex", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("nofollow", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_https", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_html", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("page_available", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("notes", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_crawlability_reports_tenant_id", "crawlability_reports", ["tenant_id"])
    op.create_index("ix_crawlability_reports_job_id", "crawlability_reports", ["job_id"])

    op.create_table(
        "discovery_attempts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("indexing_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("channel", sa.String(80), nullable=False),
        sa.Column("status", sa.String(40), nullable=False),
        sa.Column("accepted", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("response_code", sa.Integer(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_discovery_attempts_tenant_id", "discovery_attempts", ["tenant_id"])
    op.create_index("ix_discovery_attempts_job_id", "discovery_attempts", ["job_id"])
    op.create_index("ix_discovery_attempts_channel", "discovery_attempts", ["channel"])
    op.create_index("ix_discovery_attempts_status", "discovery_attempts", ["status"])

    op.create_table(
        "verification_attempts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(36), nullable=False),
        sa.Column(
            "job_id",
            sa.String(36),
            sa.ForeignKey("indexing_jobs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("method", sa.String(80), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("evidence", sa.Text(), nullable=True),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("details", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_verification_attempts_tenant_id", "verification_attempts", ["tenant_id"])
    op.create_index("ix_verification_attempts_job_id", "verification_attempts", ["job_id"])
    op.create_index("ix_verification_attempts_method", "verification_attempts", ["method"])
    op.create_index("ix_verification_attempts_status", "verification_attempts", ["status"])


def downgrade() -> None:
    op.drop_table("verification_attempts")
    op.drop_table("discovery_attempts")
    op.drop_table("crawlability_reports")
    op.drop_table("backlink_inspections")
    op.drop_table("url_validations")
    op.drop_table("indexing_status_history")
    op.drop_table("indexing_jobs")

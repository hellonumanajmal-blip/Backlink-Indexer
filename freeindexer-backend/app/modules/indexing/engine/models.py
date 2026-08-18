"""Persistence for the free indexing engine.

History tables are append-only. Updating a job never deletes prior validation,
discovery, or verification rows.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.indexing.engine.states import (
    PipelineStatus,
    PropertyType,
    VisibilityStatus,
)


class IndexingJob(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """One URL moving through the discovery / crawl / verification pipeline."""

    __tablename__ = "indexing_jobs"
    __table_args__ = (
        UniqueConstraint("tenant_id", "source_url_hash", name="uq_indexing_jobs_tenant_source"),
    )

    backlink_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("backlinks.id", ondelete="SET NULL"), nullable=True, index=True
    )
    project: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, index=True)
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    source_url_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    target_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    property_type: Mapped[str] = mapped_column(
        String(40), default=PropertyType.THIRD_PARTY_BACKLINK.value, nullable=False, index=True
    )

    pipeline_status: Mapped[str] = mapped_column(
        String(40), default=PipelineStatus.RECEIVED.value, nullable=False, index=True
    )
    visibility_status: Mapped[str] = mapped_column(
        String(32), default=VisibilityStatus.UNKNOWN.value, nullable=False, index=True
    )
    #: Never set from HTTP 200 or our own fetch. Only GSC lastCrawlTime / operator evidence.
    googlebot_visited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    our_crawler_visited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    http_class: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    crawlability_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    crawlability_band: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    backlink_found: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    priority_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    priority_band: Mapped[Optional[str]] = mapped_column(String(16), nullable=True, index=True)
    discovery_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    #: Can this URL attempt discovery (separate from public_listed which is for UI/promotion)?
    discovery_eligible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    #: Should this URL be promoted to public featured feed (for UI ranking and promotion)?
    public_listed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    experiment_group: Mapped[Optional[str]] = mapped_column(String(8), nullable=True, index=True)
    experiment_assigned_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    experiment_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    baseline_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    baseline_snapshot: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    experiment_eligible: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True, index=True)
    experiment_checkpoint: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    backlink_rel_type: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    quality_band: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    page_freshness: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    indexed_before_retry: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    js_backlink_found: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    canonical_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    quality_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quality_factors: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    quality_warnings: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    quality_recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    workflow_stage: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    source_domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)

    discovery_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    discovery_stage: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    discovery_quality: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    channel_snapshot: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    verification_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    verification_confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    verification_method: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    backlink_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    discovery_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    discovery_completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    crawl_detected_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    verification_started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    indexed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    next_retry_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )

    status_history: Mapped[list["IndexingStatusHistory"]] = relationship(
        back_populates="job", cascade="all, delete-orphan", order_by="IndexingStatusHistory.created_at"
    )


class IndexingStatusHistory(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Append-only pipeline / visibility transition log."""

    __tablename__ = "indexing_status_history"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("indexing_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_status: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    to_status: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    visibility_status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actor: Mapped[str] = mapped_column(String(40), default="engine", nullable=False)

    job: Mapped[IndexingJob] = relationship(back_populates="status_history")


class UrlValidation(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "url_validations"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("indexing_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ok: Mapped[bool] = mapped_column(Boolean, nullable=False)
    classification: Mapped[str] = mapped_column(String(40), nullable=False)
    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    response_time_ms: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    content_type: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    content_length: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    requested_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    final_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    canonical_url: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    redirect_chain: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    redirect_statuses: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class BacklinkInspection(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "backlink_inspections"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("indexing_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    target_url: Mapped[str] = mapped_column(String(2048), nullable=False)
    backlink_found: Mapped[bool] = mapped_column(Boolean, nullable=False)
    href: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    anchor_text: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    surrounding_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    rel_attributes: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    match_type: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    first_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_seen: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class CrawlabilityReport(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "crawlability_reports"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("indexing_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    band: Mapped[str] = mapped_column(String(32), nullable=False)
    robots_allowed: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    meta_robots: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    x_robots_tag: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    canonical: Mapped[Optional[str]] = mapped_column(String(2048), nullable=True)
    noindex: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    nofollow: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_https: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_html: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    page_available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class DiscoveryAttempt(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "discovery_attempts"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("indexing_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    channel: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    accepted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    response_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class CrawlEvidence(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Append-only crawl/visit evidence. Our crawler is never labelled Googlebot."""

    __tablename__ = "crawl_evidence"

    job_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("indexing_jobs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    crawler_identity: Mapped[str] = mapped_column(String(80), nullable=False)
    user_agent: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    observed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    evidence_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class VerificationAttempt(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    __tablename__ = "verification_attempts"

    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("indexing_jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    method: Mapped[str] = mapped_column(String(80), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    evidence: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)


class DomainProfile(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """Per-domain historical verification stats. Not a ranking prediction."""

    __tablename__ = "domain_profiles"
    __table_args__ = (UniqueConstraint("tenant_id", "domain", name="uq_domain_profiles_tenant_domain"),)

    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    total_submissions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    verified_indexed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    average_index_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    success_rate: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    last_submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_indexed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


__all__ = [
    "IndexingJob",
    "IndexingStatusHistory",
    "UrlValidation",
    "BacklinkInspection",
    "CrawlabilityReport",
    "DiscoveryAttempt",
    "VerificationAttempt",
    "CrawlEvidence",
    "DomainProfile",
]

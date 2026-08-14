"""DTOs for the free indexing engine API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class EngineSubmit(BaseModel):
    source_url: str
    target_url: Optional[str] = None
    project: Optional[str] = None
    run: bool = True


class EngineBulkSubmit(BaseModel):
    urls: List[str]
    target_url: Optional[str] = None
    project: Optional[str] = None
    run: bool = True


class ManualVerificationBody(BaseModel):
    status: str = Field(description="UNKNOWN | DISCOVERED | CRAWLED | INDEXED | NOT_INDEXED")
    evidence: str
    confidence: float = 0.8
    googlebot_visited: bool = False


class JobRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    backlink_id: Optional[str] = None
    project: Optional[str] = None
    source_url: str
    target_url: Optional[str] = None
    property_type: str
    pipeline_status: str
    visibility_status: str
    googlebot_visited: bool
    our_crawler_visited: bool
    http_status: Optional[int] = None
    http_class: Optional[str] = None
    crawlability_score: Optional[int] = None
    crawlability_band: Optional[str] = None
    backlink_found: Optional[bool] = None
    js_backlink_found: bool = False
    canonical_status: Optional[str] = None
    quality_score: Optional[int] = None
    quality_factors: Dict[str, Any] = Field(default_factory=dict)
    quality_warnings: List[str] = Field(default_factory=list)
    quality_recommendation: Optional[str] = None
    workflow_stage: Optional[str] = None
    source_domain: Optional[str] = None
    discovery_score: Optional[int] = None
    public_listed: bool = False
    experiment_group: Optional[str] = None
    experiment_assigned_at: Optional[datetime] = None
    experiment_started_at: Optional[datetime] = None
    baseline_status: Optional[str] = None
    experiment_eligible: Optional[bool] = None
    experiment_checkpoint: Optional[str] = None
    backlink_rel_type: Optional[str] = None
    quality_band: Optional[str] = None
    page_freshness: Optional[str] = None
    priority_score: Optional[int] = None
    priority_band: Optional[str] = None
    discovery_status: Optional[str] = None
    discovery_stage: Optional[str] = None
    discovery_quality: Optional[float] = None
    channel_snapshot: Dict[str, Any] = Field(default_factory=dict)
    verification_status: Optional[str] = None
    verification_confidence: Optional[float] = None
    verification_method: Optional[str] = None
    last_error: Optional[str] = None
    attempt_count: int
    submitted_at: Optional[datetime] = None
    validated_at: Optional[datetime] = None
    backlink_verified_at: Optional[datetime] = None
    discovery_started_at: Optional[datetime] = None
    discovery_completed_at: Optional[datetime] = None
    crawl_detected_at: Optional[datetime] = None
    verification_started_at: Optional[datetime] = None
    indexed_at: Optional[datetime] = None
    last_checked_at: Optional[datetime] = None
    next_retry_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    max_discovery: bool = False
    final_status: Optional[str] = None


class TimelineEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    from_status: Optional[str] = None
    to_status: str
    visibility_status: Optional[str] = None
    note: Optional[str] = None
    actor: str
    created_at: datetime


class JobListRead(BaseModel):
    items: List[JobRead]
    total: int
    limit: int
    offset: int


class JobDetailRead(BaseModel):
    job: JobRead
    timeline: List[TimelineEventRead]
    site_search_url: str
    validations: List[Dict[str, Any]] = Field(default_factory=list)
    inspections: List[Dict[str, Any]] = Field(default_factory=list)
    crawlability: List[Dict[str, Any]] = Field(default_factory=list)
    discovery: List[Dict[str, Any]] = Field(default_factory=list)
    verification: List[Dict[str, Any]] = Field(default_factory=list)
    crawl_evidence: List[Dict[str, Any]] = Field(default_factory=list)
    channel_cards: Dict[str, Any] = Field(default_factory=dict)
    disclaimer: str = (
        "INDEXED is only set when a verification strategy produced evidence. "
        "HTTP 200, OUR_CRAWLER_VISITED, a discovery POST, and sitemap listing "
        "never produce INDEXED. GOOGLEBOT_VISITED requires Search Console "
        "lastCrawlTime or explicit operator evidence."
    )


class DashboardRead(BaseModel):
    total: int
    validated: int
    invalid: int
    backlinks_found: int
    backlinks_missing: int
    discovery_submitted: int
    waiting_for_crawl: int
    crawled: int
    indexed: int
    not_indexed: int
    retrying: int
    failed: int
    max_discovery_mode: bool = False
    engine: str = (
        "FREE BACKLINK INDEXING OPTIMIZATION PLATFORM — "
        "Discovery Engine + Crawl Monitoring + INDEX VERIFICATION + Backlink Intelligence"
    )
    disclaimer: str = (
        "Indexed counts require verification evidence. This is not a Google indexing API "
        "and cannot force Google to index a URL. Discovery is not indexing. Crawl is not indexing."
    )


class MetricsRead(BaseModel):
    urls_submitted: int
    urls_successfully_discovered: int
    discovery_success_rate: float
    urls_verified_indexed: int
    urls_still_unknown: int
    urls_verified_not_indexed: int
    average_time_to_verification_seconds: Optional[float] = None
    average_attempts: float = 0.0
    verified_index_rate: float = 0.0
    verified_index_rate_note: str = ""
    engine_class: List[str] = Field(default_factory=list)
    experiments: Dict[str, Any] = Field(default_factory=dict)
    average_indexing_days: Optional[float] = None
    best_performing_domains: List[Dict[str, Any]] = Field(default_factory=list)
    insights: List[str] = Field(default_factory=list)


class IntelligenceRead(BaseModel):
    urls_submitted: int
    verified_indexed: int
    average_indexing_days: Optional[float] = None
    best_performing_domains: List[Dict[str, Any]] = Field(default_factory=list)
    insights: List[str] = Field(default_factory=list)
    min_sample: int = 5


class BulkJobResult(BaseModel):
    created: int
    reused: int
    jobs: List[JobRead]


class MaxDiscoveryRun(BaseModel):
    target_url: Optional[str] = None
    run: bool = True
    limit: int = 40


class MaxDiscoveryBatchResult(BaseModel):
    submitted: int
    eligible: int
    rejected: int
    discovery_published: int
    websub_accepted: int
    waiting: int
    verified_indexed: int
    unknown: int
    failed: int
    max_discovery_mode: bool
    celery: Dict[str, Any] = Field(default_factory=dict)
    jobs: List[JobRead]
    note: str = (
        "WEBSUB_ACCEPTED and HTTP 200 never mean INDEXED. "
        "This batch processes existing backlink rows only."
    )


class ExperimentEnroll(BaseModel):
    urls: List[str]
    target_url: str
    run: bool = True

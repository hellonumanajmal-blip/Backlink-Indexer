"""Persistence helpers for indexing engine jobs and append-only history."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.indexing.engine.experiments import summarize_experiments
from app.modules.indexing.engine.feeds import FeedItem
from app.modules.indexing.engine.models import (
    BacklinkInspection,
    CrawlabilityReport,
    CrawlEvidence,
    DiscoveryAttempt,
    IndexingJob,
    IndexingStatusHistory,
    UrlValidation,
    VerificationAttempt,
)
from app.modules.indexing.engine.states import PipelineStatus, VisibilityStatus, assert_transition
from app.repositories.base import BaseRepository


class IndexingJobRepository(BaseRepository[IndexingJob]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(IndexingJob, session)

    async def get_by_hash(self, tenant_id: str, source_url_hash: str) -> Optional[IndexingJob]:
        stmt = select(IndexingJob).where(
            IndexingJob.tenant_id == tenant_id,
            IndexingJob.source_url_hash == source_url_hash,
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def get_for_tenant(self, job_id: str, tenant_id: str) -> Optional[IndexingJob]:
        stmt = select(IndexingJob).where(
            IndexingJob.id == job_id, IndexingJob.tenant_id == tenant_id
        )
        return (await self.session.execute(stmt)).scalar_one_or_none()

    async def list_jobs(
        self,
        tenant_id: str,
        *,
        project: Optional[str] = None,
        pipeline_status: Optional[str] = None,
        visibility_status: Optional[str] = None,
        property_type: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[List[IndexingJob], int]:
        filters = [IndexingJob.tenant_id == tenant_id]
        if project:
            filters.append(IndexingJob.project == project)
        if pipeline_status:
            filters.append(IndexingJob.pipeline_status == pipeline_status)
        if visibility_status:
            filters.append(IndexingJob.visibility_status == visibility_status)
        if property_type:
            filters.append(IndexingJob.property_type == property_type)
        total = await self.session.scalar(
            select(func.count()).select_from(IndexingJob).where(*filters)
        )
        stmt = (
            select(IndexingJob)
            .where(*filters)
            .order_by(
                IndexingJob.priority_score.desc().nullslast(),
                IndexingJob.created_at.asc(),
            )
            .limit(limit)
            .offset(offset)
        )
        rows = (await self.session.execute(stmt)).scalars().all()
        return list(rows), int(total or 0)

    async def due_retries(self, *, now: Optional[datetime] = None, limit: int = 50) -> List[IndexingJob]:
        now = now or datetime.now(timezone.utc)
        stmt = (
            select(IndexingJob)
            .where(
                IndexingJob.pipeline_status.in_(
                    (
                        PipelineStatus.RETRY_PENDING.value,
                        PipelineStatus.BACKLINK_REMOVED.value,
                    )
                ),
                IndexingJob.next_retry_at.is_not(None),
                IndexingJob.next_retry_at <= now,
            )
            .order_by(IndexingJob.priority_score.desc().nullslast())
            .limit(limit)
        )
        return list((await self.session.execute(stmt)).scalars().all())

    async def counts(self, tenant_id: str) -> Dict[str, int]:
        jobs = (
            await self.session.execute(
                select(IndexingJob).where(IndexingJob.tenant_id == tenant_id)
            )
        ).scalars().all()
        out: Dict[str, int] = {
            "total": len(jobs),
            "validated": 0,
            "invalid": 0,
            "backlinks_found": 0,
            "backlinks_missing": 0,
            "discovery_submitted": 0,
            "waiting_for_crawl": 0,
            "crawled": 0,
            "indexed": 0,
            "not_indexed": 0,
            "retrying": 0,
            "failed": 0,
        }
        for job in jobs:
            st = job.pipeline_status
            vis = job.visibility_status
            if st in {
                PipelineStatus.VALIDATED.value,
                PipelineStatus.BACKLINK_CHECK.value,
                PipelineStatus.BACKLINK_VERIFIED.value,
                PipelineStatus.CRAWLABILITY_CHECK.value,
                PipelineStatus.DISCOVERY_QUEUED.value,
                PipelineStatus.DISCOVERY_SUBMITTED.value,
                PipelineStatus.WAITING_FOR_CRAWL.value,
                PipelineStatus.VERIFICATION_PENDING.value,
                PipelineStatus.INDEXED.value,
            }:
                out["validated"] += 1
            if st == PipelineStatus.INVALID_URL.value:
                out["invalid"] += 1
            if job.backlink_found is True:
                out["backlinks_found"] += 1
            if job.backlink_found is False:
                out["backlinks_missing"] += 1
            if st == PipelineStatus.DISCOVERY_SUBMITTED.value:
                out["discovery_submitted"] += 1
            if st == PipelineStatus.WAITING_FOR_CRAWL.value:
                out["waiting_for_crawl"] += 1
            if job.googlebot_visited or vis == "CRAWLED":
                out["crawled"] += 1
            if vis == "INDEXED" or st == PipelineStatus.INDEXED.value:
                out["indexed"] += 1
            if vis == "NOT_INDEXED" or st == PipelineStatus.NOT_INDEXED.value:
                out["not_indexed"] += 1
            if st == PipelineStatus.RETRY_PENDING.value:
                out["retrying"] += 1
            if st in {
                PipelineStatus.URL_UNREACHABLE.value,
                PipelineStatus.DISCOVERY_FAILED.value,
                PipelineStatus.VERIFICATION_FAILED.value,
                PipelineStatus.TIMEOUT.value,
                PipelineStatus.ROBOTS_BLOCKED.value,
                PipelineStatus.NOINDEX.value,
                PipelineStatus.BACKLINK_NOT_FOUND.value,
                PipelineStatus.BACKLINK_REMOVED.value,
            }:
                out["failed"] += 1
        return out

    async def metrics(self, tenant_id: str) -> Dict[str, Any]:
        jobs = (
            await self.session.execute(
                select(IndexingJob).where(IndexingJob.tenant_id == tenant_id)
            )
        ).scalars().all()
        submitted = len(jobs)
        discovered = sum(
            1
            for j in jobs
            if j.discovery_stage
            and j.discovery_stage != "NONE"
        )
        verified_indexed = sum(1 for j in jobs if j.visibility_status == VisibilityStatus.INDEXED.value)
        unknown = sum(1 for j in jobs if j.visibility_status == VisibilityStatus.UNKNOWN.value)
        not_indexed = sum(
            1 for j in jobs if j.visibility_status == VisibilityStatus.NOT_INDEXED.value
        )
        durations = []
        for job in jobs:
            if job.indexed_at and job.submitted_at:
                durations.append((job.indexed_at - job.submitted_at).total_seconds())
        attempts = [j.attempt_count for j in jobs]
        verified_index_rate = (
            round((verified_indexed / submitted) * 100, 2) if submitted else 0.0
        )
        return {
            "urls_submitted": submitted,
            "urls_successfully_discovered": discovered,
            "discovery_success_rate": round((discovered / submitted) * 100, 2) if submitted else 0.0,
            "urls_verified_indexed": verified_indexed,
            "urls_still_unknown": unknown,
            "urls_verified_not_indexed": not_indexed,
            "average_time_to_verification_seconds": (
                round(sum(durations) / len(durations), 2) if durations else None
            ),
            "average_attempts": round(sum(attempts) / len(attempts), 2) if attempts else 0.0,
            "verified_index_rate": verified_index_rate,
            "verified_index_rate_note": (
                "Verified Index Rate only includes URLs with verification evidence "
                "(Search Console, Custom Search hit, or manual evidence). "
                "It is not a prediction and is 0 until real verification data exists."
            ),
            "engine_class": [
                "DISCOVERY ENGINE",
                "CRAWL MONITORING ENGINE",
                "INDEX VERIFICATION ENGINE",
                "BACKLINK INTELLIGENCE",
            ],
            "experiments": summarize_experiments(jobs),
            "average_indexing_days": (
                round((sum(durations) / len(durations)) / 86400, 2) if durations else None
            ),
            "best_performing_domains": [],
            "insights": [
                "Insights require verified INDEXED evidence. Discovery and crawl are not indexing."
            ],
        }


async def append_history(
    session: AsyncSession,
    job: IndexingJob,
    *,
    from_status: Optional[str],
    to_status: str,
    note: Optional[str] = None,
    actor: str = "engine",
) -> IndexingStatusHistory:
    row = IndexingStatusHistory(
        tenant_id=job.tenant_id,
        job_id=job.id,
        from_status=from_status,
        to_status=to_status,
        visibility_status=job.visibility_status,
        note=note,
        actor=actor,
    )
    session.add(row)
    await session.flush()
    return row


async def transition(
    session: AsyncSession,
    job: IndexingJob,
    nxt: PipelineStatus,
    *,
    note: Optional[str] = None,
    actor: str = "engine",
) -> None:
    current = PipelineStatus(job.pipeline_status)
    assert_transition(current, nxt)
    previous = job.pipeline_status
    job.pipeline_status = nxt.value
    await append_history(
        session, job, from_status=previous, to_status=nxt.value, note=note, actor=actor
    )


async def add_validation(session: AsyncSession, row: UrlValidation) -> UrlValidation:
    session.add(row)
    await session.flush()
    return row


async def add_inspection(session: AsyncSession, row: BacklinkInspection) -> BacklinkInspection:
    session.add(row)
    await session.flush()
    return row


async def add_crawlability(session: AsyncSession, row: CrawlabilityReport) -> CrawlabilityReport:
    session.add(row)
    await session.flush()
    return row


async def add_discovery(session: AsyncSession, row: DiscoveryAttempt) -> DiscoveryAttempt:
    session.add(row)
    await session.flush()
    return row


async def add_verification(session: AsyncSession, row: VerificationAttempt) -> VerificationAttempt:
    session.add(row)
    await session.flush()
    return row


async def add_crawl_evidence(session: AsyncSession, row: CrawlEvidence) -> CrawlEvidence:
    session.add(row)
    await session.flush()
    return row


_FEED_EXCLUDE = {
    PipelineStatus.INVALID_URL.value,
    PipelineStatus.URL_UNREACHABLE.value,
    PipelineStatus.ROBOTS_BLOCKED.value,
    PipelineStatus.NOINDEX.value,
    PipelineStatus.BACKLINK_NOT_FOUND.value,
    PipelineStatus.BACKLINK_REMOVED.value,
}


async def list_feed_items(session: AsyncSession, *, limit: int = 200) -> List[FeedItem]:
    """Quality-gated public inventory. Cap prevents dumping 100k thin URLs."""
    from urllib.parse import urlparse

    from app.modules.indexing.engine.quality import job_is_feed_eligible

    fetch_limit = min(max(limit * 4, limit), 800)
    stmt = (
        select(IndexingJob)
        .where(
            IndexingJob.public_listed.is_(True),
            IndexingJob.pipeline_status.notin_(tuple(_FEED_EXCLUDE)),
        )
        .order_by(IndexingJob.submitted_at.desc().nullslast())
        .limit(fetch_limit)
    )
    jobs = list((await session.execute(stmt)).scalars().all())
    items: List[FeedItem] = []
    seen: set[str] = set()
    for job in jobs:
        if not job_is_feed_eligible(job):
            continue
        if job.source_url in seen:
            continue
        seen.add(job.source_url)
        host = (urlparse(job.source_url).hostname or "listed-host").lower()
        path = urlparse(job.source_url).path or "/"
        items.append(
            FeedItem(
                url=job.source_url,
                title=f"Public mention on {host}{path}",
                summary=(
                    f"This crawlable listing points at {job.source_url} so search crawlers "
                    "can follow a public path from our hub. Inclusion is a discovery hint, "
                    "not proof that Google crawled or indexed the destination."
                ),
                updated=job.submitted_at or job.created_at,
                id=job.source_url,
                url_hash=job.source_url_hash,
            )
        )
        if len(items) >= limit:
            break
    return items


async def get_public_by_hash(session: AsyncSession, url_hash: str) -> Optional[IndexingJob]:
    from app.modules.indexing.engine.quality import job_is_feed_eligible

    stmt = (
        select(IndexingJob)
        .where(IndexingJob.source_url_hash == url_hash, IndexingJob.public_listed.is_(True))
        .order_by(IndexingJob.submitted_at.desc().nullslast())
        .limit(1)
    )
    job = (await session.execute(stmt)).scalar_one_or_none()
    if job is None or not job_is_feed_eligible(job):
        return None
    return job


async def list_categories(session: AsyncSession, *, min_count: int = 3, limit: int = 50) -> List[Dict[str, Any]]:
    """Group quality-gated URLs by source host. Skip thin categories."""
    items = await list_feed_items(session, limit=200)
    buckets: Dict[str, List] = {}
    for item in items:
        host = (item.url.split("/")[2] if "://" in item.url else "").lower().removeprefix("www.")
        if not host:
            continue
        buckets.setdefault(host, []).append(item)
    rows = []
    for host, group in sorted(buckets.items(), key=lambda kv: len(kv[1]), reverse=True):
        if len(group) < min_count:
            continue
        rows.append(
            {
                "domain": host,
                "count": len(group),
                "path": f"/discover/category/{host}",
            }
        )
        if len(rows) >= limit:
            break
    return rows


async def list_category_items(session: AsyncSession, domain: str, *, limit: int = 50) -> List:
    items = await list_feed_items(session, limit=200)
    domain = (domain or "").lower().removeprefix("www.")
    return [item for item in items if (item.url.split("/")[2] if "://" in item.url else "").lower().removeprefix("www.") == domain][:limit]


async def timeline(session: AsyncSession, job_id: str) -> List[IndexingStatusHistory]:
    stmt = (
        select(IndexingStatusHistory)
        .where(IndexingStatusHistory.job_id == job_id)
        .order_by(IndexingStatusHistory.created_at.asc())
    )
    return list((await session.execute(stmt)).scalars().all())


async def history_bundles(
    session: AsyncSession, job_id: str
) -> Dict[str, Sequence]:
    validations = (
        await session.execute(select(UrlValidation).where(UrlValidation.job_id == job_id))
    ).scalars().all()
    inspections = (
        await session.execute(
            select(BacklinkInspection).where(BacklinkInspection.job_id == job_id)
        )
    ).scalars().all()
    crawl = (
        await session.execute(
            select(CrawlabilityReport).where(CrawlabilityReport.job_id == job_id)
        )
    ).scalars().all()
    discovery = (
        await session.execute(select(DiscoveryAttempt).where(DiscoveryAttempt.job_id == job_id))
    ).scalars().all()
    verification = (
        await session.execute(
            select(VerificationAttempt).where(VerificationAttempt.job_id == job_id)
        )
    ).scalars().all()
    crawl_evidence = (
        await session.execute(select(CrawlEvidence).where(CrawlEvidence.job_id == job_id))
    ).scalars().all()
    return {
        "validations": list(validations),
        "inspections": list(inspections),
        "crawlability": list(crawl),
        "discovery": list(discovery),
        "verification": list(verification),
        "crawl_evidence": list(crawl_evidence),
    }

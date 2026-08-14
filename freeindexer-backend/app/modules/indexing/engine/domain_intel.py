"""Domain-level historical intelligence.

Only records verified outcomes. Insights are descriptive statistics, not
predictions and not an indexing guarantee.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.indexing.engine.backlink_quality import source_domain
from app.modules.indexing.engine.models import DomainProfile, IndexingJob
from app.modules.indexing.engine.states import VisibilityStatus

MIN_SAMPLE = 5


async def get_profile(
    session: AsyncSession, tenant_id: str, domain: str
) -> Optional[DomainProfile]:
    stmt = select(DomainProfile).where(
        DomainProfile.tenant_id == tenant_id, DomainProfile.domain == domain
    )
    return (await session.execute(stmt)).scalar_one_or_none()


async def touch_submission(session: AsyncSession, tenant_id: str, url: str) -> DomainProfile:
    domain = source_domain(url)
    row = await get_profile(session, tenant_id, domain)
    if row is None:
        row = DomainProfile(
            tenant_id=tenant_id,
            domain=domain,
            total_submissions=0,
            verified_indexed=0,
        )
        session.add(row)
    row.total_submissions = int(row.total_submissions or 0) + 1
    row.last_submitted_at = datetime.now(timezone.utc)
    await session.flush()
    return row


async def record_verified_index(
    session: AsyncSession, job: IndexingJob
) -> Optional[DomainProfile]:
    if job.visibility_status != VisibilityStatus.INDEXED.value:
        return None
    domain = job.source_domain or source_domain(job.source_url)
    row = await get_profile(session, job.tenant_id, domain)
    if row is None:
        row = DomainProfile(tenant_id=job.tenant_id, domain=domain, total_submissions=1)
        session.add(row)
    row.verified_indexed = int(row.verified_indexed or 0) + 1
    row.last_indexed_at = job.indexed_at or datetime.now(timezone.utc)
    if job.indexed_at and job.submitted_at:
        delta = (job.indexed_at - job.submitted_at).total_seconds()
        n = row.verified_indexed
        prev = float(row.average_index_seconds or 0.0)
        row.average_index_seconds = ((prev * (n - 1)) + delta) / n if n else delta
    total = max(1, int(row.total_submissions or 1))
    row.success_rate = round((row.verified_indexed / total) * 100, 2)
    await session.flush()
    return row


async def domain_boost(session: AsyncSession, tenant_id: str, url: str) -> int:
    """Small historical boost for priority only. Not an index prediction."""
    row = await get_profile(session, tenant_id, source_domain(url))
    if row is None or int(row.verified_indexed or 0) < MIN_SAMPLE:
        return 0
    rate = float(row.success_rate or 0)
    if rate >= 60:
        return 10
    if rate >= 30:
        return 5
    return 0


async def list_profiles(
    session: AsyncSession, tenant_id: str, *, limit: int = 20
) -> List[DomainProfile]:
    stmt = (
        select(DomainProfile)
        .where(DomainProfile.tenant_id == tenant_id)
        .order_by(DomainProfile.verified_indexed.desc(), DomainProfile.total_submissions.desc())
        .limit(limit)
    )
    return list((await session.execute(stmt)).scalars().all())


async def historical_insights(session: AsyncSession, tenant_id: str) -> Dict[str, Any]:
    jobs = list(
        (
            await session.execute(select(IndexingJob).where(IndexingJob.tenant_id == tenant_id))
        ).scalars().all()
    )
    indexed = [
        j
        for j in jobs
        if j.visibility_status == VisibilityStatus.INDEXED.value and j.indexed_at and j.submitted_at
    ]
    durations = [(j.indexed_at - j.submitted_at).total_seconds() for j in indexed]
    profiles = await list_profiles(session, tenant_id, limit=10)
    notes: List[str] = []
    if len(indexed) < MIN_SAMPLE:
        notes.append(
            f"Only {len(indexed)} verified-indexed URL(s). Not enough history to describe typical timing."
        )
    else:
        avg_days = (sum(durations) / len(durations)) / 86400
        notes.append(
            f"Among {len(indexed)} verified-indexed URLs, average time to index was {avg_days:.1f} days."
        )
    strong = [p for p in profiles if (p.verified_indexed or 0) >= MIN_SAMPLE and (p.success_rate or 0) >= 50]
    if strong:
        hosts = ", ".join(p.domain for p in strong[:5])
        notes.append(
            f"Domains with at least {MIN_SAMPLE} verified indexed URLs and ≥50% historical rate: {hosts}."
        )
    notes.append(
        "These figures describe past verification evidence only. They do not predict Google's next decision."
    )
    return {
        "urls_submitted": len(jobs),
        "verified_indexed": len(indexed),
        "average_indexing_days": round((sum(durations) / len(durations)) / 86400, 2) if durations else None,
        "best_performing_domains": [
            {
                "domain": p.domain,
                "submitted": p.total_submissions,
                "verified_indexed": p.verified_indexed,
                "success_rate": p.success_rate,
                "average_days": round((p.average_index_seconds or 0) / 86400, 2)
                if p.average_index_seconds
                else None,
                "last_indexed_at": p.last_indexed_at.isoformat() if p.last_indexed_at else None,
            }
            for p in profiles
        ],
        "insights": notes,
        "min_sample": MIN_SAMPLE,
    }


def host_from_url(url: str) -> str:
    return (urlparse(url).hostname or "").lower()


__all__ = [
    "domain_boost",
    "historical_insights",
    "list_profiles",
    "record_verified_index",
    "touch_submission",
]

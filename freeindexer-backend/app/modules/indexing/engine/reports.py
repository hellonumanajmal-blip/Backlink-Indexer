"""Reports for the free indexing engine. Indexed % never includes unverified URLs."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, List

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.indexing.engine.repository import IndexingJobRepository
from app.modules.indexing.engine.states import PipelineStatus, VisibilityStatus


async def build_report(session: AsyncSession, tenant_id: str, project: str | None = None) -> Dict[str, Any]:
    repo = IndexingJobRepository(session)
    jobs, total = await repo.list_jobs(tenant_id, project=project, limit=10_000, offset=0)
    counts = await repo.counts(tenant_id)
    failure_reasons: Dict[str, int] = {}
    for job in jobs:
        if job.pipeline_status in {
            PipelineStatus.INVALID_URL.value,
            PipelineStatus.URL_UNREACHABLE.value,
            PipelineStatus.BACKLINK_NOT_FOUND.value,
            PipelineStatus.ROBOTS_BLOCKED.value,
            PipelineStatus.NOINDEX.value,
            PipelineStatus.DISCOVERY_FAILED.value,
            PipelineStatus.VERIFICATION_FAILED.value,
            PipelineStatus.TIMEOUT.value,
            PipelineStatus.NOT_INDEXED.value,
        }:
            failure_reasons[job.pipeline_status] = failure_reasons.get(job.pipeline_status, 0) + 1
    indexed = sum(1 for j in jobs if j.visibility_status == VisibilityStatus.INDEXED.value)
    crawled = sum(1 for j in jobs if j.googlebot_visited or j.visibility_status == VisibilityStatus.CRAWLED.value)
    retries = sum(j.attempt_count for j in jobs)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "engine": "FREE DISCOVERY + CRAWL MONITORING + INDEX VERIFICATION ENGINE",
        "project": project,
        "total_urls": total,
        "indexed": indexed,
        "indexed_percentage": round((indexed / total) * 100, 2) if total else 0.0,
        "crawled": crawled,
        "crawl_percentage": round((crawled / total) * 100, 2) if total else 0.0,
        "counts": counts,
        "failure_reasons": failure_reasons,
        "retry_statistics": {
            "total_attempts": retries,
            "jobs_retrying": counts.get("retrying", 0),
            "max_attempts_note": "Backoff: immediate, 6h, 24h, 48h, 72h; final check at 7 days.",
        },
        "disclaimer": (
            "indexed_percentage only counts URLs with verification evidence. "
            "HTTP 200 / our crawler / discovery POST / sitemap listing are not indexed."
        ),
        "urls": [_job_row(j) for j in jobs],
    }


def report_json(report: Dict[str, Any]) -> str:
    return json.dumps(report, default=str, indent=2)


def report_csv(report: Dict[str, Any]) -> str:
    buffer = io.StringIO()
    fieldnames = [
        "id",
        "source_url",
        "target_url",
        "property_type",
        "pipeline_status",
        "visibility_status",
        "http_status",
        "crawlability_score",
        "backlink_found",
        "discovery_status",
        "verification_status",
        "verification_confidence",
        "our_crawler_visited",
        "googlebot_visited",
        "attempt_count",
        "last_checked_at",
        "next_retry_at",
        "last_error",
    ]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in report.get("urls") or []:
        writer.writerow({k: row.get(k, "") for k in fieldnames})
    return buffer.getvalue()


def _job_row(job) -> Dict[str, Any]:
    return {
        "id": job.id,
        "source_url": job.source_url,
        "target_url": job.target_url,
        "property_type": job.property_type,
        "pipeline_status": job.pipeline_status,
        "visibility_status": job.visibility_status,
        "http_status": job.http_status,
        "crawlability_score": job.crawlability_score,
        "backlink_found": job.backlink_found,
        "discovery_status": job.discovery_status,
        "verification_status": job.verification_status,
        "verification_confidence": job.verification_confidence,
        "our_crawler_visited": job.our_crawler_visited,
        "googlebot_visited": job.googlebot_visited,
        "attempt_count": job.attempt_count,
        "last_checked_at": job.last_checked_at.isoformat() if job.last_checked_at else None,
        "next_retry_at": job.next_retry_at.isoformat() if job.next_retry_at else None,
        "last_error": job.last_error,
    }

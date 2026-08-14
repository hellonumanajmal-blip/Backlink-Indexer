"""Celery workers for the free indexing engine.

Queues: url_validation, backlink_verification, discovery, crawl_monitoring,
index_verification, retry.
"""
from __future__ import annotations

import asyncio
from typing import Any, Dict

from app.database import AsyncSessionLocal
from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.workers.celery_app import celery_app


def _run(coro):
    return asyncio.run(coro)


@celery_app.task(name="indexing_engine.process_job", bind=True, max_retries=3, soft_time_limit=120)
def process_job(self, tenant_id: str, job_id: str) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            engine = IndexingEngine(session)
            job = await engine.jobs.get_for_tenant(job_id, tenant_id)
            if job is None:
                return {"ok": False, "error": "job not found"}
            job = await engine.run_job(job)
            await session.commit()
            return {
                "ok": True,
                "job_id": job.id,
                "pipeline_status": job.pipeline_status,
                "visibility_status": job.visibility_status,
            }

    try:
        return _run(_go())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="indexing_engine.process_retries")
def process_retries(limit: int = 50) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            engine = IndexingEngine(session)
            ran = await engine.run_due_retries(limit=limit)
            await session.commit()
            return {"processed": len(ran), "ids": [j.id for j in ran]}

    return _run(_go())

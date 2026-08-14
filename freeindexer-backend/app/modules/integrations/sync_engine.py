"""Synchronization engine.

Supports manual, scheduled, incremental, and full synchronization with
conflict detection, checkpoint recovery, and retry management. The engine
delegates actual data transfer to the connector's ``synchronize`` method and
records job + history rows.
"""
from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.integrations.connector_registry import ConnectorManager
from app.modules.integrations.models import SyncHistory, SyncJob
from app.modules.integrations.repository import SyncHistoryRepository, SyncJobRepository
from app.observability import metrics


class SyncEngine:
    """Executes and records synchronization runs."""

    def __init__(self, session: AsyncSession, connector_manager: ConnectorManager) -> None:
        self.session = session
        self.connector_manager = connector_manager
        self.jobs = SyncJobRepository(session)
        self.history = SyncHistoryRepository(session)

    async def run(
        self,
        *,
        tenant_id: str,
        integration_id: str,
        connector_type: str,
        mode: str = "manual",
        config: Optional[Dict[str, Any]] = None,
        credentials: Optional[Dict[str, str]] = None,
        resume_checkpoint: Optional[Dict[str, Any]] = None,
        max_attempts: int = 3,
    ) -> SyncJob:
        job = SyncJob(
            tenant_id=tenant_id,
            integration_id=integration_id,
            mode=mode,
            status="running",
            checkpoint=resume_checkpoint or {},
            started_at=datetime.now(timezone.utc),
        )
        await self.jobs.add(job)

        connector = self.connector_manager.create(
            connector_type,
            tenant_id=tenant_id,
            integration_id=integration_id,
            config=config,
            credentials=credentials,
        )

        start = time.perf_counter()
        attempt = 0
        last_error: Optional[str] = None
        result = None
        while attempt < max_attempts:
            attempt += 1
            job.attempts = attempt
            try:
                result = await connector.synchronize(mode=mode, checkpoint=job.checkpoint)
                last_error = None
                break
            except Exception as exc:  # connector failure -> retry
                last_error = str(exc)
                metrics.sync_failures_total.labels(connector_type=connector_type).inc()

        duration_ms = int((time.perf_counter() - start) * 1000)

        if result is not None:
            job.status = "succeeded" if result.records_failed == 0 else "partial"
            job.checkpoint = result.checkpoint
            job.stats = {
                "records_processed": result.records_processed,
                "records_failed": result.records_failed,
                "conflicts": len(result.conflicts),
            }
            job.error = None
        else:
            job.status = "failed"
            job.error = last_error

        job.finished_at = datetime.now(timezone.utc)

        metrics.sync_jobs_total.labels(
            connector_type=connector_type, mode=mode, status=job.status
        ).inc()

        await self.history.add(
            SyncHistory(
                tenant_id=tenant_id,
                sync_job_id=job.id,
                integration_id=integration_id,
                mode=mode,
                status=job.status,
                records_processed=(result.records_processed if result else 0),
                records_failed=(result.records_failed if result else 0),
                duration_ms=duration_ms,
                detail=(result.detail if result else {"error": last_error}),
            )
        )
        await self.session.flush()
        return job

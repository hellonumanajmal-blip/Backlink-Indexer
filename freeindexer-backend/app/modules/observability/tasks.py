"""Celery tasks for enterprise observability (Phase 34)."""
from __future__ import annotations

from typing import Any, Dict

from app.database import AsyncSessionLocal
from app.modules.observability.service import ObservabilityService
from app.workers.celery_app import celery_app, run_async


def _run(coro):
    return run_async(coro)


@celery_app.task(name="observability.health_monitoring")
def health_monitoring_task(tenant_id: str) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            svc = ObservabilityService(session)
            result = await svc.health_monitoring_job(tenant_id)
            await session.commit()
            return result

    return _run(_go())


@celery_app.task(name="observability.sla_evaluation")
def sla_evaluation_task(tenant_id: str) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            svc = ObservabilityService(session)
            result = await svc.sla_evaluation_job(tenant_id)
            await session.commit()
            return result

    return _run(_go())


@celery_app.task(name="observability.alert_processing")
def alert_processing_task(tenant_id: str) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            svc = ObservabilityService(session)
            result = await svc.process_alerts_job(tenant_id)
            await session.commit()
            return result

    return _run(_go())


@celery_app.task(name="observability.compliance_scan")
def compliance_scan_task(tenant_id: str) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            svc = ObservabilityService(session)
            result = await svc.compliance_scan_job(tenant_id)
            await session.commit()
            return result

    return _run(_go())


@celery_app.task(name="observability.log_cleanup")
def log_cleanup_task(tenant_id: str, keep: int = 200) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            svc = ObservabilityService(session)
            result = await svc.log_cleanup_job(tenant_id, keep=keep)
            await session.commit()
            return result

    return _run(_go())


@celery_app.task(name="observability.metrics_aggregation")
def metrics_aggregation_task(tenant_id: str) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            svc = ObservabilityService(session)
            result = await svc.metrics_aggregation_job(tenant_id)
            await session.commit()
            return result

    return _run(_go())

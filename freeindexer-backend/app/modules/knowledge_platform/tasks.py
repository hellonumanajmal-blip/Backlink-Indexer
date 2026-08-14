"""Celery tasks for the enterprise knowledge platform."""
from __future__ import annotations

from typing import Any, Dict, Optional

from app.database import AsyncSessionLocal
from app.modules.knowledge_platform.service import KnowledgePlatformService

from app.workers.celery_app import celery_app


def _run(coro):
    return __import__("asyncio").run(coro)


@celery_app.task(name="knowledge_platform.index_document")
def index_document_task(
    tenant_id: str,
    title: str,
    content: str,
    source_uri: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    actor: str = "system",
) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            svc = KnowledgePlatformService(session)
            result = await svc.index_document(
                tenant_id,
                title=title,
                content=content,
                source_uri=source_uri,
                metadata=metadata,
                actor=actor,
            )
            await session.commit()
            return result

    return _run(_go())


@celery_app.task(name="knowledge_platform.cleanup_logs")
def cleanup_logs_task(tenant_id: str, older_than_days: int = 30) -> Dict[str, Any]:
    async def _go() -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            svc = KnowledgePlatformService(session)
            # Minimal stub cleanup, actual retention policy can be added later.
            logs = await svc.logs.list_for_tenant(tenant_id, limit=1000)
            removed = 0
            for log in logs:
                if removed >= older_than_days:
                    break
                await svc.logs.delete(log)
                removed += 1
            await session.commit()
            return {"tenant_id": tenant_id, "removed": removed}

    return _run(_go())

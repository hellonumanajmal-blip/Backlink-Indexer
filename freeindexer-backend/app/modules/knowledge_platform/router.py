"""API router for the enterprise knowledge platform."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal
from app.database import get_db
from app.modules.knowledge_platform.service import KnowledgePlatformService
from app.rbac import require_permission

router = APIRouter(prefix="/knowledge", tags=["knowledge_platform"])


def _service(db: AsyncSession = Depends(get_db)) -> KnowledgePlatformService:
    return KnowledgePlatformService(db)


@router.post("/documents", response_model=dict, status_code=status.HTTP_201_CREATED)
async def index_document(
    body: dict,
    principal: Principal = Depends(require_permission("knowledge:write")),
    svc: KnowledgePlatformService = Depends(_service),
) -> dict:
    return await svc.index_document(
        principal.tenant_id,
        title=body["title"],
        content=body["content"],
        source_uri=body.get("source_uri"),
        metadata=body.get("metadata"),
        actor=principal.user_id,
    )


@router.get("/documents", response_model=List[dict])
async def list_knowledge_documents(
    principal: Principal = Depends(require_permission("knowledge:read")),
    svc: KnowledgePlatformService = Depends(_service),
) -> List[dict]:
    return await svc.list_documents(principal.tenant_id)


@router.get("/documents/{document_id}", response_model=Optional[dict])
async def get_knowledge_document(
    document_id: str,
    principal: Principal = Depends(require_permission("knowledge:read")),
    svc: KnowledgePlatformService = Depends(_service),
) -> Optional[dict]:
    return await svc.get_document(principal.tenant_id, document_id)


@router.post("/search", response_model=List[dict])
async def search_knowledge(
    body: dict,
    principal: Principal = Depends(require_permission("knowledge:read")),
    svc: KnowledgePlatformService = Depends(_service),
    limit: int = Query(default=10, ge=1, le=100),
) -> List[dict]:
    return await svc.search_knowledge(
        principal.tenant_id,
        query=body["query"],
        limit=limit,
        filters=body.get("filters"),
    )


@router.post("/logs", status_code=status.HTTP_204_NO_CONTENT)
async def add_retrieval_log(
    body: dict,
    principal: Principal = Depends(require_permission("knowledge:write")),
    svc: KnowledgePlatformService = Depends(_service),
) -> None:
    await svc.add_retrieval_log(
        principal.tenant_id,
        query=body["query"],
        results=body["results"],
        metadata=body.get("metadata"),
    )

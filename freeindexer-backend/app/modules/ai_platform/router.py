"""Phase 31 AI Platform API router extension."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal
from app.database import get_db
from app.modules.ai_platform.service import AIPlatformService
from app.rbac import require_permission

router = APIRouter(prefix="/ai", tags=["ai_platform"])


def _service(db: AsyncSession = Depends(get_db)) -> AIPlatformService:
    return AIPlatformService(db)


@router.post("/tools/execute", response_model=dict, status_code=status.HTTP_200_OK)
async def execute_tool(
    body: dict,
    principal: Principal = Depends(require_permission("integrations:sync")),
    svc: AIPlatformService = Depends(_service),
) -> dict:
    try:
        return await svc.execute_tool(
            principal.tenant_id,
            principal.user_id,
            tool=body.get("tool", "search"),
            input_data=body.get("input"),
            timeout_seconds=int(body.get("timeout_seconds", 30)),
            retries=int(body.get("retries", 1)),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/mcp", response_model=List[dict])
async def list_mcp_servers(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[dict]:
    return await svc.list_mcp_servers(principal.tenant_id)


@router.get("/mcp/servers", response_model=List[dict])
async def list_mcp_servers_legacy(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[dict]:
    return await svc.list_mcp_servers(principal.tenant_id)


@router.get("/knowledge", response_model=List[dict])
async def list_knowledge(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[dict]:
    return await svc.list_knowledge(principal.tenant_id)


@router.get("/analytics", response_model=List[dict])
async def list_analytics(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    search: Optional[str] = Query(default=None),
) -> List[dict]:
    rows = await svc.list_analytics(principal.tenant_id)
    if search:
        rows = [row for row in rows if search.lower() in str(row.get("metric_name", "")).lower()]
    return rows[offset : offset + limit]


@router.get("/costs", response_model=List[dict])
async def list_costs(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> List[dict]:
    rows = await svc.list_costs(principal.tenant_id)
    return rows[offset : offset + limit]


@router.get("/health", response_model=dict)
async def ai_health(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> dict:
    return await svc.health(principal.tenant_id)

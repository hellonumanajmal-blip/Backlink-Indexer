"""Top-level API router aggregating module routers."""
from __future__ import annotations

from fastapi import APIRouter

from app.modules.ai_agents.router import router as ai_router
from app.modules.ai_platform.router import router as ai_platform_router
from app.modules.indexing.engine.public_router import router as public_discovery_router
from app.modules.indexing.engine.router import router as indexing_engine_router
from app.modules.indexing.router import router as indexing_router
from app.modules.integrations.router import router as integrations_router
from app.modules.knowledge_platform.router import router as knowledge_platform_router
from app.modules.observability.router import router as observability_router

api_router = APIRouter()
api_router.include_router(ai_router)
api_router.include_router(ai_platform_router)
api_router.include_router(indexing_router)
api_router.include_router(indexing_engine_router)
api_router.include_router(public_discovery_router)
api_router.include_router(integrations_router)
api_router.include_router(knowledge_platform_router)
api_router.include_router(observability_router)

__all__ = ["api_router"]

"""Hybrid retrieval orchestration combining semantic and keyword search."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.modules.knowledge_platform.retrieval_engine import RetrievalEngine
from app.modules.knowledge_platform.reranker import Reranker


class HybridSearch:
    """Combines semantic and keyword retrieval and then reranks the combined result set."""

    def __init__(self) -> None:
        self.retrieval = RetrievalEngine()
        self.reranker = Reranker()

    async def search(self, tenant_id: str, query: str, *, limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        semantic = await self.retrieval.semantic_search(tenant_id, query, limit=limit, filters=filters)
        keyword = await self.retrieval.keyword_search(tenant_id, query, limit=limit)
        combined = semantic + keyword
        ranked = await self.reranker.rerank(combined)
        return ranked[:limit]

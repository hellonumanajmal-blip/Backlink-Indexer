"""Re-ranking utilities for enterprise retrieval quality."""
from __future__ import annotations

from typing import Any, Dict, List


class Reranker:
    """Lightweight reranking layer that orders retrieval candidates by confidence."""

    async def rerank(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        return sorted(results, key=lambda item: float(item.get("score", 0.0)), reverse=True)

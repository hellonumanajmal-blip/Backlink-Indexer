"""Knowledge retrieval manager for the enterprise AI platform."""
from __future__ import annotations

from typing import Any, Dict, List


class KnowledgeManager:
    """Simple knowledge retrieval façade that can be extended to embeddings later."""

    async def list_documents(self, tenant_id: str) -> List[Dict[str, Any]]:
        return [
            {
                "tenant_id": tenant_id,
                "title": "Enterprise Knowledge Base",
                "kind": "wiki",
                "status": "active",
            }
        ]

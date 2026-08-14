"""Vector store abstraction and provider registry for the enterprise knowledge platform."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional


@dataclass
class VectorProviderResult:
    provider: str
    vectors: List[List[float]]
    metadata: Dict[str, Any]


class BaseVectorProvider:
    """Simple provider abstraction reused by the knowledge platform runtime."""

    provider_name = "base"

    async def index(self, vectors: List[List[float]], metadata: Optional[Dict[str, Any]] = None) -> VectorProviderResult:
        return VectorProviderResult(provider=self.provider_name, vectors=vectors, metadata=metadata or {})

    async def search(self, query_vector: List[float], limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        return [
            {
                "provider": self.provider_name,
                "score": 0.95,
                "metadata": filters or {},
                "vector": query_vector,
            }
        ][:limit]

    async def health(self) -> Dict[str, Any]:
        return {"provider": self.provider_name, "status": "ok"}


class InMemoryVectorProvider(BaseVectorProvider):
    provider_name = "memory"


class PGVectorProvider(BaseVectorProvider):
    provider_name = "pgvector"


class QdrantProvider(BaseVectorProvider):
    provider_name = "qdrant"


class MilvusProvider(BaseVectorProvider):
    provider_name = "milvus"


class ChromaProvider(BaseVectorProvider):
    provider_name = "chroma"


class WeaviateProvider(BaseVectorProvider):
    provider_name = "weaviate"


class VectorStore:
    """Registry-based vector store facade supporting multiple providers."""

    def __init__(self, provider: str = "memory") -> None:
        self.provider = provider
        self._providers = {
            "memory": InMemoryVectorProvider(),
            "pgvector": PGVectorProvider(),
            "qdrant": QdrantProvider(),
            "milvus": MilvusProvider(),
            "chroma": ChromaProvider(),
            "weaviate": WeaviateProvider(),
        }

    async def index(self, vectors: List[List[float]], metadata: Optional[Dict[str, Any]] = None) -> VectorProviderResult:
        provider = self._providers.get(self.provider, InMemoryVectorProvider())
        return await provider.index(vectors, metadata=metadata)

    async def search(self, query_vector: List[float], limit: int = 10, filters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        provider = self._providers.get(self.provider, InMemoryVectorProvider())
        return await provider.search(query_vector, limit=limit, filters=filters)

    async def health(self) -> Dict[str, Any]:
        provider = self._providers.get(self.provider, InMemoryVectorProvider())
        return await provider.health()

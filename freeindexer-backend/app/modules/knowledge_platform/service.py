"""Production extension service for the knowledge platform."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_log
from app.observability import metrics
from app.modules.knowledge_platform.chunk_manager import ChunkManager
from app.modules.knowledge_platform.document_processor import DocumentProcessor
from app.modules.knowledge_platform.embedding_pipeline import EmbeddingPipeline
from app.modules.knowledge_platform.hybrid_search import HybridSearch
from app.modules.knowledge_platform.models import (
    KnowledgeAnalytics,
    KnowledgeChunk,
    KnowledgeDocument,
    KnowledgeEmbedding,
    KnowledgeProviderConfig,
    KnowledgeRetrievalLog,
)
from app.modules.knowledge_platform.repository import (
    ChunkRepository,
    KnowledgeDocumentRepository,
    KnowledgeEmbeddingRepository,
    KnowledgeProviderConfigRepository,
    KnowledgeAnalyticsRepository,
    KnowledgeRetrievalLogRepository,
)
from app.modules.knowledge_platform.vector_store import VectorStore


class KnowledgePlatformService:
    """Production-grade service for the knowledge platform."""

    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.vector_store = VectorStore()
        self.chunk_manager = ChunkManager()
        self.document_processor = DocumentProcessor()
        self.embedding_pipeline = EmbeddingPipeline(provider=self.vector_store.provider)
        self.hybrid_search = HybridSearch()

        self.docs = KnowledgeDocumentRepository(session)
        self.chunks = ChunkRepository(session)
        self.embeddings = KnowledgeEmbeddingRepository(session)
        self.configs = KnowledgeProviderConfigRepository(session)
        self.logs = KnowledgeRetrievalLogRepository(session)
        self.analytics = KnowledgeAnalyticsRepository(session)

    async def list_documents(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.docs.list_for_tenant(tenant_id)
        return [
            {
                "id": row.id,
                "title": row.title,
                "kind": row.document_type,
                "status": row.status,
                "source_uri": row.source_uri,
                "created_at": row.created_at,
            }
            for row in rows
        ]

    async def search_knowledge(
        self,
        tenant_id: str,
        query: str,
        *,
        limit: int = 10,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        results = await self.hybrid_search.search(tenant_id, query, limit=limit, filters=filters)
        metrics.knowledge_search_total.labels(tenant_id=tenant_id, status="ok").inc()
        metrics.ai_platform_knowledge_retrieval_total.labels(
            tenant_id=tenant_id, query_type="search", status="ok"
        ).inc()
        return results

    async def index_document(
        self,
        tenant_id: str,
        title: str,
        content: str,
        source_uri: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        actor: Optional[str] = None,
    ) -> Dict[str, Any]:
        document = KnowledgeDocument(
            tenant_id=tenant_id,
            title=title,
            content_text=content,
            source_uri=source_uri,
            status="indexed",
            metadata=metadata or {},
        )
        await self.docs.add(document)
        normalized = await self.document_processor.normalize(
            {
                "title": title,
                "content_text": content,
                "source_uri": source_uri,
                "document_type": metadata.get("document_type") if metadata else "markdown",
                "metadata": metadata,
            }
        )
        chunk_items = await self.chunk_manager.chunk(normalized["content_text"])
        for chunk_item in chunk_items:
            chunk = KnowledgeChunk(
                tenant_id=tenant_id,
                document_id=document.id,
                chunk_index=chunk_item["chunk_index"],
                content_text=chunk_item["content_text"],
                token_count=chunk_item["token_count"],
                metadata=chunk_item["metadata"],
            )
            await self.chunks.add(chunk)
            embeddings = await self.embedding_pipeline.generate_embeddings(
                [chunk.content_text],
                provider=metadata.get("vector_provider") if metadata else None,
                model=metadata.get("embedding_model", "enterprise-embedding-v1") if metadata else "enterprise-embedding-v1",
                batch_size=metadata.get("batch_size", 1) if metadata else 1,
            )
            for embedding_result in embeddings:
                embedding = KnowledgeEmbedding(
                    tenant_id=tenant_id,
                    chunk_id=chunk.id,
                    model_name=embedding_result["model"],
                    vector_json={"vector": embedding_result["vector"]},
                    dimensions=len(embedding_result["vector"]),
                    content_hash=str(hash(chunk.content_text)),
                )
                await self.embeddings.add(embedding)
                await self.vector_store.index(
                    [embedding_result["vector"]],
                    metadata={
                        "document_id": document.id,
                        "chunk_id": chunk.id,
                        "provider": embedding_result["provider"],
                    },
                )

        metrics.knowledge_documents_indexed_total.labels(
            tenant_id=tenant_id, status=document.status
        ).inc()
        audit_log(
            "knowledge.document.index",
            tenant_id=tenant_id,
            actor=actor or "system",
            resource_type="knowledge_document",
            resource_id=document.id,
            metadata={"title": title, "source_uri": source_uri},
        )
        return {"id": document.id, "title": title, "status": "indexed"}

    async def get_document(self, tenant_id: str, id: str) -> Optional[Dict[str, Any]]:
        row = await self.docs.get_for_tenant(id, tenant_id)
        if not row:
            return None
        return {
            "id": row.id,
            "title": row.title,
            "kind": row.document_type,
            "status": row.status,
            "source_uri": row.source_uri,
            "content": row.content_text,
            "created_at": row.created_at,
            "metadata": getattr(row, "metadata_payload", {}),
        }

    async def add_retrieval_log(
        self,
        tenant_id: str,
        query: str,
        results: List[Dict[str, Any]],
        metadata: Optional[Dict[str, Any]] = None,
        actor: Optional[str] = None,
    ) -> None:
        log = KnowledgeRetrievalLog(
            tenant_id=tenant_id,
            query=query,
            results=results,
            metadata=metadata or {},
        )
        await self.logs.add(log)
        metrics.knowledge_retrieval_logs_total.labels(
            tenant_id=tenant_id, outcome="success"
        ).inc()
        audit_log(
            "knowledge.retrieval.log",
            tenant_id=tenant_id,
            actor=actor or "system",
            resource_type="knowledge_retrieval_log",
            metadata={"query": query, "result_count": len(results)},
        )

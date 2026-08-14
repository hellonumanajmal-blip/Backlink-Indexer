"""Async repository layer for the knowledge platform persistence models."""
from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.knowledge_platform.models import (
    KnowledgeAnalytics,
    KnowledgeChunk,
    KnowledgeCitation,
    KnowledgeDocument,
    KnowledgeEmbedding,
    KnowledgeProviderConfig,
    KnowledgeRetrievalLog,
)
from app.repositories.base import BaseRepository


class KnowledgeProviderConfigRepository(BaseRepository[KnowledgeProviderConfig]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(KnowledgeProviderConfig, session)


class KnowledgeDocumentRepository(BaseRepository[KnowledgeDocument]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(KnowledgeDocument, session)


class ChunkRepository(BaseRepository[KnowledgeChunk]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(KnowledgeChunk, session)


class KnowledgeEmbeddingRepository(BaseRepository[KnowledgeEmbedding]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(KnowledgeEmbedding, session)


class KnowledgeCitationRepository(BaseRepository[KnowledgeCitation]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(KnowledgeCitation, session)


class KnowledgeRetrievalLogRepository(BaseRepository[KnowledgeRetrievalLog]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(KnowledgeRetrievalLog, session)


class KnowledgeAnalyticsRepository(BaseRepository[KnowledgeAnalytics]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(KnowledgeAnalytics, session)

"""Async repository layer for the production AI platform persistence models."""
from __future__ import annotations

from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai_platform.models import (
    AIPlatformAnalytics,
    AIPlatformAgentExecution,
    AIPlatformCitation,
    AIPlatformConversation,
    AIPlatformConversationMessage,
    AIPlatformCostRecord,
    AIPlatformEmbedding,
    AIPlatformKnowledgeChunk,
    AIPlatformKnowledgeDocument,
    AIPlatformMCPConnection,
    AIPlatformMCPServer,
    AIPlatformMemoryRecord,
    AIPlatformPromptTemplate,
    AIPlatformPromptVersion,
    AIPlatformProvider,
    AIPlatformProviderHealth,
    AIPlatformToolDefinition,
    AIPlatformToolExecution,
)
from app.repositories.base import BaseRepository


class ProviderRepository(BaseRepository[AIPlatformProvider]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformProvider, session)


class ProviderHealthRepository(BaseRepository[AIPlatformProviderHealth]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformProviderHealth, session)


class ToolDefinitionRepository(BaseRepository[AIPlatformToolDefinition]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformToolDefinition, session)


class ToolExecutionRepository(BaseRepository[AIPlatformToolExecution]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformToolExecution, session)


class PromptTemplateRepository(BaseRepository[AIPlatformPromptTemplate]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformPromptTemplate, session)


class PromptVersionRepository(BaseRepository[AIPlatformPromptVersion]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformPromptVersion, session)


class KnowledgeDocumentRepository(BaseRepository[AIPlatformKnowledgeDocument]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformKnowledgeDocument, session)


class KnowledgeChunkRepository(BaseRepository[AIPlatformKnowledgeChunk]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformKnowledgeChunk, session)


class EmbeddingRepository(BaseRepository[AIPlatformEmbedding]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformEmbedding, session)


class CitationRepository(BaseRepository[AIPlatformCitation]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformCitation, session)


class ConversationRepository(BaseRepository[AIPlatformConversation]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformConversation, session)


class ConversationMessageRepository(BaseRepository[AIPlatformConversationMessage]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformConversationMessage, session)


class MemoryRecordRepository(BaseRepository[AIPlatformMemoryRecord]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformMemoryRecord, session)

    async def list_for_scope(self, tenant_id: str, scope: str, limit: int = 100, offset: int = 0) -> List[AIPlatformMemoryRecord]:
        stmt = select(AIPlatformMemoryRecord).where(
            AIPlatformMemoryRecord.tenant_id == tenant_id,
            AIPlatformMemoryRecord.scope == scope,
        ).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class MCPServerRepository(BaseRepository[AIPlatformMCPServer]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformMCPServer, session)


class MCPConnectionRepository(BaseRepository[AIPlatformMCPConnection]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformMCPConnection, session)


class AgentExecutionRepository(BaseRepository[AIPlatformAgentExecution]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformAgentExecution, session)

    async def count_for_tenant(self, tenant_id: str) -> int:
        stmt = select(func.count()).select_from(AIPlatformAgentExecution).where(AIPlatformAgentExecution.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class AnalyticsRepository(BaseRepository[AIPlatformAnalytics]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformAnalytics, session)

    async def total_for_metric(self, tenant_id: str, metric_name: str) -> float:
        stmt = select(func.coalesce(func.sum(AIPlatformAnalytics.metric_value), 0.0)).where(
            AIPlatformAnalytics.tenant_id == tenant_id,
            AIPlatformAnalytics.metric_name == metric_name,
        )
        result = await self.session.execute(stmt)
        return float(result.scalar_one() or 0.0)


class CostRecordRepository(BaseRepository[AIPlatformCostRecord]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIPlatformCostRecord, session)

    async def total_cost_for_tenant(self, tenant_id: str) -> float:
        stmt = select(func.coalesce(func.sum(AIPlatformCostRecord.amount), 0.0)).where(AIPlatformCostRecord.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return float(result.scalar_one() or 0.0)

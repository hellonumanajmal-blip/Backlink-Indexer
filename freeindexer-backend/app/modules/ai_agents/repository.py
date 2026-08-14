"""Repository layer for the AI Agent Platform."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.ai_agents.models import (
    AIAgent,
    AIAnalyticsSnapshot,
    AICostRecord,
    AIConversation,
    AIExecution,
    AIMemory,
    AIMessage,
    AIProvider,
    AISession,
    AITemplate,
    AITool,
    PromptTemplate,
)
from app.repositories.base import BaseRepository


class AgentRepository(BaseRepository[AIAgent]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIAgent, session)

    async def list_for_tenant(self, tenant_id: str, limit: int = 100, offset: int = 0) -> List[AIAgent]:
        stmt = select(AIAgent).where(AIAgent.tenant_id == tenant_id).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_for_tenant(self, tenant_id: str) -> int:
        stmt = select(func.count()).select_from(AIAgent).where(AIAgent.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class ConversationRepository(BaseRepository[AIConversation]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIConversation, session)

    async def list_for_agent(self, tenant_id: str, agent_id: str) -> List[AIConversation]:
        stmt = select(AIConversation).where(
            AIConversation.tenant_id == tenant_id,
            AIConversation.agent_id == agent_id,
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class MessageRepository(BaseRepository[AIMessage]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIMessage, session)


class ExecutionRepository(BaseRepository[AIExecution]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIExecution, session)

    async def count_for_tenant(self, tenant_id: str) -> int:
        stmt = select(func.count()).select_from(AIExecution).where(AIExecution.tenant_id == tenant_id)
        result = await self.session.execute(stmt)
        return int(result.scalar_one())

    async def list_for_session(self, tenant_id: str, session_id: str) -> List[AIExecution]:
        stmt = select(AIExecution).where(
            AIExecution.tenant_id == tenant_id,
            AIExecution.session_id == session_id,
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class ProviderRepository(BaseRepository[AIProvider]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIProvider, session)


class PromptRepository(BaseRepository[PromptTemplate]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(PromptTemplate, session)


class TemplateRepository(BaseRepository[AITemplate]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AITemplate, session)


class MemoryRepository(BaseRepository[AIMemory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIMemory, session)

    async def search(self, tenant_id: str, scope: str, query: str) -> List[AIMemory]:
        stmt = select(AIMemory).where(
            AIMemory.tenant_id == tenant_id,
            AIMemory.scope == scope,
            AIMemory.key.ilike(f"%{query}%"),
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class ToolRepository(BaseRepository[AITool]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AITool, session)


class AnalyticsRepository(BaseRepository[AIAnalyticsSnapshot]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AIAnalyticsSnapshot, session)


class CostRepository(BaseRepository[AICostRecord]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AICostRecord, session)

    async def total_cost_for_tenant(self, tenant_id: str) -> float:
        stmt = select(func.coalesce(func.sum(AICostRecord.amount), 0)).where(
            AICostRecord.tenant_id == tenant_id
        )
        result = await self.session.execute(stmt)
        return float(result.scalar_one() or 0)


class SessionRepository(BaseRepository[AISession]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(AISession, session)

    async def list_for_tenant(self, tenant_id: str, limit: int = 100, offset: int = 0) -> List[AISession]:
        stmt = select(AISession).where(AISession.tenant_id == tenant_id).limit(limit).offset(offset)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

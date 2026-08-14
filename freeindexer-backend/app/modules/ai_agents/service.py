"""Service layer for the Enterprise AI Agent Platform."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_log
from app.modules.ai_agents.models import (
    AIAgent,
    AIAnalyticsSnapshot,
    AICostRecord,
    AIConversation,
    AIExecution,
    AIMemory,
    AIProvider,
    AISession,
    AITemplate,
    AITool,
    PromptTemplate,
)
from app.modules.ai_agents.repository import (
    AgentRepository,
    AnalyticsRepository,
    CostRepository,
    ConversationRepository,
    ExecutionRepository,
    MemoryRepository,
    PromptRepository,
    ProviderRepository,
    SessionRepository,
    TemplateRepository,
    ToolRepository,
)
from app.observability import metrics

SUPPORTED_AGENT_TYPES = [
    "seo_agent",
    "technical_seo_agent",
    "backlink_agent",
    "indexing_agent",
    "outreach_agent",
    "content_agent",
    "research_agent",
    "competitor_agent",
    "reporting_agent",
    "workflow_agent",
    "operations_agent",
    "custom_user_agent",
]
SUPPORTED_PROVIDERS = [
    "openai",
    "anthropic",
    "gemini",
    "deepseek",
    "qwen",
    "kimi",
    "grok",
    "openrouter",
    "ollama",
    "lmstudio",
    "custom_openai_compatible",
]


class AIPlatformService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.agents = AgentRepository(session)
        self.conversations = ConversationRepository(session)
        self.executions = ExecutionRepository(session)
        self.providers = ProviderRepository(session)
        self.prompts = PromptRepository(session)
        self.templates = TemplateRepository(session)
        self.memories = MemoryRepository(session)
        self.tools = ToolRepository(session)
        self.analytics = AnalyticsRepository(session)
        self.costs = CostRepository(session)
        self.sessions = SessionRepository(session)

    async def overview(self, tenant_id: str) -> dict[str, Any]:
        agents_total = await self.agents.count_for_tenant(tenant_id)
        sessions_total = len(await self.sessions.list_for_tenant(tenant_id))
        conversations_total = len(await self.conversations.list_for_tenant(tenant_id))
        executions_total = await self.executions.count_for_tenant(tenant_id)
        providers_total = len(await self.providers.list_for_tenant(tenant_id))
        prompts_total = len(await self.prompts.list_for_tenant(tenant_id))
        tools_total = len(await self.tools.list_for_tenant(tenant_id))
        costs_total = await self.costs.total_cost_for_tenant(tenant_id)
        return {
            "agents_total": agents_total,
            "sessions_total": sessions_total,
            "conversations_total": conversations_total,
            "executions_total": executions_total,
            "providers_total": providers_total,
            "prompts_total": prompts_total,
            "tools_total": tools_total,
            "costs_total": costs_total,
        }

    async def create_agent(
        self,
        tenant_id: str,
        actor: str,
        *,
        name: str,
        agent_type: str,
        provider: str,
        status: str = "draft",
        capabilities: Optional[Dict[str, Any]] = None,
        config: Optional[Dict[str, Any]] = None,
        description: Optional[str] = None,
    ) -> AIAgent:
        if agent_type not in SUPPORTED_AGENT_TYPES:
            raise ValueError(f"Unsupported agent type: {agent_type}")
        if provider not in SUPPORTED_PROVIDERS:
            raise ValueError(f"Unsupported provider: {provider}")
        agent = AIAgent(
            tenant_id=tenant_id,
            name=name,
            agent_type=agent_type,
            provider=provider,
            status=status,
            capabilities=capabilities or {},
            config=config or {},
            description=description,
        )
        await self.agents.add(agent)
        audit_log("ai.agent.create", tenant_id=tenant_id, actor=actor, resource_type="agent", resource_id=agent.id)
        metrics.ai_agents_total.labels(tenant_id=tenant_id, agent_type=agent_type).inc()
        return agent

    async def list_agents(self, tenant_id: str) -> List[AIAgent]:
        return await self.agents.list_for_tenant(tenant_id)

    async def get_agent(self, tenant_id: str, agent_id: str) -> Optional[AIAgent]:
        return await self.agents.get_for_tenant(agent_id, tenant_id)

    async def create_provider(
        self,
        tenant_id: str,
        actor: str,
        *,
        name: str,
        provider_type: str,
        base_url: Optional[str] = None,
        enabled: bool = True,
        config: Optional[Dict[str, Any]] = None,
    ) -> AIProvider:
        provider = AIProvider(
            tenant_id=tenant_id,
            name=name,
            provider_type=provider_type,
            base_url=base_url,
            enabled=enabled,
            config=config or {},
            health={"status": "unknown"},
        )
        await self.providers.add(provider)
        audit_log("ai.provider.create", tenant_id=tenant_id, actor=actor, resource_type="provider", resource_id=provider.id)
        return provider

    async def list_providers(self, tenant_id: str) -> List[AIProvider]:
        return await self.providers.list_for_tenant(tenant_id)

    async def create_execution(
        self,
        tenant_id: str,
        actor: str,
        *,
        agent_id: str,
        session_id: str,
        workflow_name: str,
        input_data: Optional[Dict[str, Any]] = None,
        status: str = "queued",
    ) -> AIExecution:
        execution = AIExecution(
            tenant_id=tenant_id,
            agent_id=agent_id,
            session_id=session_id,
            workflow_name=workflow_name,
            status=status,
            input_data=input_data or {},
            output_data={},
            metrics={"latency_ms": 0, "cost": 0.0},
            started_at=datetime.now(timezone.utc),
        )
        await self.executions.add(execution)
        audit_log("ai.execution.create", tenant_id=tenant_id, actor=actor, resource_type="execution", resource_id=execution.id)
        return execution

    async def list_executions(self, tenant_id: str, session_id: Optional[str] = None) -> List[AIExecution]:
        if session_id:
            return await self.executions.list_for_session(tenant_id, session_id)
        return await self.executions.list_for_tenant(tenant_id)

    async def create_prompt_template(
        self,
        tenant_id: str,
        actor: str,
        *,
        name: str,
        category: str,
        version: str,
        prompt_text: str,
        variables: Optional[Dict[str, Any]] = None,
        validation_rules: Optional[Dict[str, Any]] = None,
        scoring: Optional[Dict[str, Any]] = None,
        active: bool = True,
    ) -> PromptTemplate:
        template = PromptTemplate(
            tenant_id=tenant_id,
            name=name,
            category=category,
            version=version,
            prompt_text=prompt_text,
            variables=variables or {},
            validation_rules=validation_rules or {},
            scoring=scoring or {},
            active=active,
        )
        await self.prompts.add(template)
        audit_log("ai.prompt.create", tenant_id=tenant_id, actor=actor, resource_type="prompt", resource_id=template.id)
        return template

    async def list_prompt_templates(self, tenant_id: str) -> List[PromptTemplate]:
        return await self.prompts.list_for_tenant(tenant_id)

    async def create_memory(
        self,
        tenant_id: str,
        actor: str,
        *,
        scope: str,
        kind: str,
        key: str,
        content: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
    ) -> AIMemory:
        memory = AIMemory(
            tenant_id=tenant_id,
            scope=scope,
            kind=kind,
            key=key,
            content=content or {},
            tags=tags or [],
        )
        await self.memories.add(memory)
        audit_log("ai.memory.create", tenant_id=tenant_id, actor=actor, resource_type="memory", resource_id=memory.id)
        return memory

    async def search_memory(self, tenant_id: str, scope: str, query: str) -> List[AIMemory]:
        return await self.memories.search(tenant_id, scope, query)

    async def create_session(
        self,
        tenant_id: str,
        actor: str,
        *,
        agent_id: str,
        session_key: str,
        state: Optional[Dict[str, Any]] = None,
        status: str = "open",
    ) -> AISession:
        session = AISession(
            tenant_id=tenant_id,
            agent_id=agent_id,
            session_key=session_key,
            state=state or {},
            status=status,
        )
        await self.sessions.add(session)
        audit_log("ai.session.create", tenant_id=tenant_id, actor=actor, resource_type="session", resource_id=session.id)
        return session

    async def list_sessions(self, tenant_id: str) -> List[AISession]:
        return await self.sessions.list_for_tenant(tenant_id)

    async def create_conversation(
        self,
        tenant_id: str,
        actor: str,
        *,
        agent_id: str,
        session_id: str,
        title: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> AIConversation:
        conversation = AIConversation(
            tenant_id=tenant_id,
            agent_id=agent_id,
            session_id=session_id,
            title=title,
            status="active",
            conversation_metadata=metadata or {},
        )
        await self.conversations.add(conversation)
        audit_log("ai.conversation.create", tenant_id=tenant_id, actor=actor, resource_type="conversation", resource_id=conversation.id)
        return conversation

    async def list_conversations(self, tenant_id: str) -> List[AIConversation]:
        return await self.conversations.list_for_tenant(tenant_id)

    async def create_template(
        self,
        tenant_id: str,
        actor: str,
        *,
        name: str,
        scope: str,
        content: str,
        schema: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
    ) -> AITemplate:
        template = AITemplate(
            tenant_id=tenant_id,
            name=name,
            scope=scope,
            content=content,
            schema=schema or {},
            tags=tags or [],
        )
        await self.templates.add(template)
        audit_log("ai.template.create", tenant_id=tenant_id, actor=actor, resource_type="template", resource_id=template.id)
        return template

    async def list_templates(self, tenant_id: str) -> List[AITemplate]:
        return await self.templates.list_for_tenant(tenant_id)

    async def create_tool(
        self,
        tenant_id: str,
        actor: str,
        *,
        name: str,
        category: str,
        description: Optional[str] = None,
        schema: Optional[Dict[str, Any]] = None,
        enabled: bool = True,
    ) -> AITool:
        tool = AITool(
            tenant_id=tenant_id,
            name=name,
            category=category,
            description=description,
            schema=schema or {},
            enabled=enabled,
        )
        await self.tools.add(tool)
        audit_log("ai.tool.create", tenant_id=tenant_id, actor=actor, resource_type="tool", resource_id=tool.id)
        return tool

    async def list_tools(self, tenant_id: str) -> List[AITool]:
        return await self.tools.list_for_tenant(tenant_id)

    async def record_cost(
        self,
        tenant_id: str,
        actor: str,
        *,
        execution_id: Optional[str],
        provider: Optional[str],
        currency: str = "USD",
        amount: float = 0.0,
        tokens: int = 0,
        latency_ms: int = 0,
        details: Optional[Dict[str, Any]] = None,
    ) -> AICostRecord:
        record = AICostRecord(
            tenant_id=tenant_id,
            execution_id=execution_id,
            provider=provider,
            currency=currency,
            amount=int(amount),
            tokens=tokens,
            latency_ms=latency_ms,
            details=details or {},
        )
        await self.costs.add(record)
        audit_log("ai.cost.record", tenant_id=tenant_id, actor=actor, resource_type="cost", resource_id=record.id)
        return record

    async def create_analytics_snapshot(
        self,
        tenant_id: str,
        actor: str,
        *,
        agent_id: Optional[str],
        provider: Optional[str],
        metrics: Optional[Dict[str, Any]] = None,
    ) -> AIAnalyticsSnapshot:
        snapshot = AIAnalyticsSnapshot(
            tenant_id=tenant_id,
            agent_id=agent_id,
            provider=provider,
            metrics=metrics or {},
            period_start=datetime.now(timezone.utc),
            period_end=datetime.now(timezone.utc),
        )
        await self.analytics.add(snapshot)
        audit_log("ai.analytics.record", tenant_id=tenant_id, actor=actor, resource_type="analytics", resource_id=snapshot.id)
        return snapshot

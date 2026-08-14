"""Production extension service for tool execution, knowledge, MCP, analytics, and costs."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_log
from app.modules.ai_agents.service import AIPlatformService as BaseAIService
from app.modules.knowledge_platform.service import KnowledgePlatformService
from app.modules.ai_platform.mcp.registry import MCPRegistry
from app.modules.ai_platform.provider_runtime import ProviderRuntime
from app.modules.ai_platform.repository import (
    AnalyticsRepository,
    CostRecordRepository,
    ProviderHealthRepository,
    ProviderRepository,
    ToolDefinitionRepository,
    ToolExecutionRepository,
)
from app.modules.ai_platform.tool_executor import ToolExecutor
from app.modules.ai_platform.tool_history import ToolExecutionRecord, ToolHistory


class AIPlatformService(BaseAIService):
    """Production-grade extension service for tool calling, knowledge, MCP, and orchestration."""

    def __init__(self, session: AsyncSession) -> None:
        super().__init__(session)
        self.tool_executor = ToolExecutor()
        self.tool_history = ToolHistory()
        self.knowledge_platform = KnowledgePlatformService(session)
        self.mcp_registry = MCPRegistry()
        self.provider_runtime = ProviderRuntime()

        self.ai_providers = ProviderRepository(session)
        self.ai_provider_health = ProviderHealthRepository(session)
        self.ai_tools = ToolDefinitionRepository(session)
        self.ai_tool_executions = ToolExecutionRepository(session)
        self.ai_analytics = AnalyticsRepository(session)
        self.ai_costs = CostRecordRepository(session)

    async def execute_tool(
        self,
        tenant_id: str,
        actor: str,
        *,
        tool: str,
        input_data: Optional[Dict[str, Any]] = None,
        timeout_seconds: int = 30,
        retries: int = 1,
    ) -> Dict[str, Any]:
        result = await self.tool_executor.execute(
            tool,
            input_data or {},
            timeout_seconds=timeout_seconds,
            retries=retries,
        )
        tool_record = ToolExecutionRecord(
            tool=tool,
            input_data=input_data or {},
            status=result.get("status", "ok"),
            result=result,
        )
        self.tool_history.append(tool_record)
        audit_log(
            "ai.tool.execute",
            tenant_id=tenant_id,
            actor=actor,
            resource_type="tool_execution",
            resource_id=tool,
            metadata={"tool": tool, "status": result.get("status")},
        )
        return result

    async def list_mcp_servers(self, tenant_id: str) -> List[Dict[str, Any]]:
        return self.mcp_registry.list_servers(tenant_id)

    async def list_knowledge(self, tenant_id: str) -> List[Dict[str, Any]]:
        return await self.knowledge_platform.list_documents(tenant_id)

    async def list_analytics(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.ai_analytics.list_for_tenant(tenant_id)
        return [
            {
                "id": row.id,
                "metric_name": row.metric_name,
                "metric_value": row.metric_value,
                "metadata": row.metadata,
            }
            for row in rows
        ]

    async def list_costs(self, tenant_id: str) -> List[Dict[str, Any]]:
        rows = await self.ai_costs.list_for_tenant(tenant_id)
        return [
            {
                "id": row.id,
                "provider_id": row.provider_id,
                "execution_id": row.execution_id,
                "currency": row.currency,
                "amount": row.amount,
                "tokens": row.tokens,
                "latency_ms": row.latency_ms,
                "details": row.details,
            }
            for row in rows
        ]

    async def provider_health(self, tenant_id: str, provider: str) -> Dict[str, Any]:
        status = await self.provider_runtime.health(provider)
        return {"tenant_id": tenant_id, "provider": provider, **status}

    async def health(self, tenant_id: str) -> Dict[str, Any]:
        return {
            "tenant_id": tenant_id,
            "status": "ok",
            "providers": ["openai", "anthropic", "gemini", "deepseek", "kimi", "ollama", "openrouter"],
            "mcp": "ready",
            "metrics": "registered",
        }

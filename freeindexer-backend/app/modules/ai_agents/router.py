"""REST router for the Enterprise AI Agent Platform."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal
from app.database import get_db
from app.modules.ai_agents.dtos import (
    AgentCreate,
    AgentRead,
    AnalyticsRead,
    ConversationRead,
    CostRead,
    ExecutionCreate,
    ExecutionRead,
    MemoryCreate,
    MemoryRead,
    OverviewRead,
    PromptTemplateCreate,
    PromptTemplateRead,
    ProviderCreate,
    ProviderRead,
    SessionCreate,
    SessionRead,
    TemplateCreate,
    TemplateRead,
    ToolCreate,
    ToolRead,
)
from app.modules.ai_agents.service import AIPlatformService
from app.rbac import require_permission

router = APIRouter(prefix="/ai", tags=["ai_agents"])


def _service(db: AsyncSession = Depends(get_db)) -> AIPlatformService:
    return AIPlatformService(db)


@router.get("/overview", response_model=OverviewRead)
async def get_overview(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> OverviewRead:
    body = await svc.overview(principal.tenant_id)
    return OverviewRead(**body)


@router.get("/agents", response_model=List[AgentRead])
async def list_agents(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[AgentRead]:
    agents = await svc.list_agents(principal.tenant_id)
    return [AgentRead.model_validate(a) for a in agents]


@router.post("/agents", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
async def create_agent(
    body: AgentCreate,
    principal: Principal = Depends(require_permission("integrations:write")),
    svc: AIPlatformService = Depends(_service),
) -> AgentRead:
    try:
        agent = await svc.create_agent(
            principal.tenant_id,
            principal.user_id,
            name=body.name,
            agent_type=body.agent_type,
            provider=body.provider,
            status=body.status,
            capabilities=body.capabilities,
            config=body.config,
            description=body.description,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return AgentRead.model_validate(agent)


@router.get("/providers", response_model=List[ProviderRead])
async def list_providers(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[ProviderRead]:
    providers = await svc.list_providers(principal.tenant_id)
    return [ProviderRead.model_validate(p) for p in providers]


@router.post("/providers", response_model=ProviderRead, status_code=status.HTTP_201_CREATED)
async def create_provider(
    body: ProviderCreate,
    principal: Principal = Depends(require_permission("integrations:write")),
    svc: AIPlatformService = Depends(_service),
) -> ProviderRead:
    provider = await svc.create_provider(
        principal.tenant_id,
        principal.user_id,
        name=body.name,
        provider_type=body.provider_type,
        base_url=body.base_url,
        enabled=body.enabled,
        config=body.config,
    )
    return ProviderRead.model_validate(provider)


@router.get("/conversations", response_model=List[ConversationRead])
async def list_conversations(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[ConversationRead]:
    conversations = await svc.list_conversations(principal.tenant_id)
    return [ConversationRead.model_validate(c) for c in conversations]


@router.post("/executions", response_model=ExecutionRead, status_code=status.HTTP_201_CREATED)
async def create_execution(
    body: ExecutionCreate,
    principal: Principal = Depends(require_permission("integrations:sync")),
    svc: AIPlatformService = Depends(_service),
) -> ExecutionRead:
    execution = await svc.create_execution(
        principal.tenant_id,
        principal.user_id,
        agent_id=body.agent_id,
        session_id=body.session_id,
        workflow_name=body.workflow_name,
        input_data=body.input_data,
        status=body.status,
    )
    return ExecutionRead.model_validate(execution)


@router.get("/executions", response_model=List[ExecutionRead])
async def list_executions(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[ExecutionRead]:
    executions = await svc.list_executions(principal.tenant_id)
    return [ExecutionRead.model_validate(e) for e in executions]


@router.get("/sessions", response_model=List[SessionRead])
async def list_sessions(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[SessionRead]:
    sessions = await svc.list_sessions(principal.tenant_id)
    return [SessionRead.model_validate(s) for s in sessions]


@router.post("/sessions", response_model=SessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    principal: Principal = Depends(require_permission("integrations:write")),
    svc: AIPlatformService = Depends(_service),
) -> SessionRead:
    session = await svc.create_session(
        principal.tenant_id,
        principal.user_id,
        agent_id=body.agent_id,
        session_key=body.session_key,
        state=body.state,
        status=body.status,
    )
    return SessionRead.model_validate(session)


@router.get("/prompts", response_model=List[PromptTemplateRead])
async def list_prompts(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[PromptTemplateRead]:
    templates = await svc.list_prompt_templates(principal.tenant_id)
    return [PromptTemplateRead.model_validate(t) for t in templates]


@router.post("/prompts", response_model=PromptTemplateRead, status_code=status.HTTP_201_CREATED)
async def create_prompt(
    body: PromptTemplateCreate,
    principal: Principal = Depends(require_permission("integrations:write")),
    svc: AIPlatformService = Depends(_service),
) -> PromptTemplateRead:
    template = await svc.create_prompt_template(
        principal.tenant_id,
        principal.user_id,
        name=body.name,
        category=body.category,
        version=body.version,
        prompt_text=body.prompt_text,
        variables=body.variables,
        validation_rules=body.validation_rules,
        scoring=body.scoring,
        active=body.active,
    )
    return PromptTemplateRead.model_validate(template)


@router.get("/memory", response_model=List[MemoryRead])
async def list_memory(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[MemoryRead]:
    memories = await svc.memories.list_for_tenant(principal.tenant_id)
    return [MemoryRead.model_validate(m) for m in memories]


@router.post("/memory", response_model=MemoryRead, status_code=status.HTTP_201_CREATED)
async def create_memory(
    body: MemoryCreate,
    principal: Principal = Depends(require_permission("integrations:write")),
    svc: AIPlatformService = Depends(_service),
) -> MemoryRead:
    memory = await svc.create_memory(
        principal.tenant_id,
        principal.user_id,
        scope=body.scope,
        kind=body.kind,
        key=body.key,
        content=body.content,
        tags=body.tags,
    )
    return MemoryRead.model_validate(memory)


@router.get("/tools", response_model=List[ToolRead])
async def list_tools(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[ToolRead]:
    tools = await svc.list_tools(principal.tenant_id)
    return [ToolRead.model_validate(t) for t in tools]


@router.post("/tools", response_model=ToolRead, status_code=status.HTTP_201_CREATED)
async def create_tool(
    body: ToolCreate,
    principal: Principal = Depends(require_permission("integrations:write")),
    svc: AIPlatformService = Depends(_service),
) -> ToolRead:
    tool = await svc.create_tool(
        principal.tenant_id,
        principal.user_id,
        name=body.name,
        category=body.category,
        description=body.description,
        schema=body.parameters_schema,
        enabled=body.enabled,
    )
    return ToolRead.model_validate(tool)


@router.get("/templates", response_model=List[TemplateRead])
async def list_templates(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[TemplateRead]:
    templates = await svc.list_templates(principal.tenant_id)
    return [TemplateRead.model_validate(t) for t in templates]


@router.post("/templates", response_model=TemplateRead, status_code=status.HTTP_201_CREATED)
async def create_template(
    body: TemplateCreate,
    principal: Principal = Depends(require_permission("integrations:write")),
    svc: AIPlatformService = Depends(_service),
) -> TemplateRead:
    template = await svc.create_template(
        principal.tenant_id,
        principal.user_id,
        name=body.name,
        scope=body.scope,
        content=body.content,
        schema=body.template_schema,
        tags=body.tags,
    )
    return TemplateRead.model_validate(template)


@router.get("/analytics", response_model=List[AnalyticsRead])
async def list_analytics(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[AnalyticsRead]:
    analytics = await svc.analytics.list_for_tenant(principal.tenant_id)
    return [AnalyticsRead.model_validate(a) for a in analytics]


@router.get("/costs", response_model=List[CostRead])
async def list_costs(
    principal: Principal = Depends(require_permission("integrations:read")),
    svc: AIPlatformService = Depends(_service),
) -> List[CostRead]:
    costs = await svc.costs.list_for_tenant(principal.tenant_id)
    return [CostRead.model_validate(c) for c in costs]

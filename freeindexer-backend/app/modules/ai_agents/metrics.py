"""Metrics helpers for the AI Agent Platform."""
from __future__ import annotations

from prometheus_client import Counter, Gauge

ai_agents_total = Gauge(
    "ai_agents_total",
    "Total configured AI agents",
    ["tenant_id", "agent_type"],
)
ai_agent_executions_total = Counter(
    "ai_agent_executions_total",
    "Total AI agent executions",
    ["tenant_id", "status"],
)
ai_provider_requests_total = Counter(
    "ai_provider_requests_total",
    "Total requests sent to AI providers",
    ["tenant_id", "provider"],
)

__all__ = [
    "ai_agents_total",
    "ai_agent_executions_total",
    "ai_provider_requests_total",
]

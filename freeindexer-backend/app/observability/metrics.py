"""Prometheus metrics registry for the platform.

Defines the integration-hub metrics required by Phase 29 and exposes a helper
to render the ``/metrics`` endpoint output.
"""
from __future__ import annotations

from prometheus_client import CONTENT_TYPE_LATEST, Counter, Gauge, generate_latest

# Phase 29 required metrics
integrations_total = Gauge(
    "integrations_total", "Total installed integrations", ["tenant_id", "status"]
)
connector_health_score = Gauge(
    "connector_health_score",
    "Connector health score (0-1)",
    ["connector_id", "connector_type"],
)
sync_jobs_total = Counter(
    "sync_jobs_total", "Total sync jobs", ["connector_type", "mode", "status"]
)
sync_failures_total = Counter(
    "sync_failures_total", "Total sync failures", ["connector_type"]
)
webhook_deliveries_total = Counter(
    "webhook_deliveries_total", "Total webhook deliveries", ["direction", "status"]
)
webhook_failures_total = Counter(
    "webhook_failures_total", "Total webhook delivery failures", ["direction"]
)
credential_refresh_total = Counter(
    "credential_refresh_total", "Total credential refresh operations", ["status"]
)

# Phase 30 AI agent metrics
ai_agents_total = Gauge(
    "ai_agents_total", "Total configured AI agents", ["tenant_id", "agent_type"]
)
ai_agent_executions_total = Counter(
    "ai_agent_executions_total", "Total AI agent executions", ["tenant_id", "status"]
)
ai_provider_requests_total = Counter(
    "ai_provider_requests_total", "Total requests sent to AI providers", ["tenant_id", "provider"]
)

# Phase 31 AI platform metrics
ai_platform_provider_health = Gauge(
    "ai_platform_provider_health",
    "Health status of AI platform providers",
    ["tenant_id", "provider", "status"],
)
ai_platform_tool_execution_total = Counter(
    "ai_platform_tool_execution_total",
    "Total AI platform tool executions",
    ["tenant_id", "tool", "status"],
)
ai_platform_memory_usage = Gauge(
    "ai_platform_memory_usage",
    "AI platform memory usage bytes",
    ["tenant_id", "scope", "kind"],
)
ai_platform_knowledge_retrieval_total = Counter(
    "ai_platform_knowledge_retrieval_total",
    "Total knowledge retrieval actions",
    ["tenant_id", "query_type", "status"],
)
knowledge_documents_indexed_total = Counter(
    "knowledge_documents_indexed_total",
    "Total knowledge documents indexed",
    ["tenant_id", "status"],
)
knowledge_search_total = Counter(
    "knowledge_search_total",
    "Total knowledge search queries",
    ["tenant_id", "status"],
)
knowledge_retrieval_logs_total = Counter(
    "knowledge_retrieval_logs_total",
    "Total knowledge retrieval log records",
    ["tenant_id", "outcome"],
)
ai_platform_analytics_total = Counter(
    "ai_platform_analytics_total",
    "Total AI analytics records emitted",
    ["tenant_id", "metric_name"],
)

# Phase 34 observability / security / governance metrics
observability_metrics_recorded_total = Counter(
    "observability_metrics_recorded_total",
    "Total custom metrics recorded",
    ["tenant_id", "metric_name"],
)
observability_metrics_aggregations_total = Counter(
    "observability_metrics_aggregations_total",
    "Total metrics aggregation runs",
    ["tenant_id"],
)
observability_traces_total = Counter(
    "observability_traces_total",
    "Total distributed trace spans finished",
    ["tenant_id", "status"],
)
observability_logs_total = Counter(
    "observability_logs_total",
    "Total structured log records emitted",
    ["tenant_id", "level"],
)
observability_health_status = Gauge(
    "observability_health_status",
    "Dependency health status (1=healthy, 0=unhealthy)",
    ["dependency", "status"],
)
observability_health_checks_total = Counter(
    "observability_health_checks_total",
    "Total health check executions",
    ["tenant_id", "status"],
)
observability_alerts_total = Counter(
    "observability_alerts_total",
    "Total alert lifecycle events",
    ["tenant_id", "severity", "status"],
)
observability_incidents_total = Counter(
    "observability_incidents_total",
    "Total incident lifecycle events",
    ["tenant_id", "severity", "status"],
)
observability_security_events_total = Counter(
    "observability_security_events_total",
    "Total security center events",
    ["tenant_id", "event_type", "severity"],
)
observability_compliance_reports_total = Counter(
    "observability_compliance_reports_total",
    "Total compliance reports generated",
    ["tenant_id", "framework"],
)
observability_diagnostics_total = Counter(
    "observability_diagnostics_total",
    "Total diagnostic runs",
    ["tenant_id", "status"],
)
observability_sla_compliance = Gauge(
    "observability_sla_compliance",
    "SLA compliance ratio (0-1)",
    ["tenant_id"],
)
observability_sla_evaluations_total = Counter(
    "observability_sla_evaluations_total",
    "Total SLA evaluations",
    ["tenant_id", "status"],
)


def render_metrics() -> bytes:
    """Render the Prometheus exposition format."""
    return generate_latest()


__all__ = [
    "CONTENT_TYPE_LATEST",
    "integrations_total",
    "connector_health_score",
    "sync_jobs_total",
    "sync_failures_total",
    "webhook_deliveries_total",
    "webhook_failures_total",
    "credential_refresh_total",
    "ai_agents_total",
    "ai_agent_executions_total",
    "ai_provider_requests_total",
    "ai_platform_provider_health",
    "ai_platform_tool_execution_total",
    "ai_platform_memory_usage",
    "ai_platform_knowledge_retrieval_total",
    "ai_platform_analytics_total",
    "knowledge_documents_indexed_total",
    "knowledge_search_total",
    "knowledge_retrieval_logs_total",
    "observability_metrics_recorded_total",
    "observability_metrics_aggregations_total",
    "observability_traces_total",
    "observability_logs_total",
    "observability_health_status",
    "observability_health_checks_total",
    "observability_alerts_total",
    "observability_incidents_total",
    "observability_security_events_total",
    "observability_compliance_reports_total",
    "observability_diagnostics_total",
    "observability_sla_compliance",
    "observability_sla_evaluations_total",
    "render_metrics",
]

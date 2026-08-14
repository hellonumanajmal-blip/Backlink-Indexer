# Enterprise Observability Platform — Architecture

Phase 34 extends the FreeIndexer backend with production-grade observability,
security monitoring, governance, and compliance. It reuses the existing Clean
Architecture foundation and does not rewrite billing, indexing, AI, knowledge,
integrations, or other domain modules.

## Layers

```
┌────────────────────────────────────────────────────────────┐
│  REST API  /api/observability/*  (router.py)               │
│  RBAC: observability:read|write|admin + tenant isolation   │
├────────────────────────────────────────────────────────────┤
│  ObservabilityService (service.py) — use-case orchestration│
├──────────┬──────────┬──────────┬──────────┬────────────────┤
│ Metrics  │ Tracing  │ Logging  │ Health   │ SLA Monitor    │
│ Alerts   │ Incidents│ Security │ Govern.  │ Compliance     │
│ Diagnostics │ Dashboards                                      │
├────────────────────────────────────────────────────────────┤
│  Repositories — tenant-scoped CRUD                         │
├────────────────────────────────────────────────────────────┤
│  Models — incidents, alerts, traces, diagnostics,          │
│  governance_policies, compliance_reports, security_events, │
│  health_checks                                             │
└────────────────────────────────────────────────────────────┘
```

## Design decisions

- **Reuse, don't rewrite.** Auth, RBAC, audit logging, Prometheus metrics, and
  repository patterns remain the platform source of truth.
- **Correlation everywhere.** Request middleware propagates `X-Request-ID`,
  `X-Correlation-ID`, and `X-Trace-ID` into structured logs and spans.
- **Tenant isolation.** Every persistence query is scoped by `tenant_id`.
- **Background workers.** Celery tasks evaluate health, SLA, alerts, compliance
  scans, log cleanup, and metrics aggregation outside the request path.

# Enterprise Integrations Hub — Architecture

Phase 29 provides a secure, extensible connectivity layer between the platform
and external services. It follows Clean Architecture: the module depends only
on the foundation (auth, RBAC, audit, metrics, database) and exposes a stable
API; connectors depend on an SDK, never on each other.

## Layers

```
┌────────────────────────────────────────────────────────────┐
│  REST API  (app/modules/integrations/router.py)            │
│  /api/integrations  — RBAC + tenant isolation per request  │
├────────────────────────────────────────────────────────────┤
│  Service   (service.py)                                    │
│  IntegrationService — orchestrates all use cases           │
├──────────────┬───────────────┬──────────────┬─────────────┤
│ Sync Engine  │ Webhook       │ Credential   │ Health      │
│ (sync_engine)│ Platform      │ Vault        │ Monitor     │
│              │ (webhook_*)   │ (credential_ │ (service)   │
│              │               │  vault)      │             │
├──────────────┴───────────────┴──────────────┴─────────────┤
│  Connector SDK + Registry (connector_sdk, connector_       │
│  registry, connectors) — pluggable, versioned connectors   │
├────────────────────────────────────────────────────────────┤
│  Repository (repository.py) — tenant-scoped data access    │
├────────────────────────────────────────────────────────────┤
│  Models (models.py) — 8 tables, SQLAlchemy                 │
└────────────────────────────────────────────────────────────┘
```

## Components

| Component | File | Responsibility |
|-----------|------|----------------|
| IntegrationService | service.py | Use-case orchestration |
| IntegrationRepository | repository.py | Tenant-scoped persistence |
| ConnectorRegistry | connector_registry.py | connector type → class map |
| ConnectorManager | connector_registry.py | Instantiate connectors with context |
| CredentialVault | credential_vault.py | Fernet encryption, masking, rotation |
| SyncEngine | sync_engine.py | Sync execution, checkpoints, retries |
| WebhookPlatform | webhook_platform.py | Signatures, replay, idempotency, delivery |
| HealthMonitor | service.py | Connector health snapshots |

## Design decisions

- **No duplicated business logic.** The module reuses the foundation's auth,
  RBAC, audit, and metrics. Connectors integrate external services; they do not
  re-implement platform domain logic.
- **Pluggable SDK.** New connectors subclass `BaseConnector` and register with
  the `ConnectorRegistry`. No core changes are required to add a connector.
- **Tenant isolation.** Every repository query is scoped by `tenant_id`; every
  endpoint resolves the tenant from the authenticated principal.
- **Offline-safe connectors.** Built-in connectors validate configuration and
  report health without requiring live credentials, so the system runs in dev
  and tests without external dependencies.

## Data flow — outbound event

1. A platform module emits an event (e.g. `workflow.completed`).
2. `IntegrationService.publish_event` finds subscribed outbound endpoints.
3. `WebhookPlatform` signs the payload (HMAC-SHA256) and delivers via HTTP.
4. A `WebhookDelivery` row records status, attempts, and response.
5. Failures are retried with exponential backoff by the Celery retry task.

## Data flow — inbound webhook

1. External system POSTs to `/api/integrations/webhooks/inbound/{endpoint_id}`.
2. Signature + timestamp are verified (replay protection).
3. Idempotency key deduplicates repeat deliveries.
4. A `WebhookDelivery` row is persisted and the event is dispatched.

# Enterprise Integrations Hub — REST API

Base path: `/api/integrations`. All endpoints require a bearer token and enforce
RBAC permissions. All resources are tenant-scoped.

## Permissions

| Permission | Purpose |
|------------|---------|
| `integrations:read` | Read integrations, connectors, health, deliveries |
| `integrations:write` | Create/update integrations |
| `integrations:credentials` | Manage credentials, test connections |
| `integrations:sync` | Trigger synchronization |
| `integrations:webhooks` | Manage webhook endpoints, retries |
| `integrations:admin` | Delete integrations |

## Endpoints

### Overview
- `GET /api/integrations` — dashboard overview (counts, 24h activity, supported types)
- `GET /api/integrations/events` — list subscribable event types

### Integrations
- `GET /api/integrations/list` — list integrations
- `POST /api/integrations` — create integration
- `GET /api/integrations/{id}` — get integration
- `PATCH /api/integrations/{id}` — update integration
- `DELETE /api/integrations/{id}` — delete integration (admin)

### Connectors
- `GET /api/integrations/connectors/types` — list registered connector types + schemas
- `GET /api/integrations/connectors/{integration_id}` — list connectors for an integration

### Credentials
- `POST /api/integrations/credentials` — store an encrypted credential
- `GET /api/integrations/credentials/{integration_id}` — list credentials (masked)
- `POST /api/integrations/credentials/{credential_id}/rotate` — rotate a secret
- `POST /api/integrations/credentials/test/{integration_id}` — test connection

### Sync
- `POST /api/integrations/sync` — run a sync (`manual|scheduled|incremental|full`)
- `GET /api/integrations/sync/{integration_id}` — list sync jobs

### Webhooks
- `POST /api/integrations/webhooks/endpoints` — create endpoint
- `GET /api/integrations/webhooks/endpoints` — list endpoints
- `POST /api/integrations/webhooks/inbound/{endpoint_id}` — receive inbound webhook
- `GET /api/integrations/webhooks/deliveries/{endpoint_id}` — delivery history
- `POST /api/integrations/webhooks/deliveries/{delivery_id}/retry` — retry a delivery

### Health
- `POST /api/integrations/health/{integration_id}` — run a health check
- `GET /api/integrations/health/{integration_id}` — latest health snapshot

## Subscribable events

`workflow.completed`, `backlink.lost`, `backlink.recovered`, `index.verified`,
`visibility.changed`, `report.generated`, `invoice.paid`, `alert.created`,
`campaign.completed`.

## Webhook signatures

Outbound deliveries include:
- `X-Webhook-Timestamp`: Unix seconds
- `X-Webhook-Signature`: HMAC-SHA256 hex of `{timestamp}.{json_body}`

Inbound webhooks must provide `signature` and `timestamp`; requests outside the
tolerance window (default 300s) are rejected as replay attempts.

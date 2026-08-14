# Operations

## Background tasks (Celery)

| Task | Schedule | Purpose |
|------|----------|---------|
| `integrations.scheduled_sync` | on demand / beat | Run scheduled syncs |
| `integrations.health_checks` | 300s | Poll connector health |
| `integrations.webhook_retries` | 60s | Retry failed webhook deliveries |
| `integrations.credential_refresh` | 3600s | Detect expiring credentials |
| `integrations.cleanup` | 86400s | Purge old history/deliveries |
| `integrations.metrics_aggregation` | on demand | Aggregate metrics |

Start a worker:

```bash
celery -A app.modules.integrations.tasks.celery_app worker --loglevel=info
celery -A app.modules.integrations.tasks.celery_app beat --loglevel=info
```

## Monitoring

Prometheus metrics are exposed at `/metrics`:

- `integrations_total{tenant_id, status}`
- `connector_health_score{connector_id, connector_type}`
- `sync_jobs_total{connector_type, mode, status}`
- `sync_failures_total{connector_type}`
- `webhook_deliveries_total{direction, status}`
- `webhook_failures_total{direction}`
- `credential_refresh_total{status}`

## Audit logging

Security-relevant actions (integration create/update/delete, credential
store/rotate, sync runs, endpoint creation) emit structured audit records via
`app.core.audit.audit_log`. Secrets are always masked before logging.

## Credential expiry monitoring

`IntegrationService.expiring_credentials(tenant_id, within_days)` returns
credentials nearing expiry. The `credential_refresh` task surfaces these so
operators can rotate before expiry.

## Troubleshooting

- **Integration stuck in `error`** — check `last_error` and the latest
  `sync_jobs` row; re-run `POST /api/integrations/sync`.
- **Webhook deliveries failing** — inspect
  `GET /api/integrations/webhooks/deliveries/{endpoint_id}` for response codes;
  verify the target URL and secret.
- **Health degraded** — run `POST /api/integrations/health/{integration_id}` and
  confirm credentials are present and not expired.

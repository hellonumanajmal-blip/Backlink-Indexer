# Deployment

## Database

Apply migration:

```bash
alembic upgrade head
```

Migration `0018_observability.py` creates:

`incidents`, `alerts`, `traces`, `diagnostics`, `governance_policies`,
`compliance_reports`, `security_events`, `health_checks`.

## Runtime

1. Start API (`uvicorn app.main:app`)
2. Start Celery worker with observability tasks imported
3. Scrape Prometheus `/metrics`
4. Optionally configure OTLP exporter instead of console spans

## Frontend

Internal console: `/internal/observability` — consumes `/api/observability/*`
(via `NEXT_PUBLIC_API_URL` / proxy target).

## Environment

Existing `FI_*` settings remain authoritative. No new required secrets for the
default local/dev configuration.

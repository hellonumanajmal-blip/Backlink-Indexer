# Deployment

## Prerequisites

- Python 3.10+
- PostgreSQL (production) or SQLite (local/dev)
- Redis (Celery broker/result backend)

## Configuration

Environment variables (prefix `FI_`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `FI_DATABASE_URL` | `sqlite+aiosqlite:///./freeindexer.db` | Async DB URL |
| `FI_REDIS_URL` | `redis://localhost:6379/0` | Redis |
| `FI_CELERY_BROKER_URL` | `redis://localhost:6379/1` | Celery broker |
| `FI_CELERY_RESULT_BACKEND` | `redis://localhost:6379/2` | Celery results |
| `FI_SECRET_KEY` | — | JWT + fallback encryption key |
| `FI_CREDENTIAL_ENCRYPTION_KEY` | derived | Fernet key for credential vault |
| `FI_ENVIRONMENT` | `development` | Set to `production` to enforce auth |
| `FI_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS` | `300` | Replay window |
| `FI_WEBHOOK_MAX_RETRIES` | `5` | Webhook retry cap |

Generate a Fernet key for production:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

## Database migration

```bash
cd freeindexer-backend
alembic upgrade head   # applies 0014_enterprise_integrations
```

This creates the 8 tables: `integrations`, `connectors`,
`connector_credentials`, `sync_jobs`, `sync_history`, `webhook_endpoints`,
`webhook_deliveries`, `integration_health`.

## Run the API

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Run workers

```bash
celery -A app.modules.integrations.tasks.celery_app worker --loglevel=info
celery -A app.modules.integrations.tasks.celery_app beat --loglevel=info
```

## Security checklist

- [ ] `FI_ENVIRONMENT=production`
- [ ] Strong, unique `FI_SECRET_KEY`
- [ ] Dedicated `FI_CREDENTIAL_ENCRYPTION_KEY` (not derived)
- [ ] HTTPS only; webhook endpoints use HTTPS URLs
- [ ] Redis and Postgres not exposed publicly
- [ ] RBAC roles assigned with least privilege

## Tests

```bash
cd freeindexer-backend
pytest tests/ -q
```

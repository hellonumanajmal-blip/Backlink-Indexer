# Phase 2 Migration Notes

**Completed:** Discovery Validator & Crawlability Intelligence  
**Date:** 2026-07-27  
**Depends on:** Phase 1 modular platform

---

## What changed

1. New module `backend/app/modules/discovery_validator/` (validators, health score, recommendations, Celery tasks, API).
2. New table `backlink_validation_results` (append-only history) — Alembic `002_validation`.
3. EventBus now also enqueues `discovery_validator.validate_one` on `BacklinkCreated` / `BacklinkUpdated` (pipeline unchanged).
4. New auth APIs under `/api/validator/*` (existing endpoints untouched).
5. New UI: `/internal/validator?id=…` + **Health** link on the backlinks dashboard.

## Architecture

See [docs/architecture/PHASE_2_DISCOVERY_VALIDATOR.md](../architecture/PHASE_2_DISCOVERY_VALIDATOR.md).

## Database migration

```bash
cd backend
alembic upgrade head
```

`init_db()` also creates the new table on API startup if missing (dev convenience).

## New env vars (optional)

```env
VALIDATOR_TIMEOUT_SECONDS=12
VALIDATOR_MAX_REDIRECTS=8
VALIDATOR_WEIGHT_HTTP=20
VALIDATOR_WEIGHT_ROBOTS=20
VALIDATOR_WEIGHT_CANONICAL=15
VALIDATOR_WEIGHT_META_ROBOTS=15
VALIDATOR_WEIGHT_CONTENT=10
VALIDATOR_WEIGHT_STRUCTURED=10
VALIDATOR_WEIGHT_PERFORMANCE=10
```

## Nightly batch

Option A — Celery (recommended): call `discovery_validator.validate_all` on a schedule (Coolify cron or Celery Beat).

```bash
celery -A app.modules.shared.celery_app.celery call discovery_validator.validate_all
```

Option B — HTTP: authenticated `POST /api/validator/run-all`.

## API (new only)

| Method | Path |
|--------|------|
| POST | `/api/validator/run/{id}` |
| POST | `/api/validator/run-all` |
| GET | `/api/validator/{id}` (latest) |
| GET | `/api/validator/latest/{id}` |
| GET | `/api/validator/history/{id}` |

All responses include an honest disclaimer: Health Score does **not** predict indexing.

## Honest limitations

- Technical signals only (HTTP, robots, HTML, headers, schema types).
- Never scrapes Google Search / never automates Google.
- Does not determine Google’s indexing state.
- Manual Check Now remains the human verification path for third-party indexing.

## Rollback

`alembic downgrade 001_initial` drops `backlink_validation_results`. Code rollback: remove validator router include and EventBus validation dispatch.

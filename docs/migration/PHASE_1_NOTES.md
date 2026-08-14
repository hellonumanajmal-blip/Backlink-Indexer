# Phase 1 Migration Notes

**Completed:** Modular Clean Architecture + Redis/Celery/EventBus  
**Date:** 2026-07-27  
**Tests:** 16 passed (feeds, WebSub, IndexNow, pipeline, EventBus, repository)

---

## What changed

1. **Source of truth** moved to `backend/app/modules/*` (services, repositories, DTOs, APIs, Celery tasks).
2. Legacy packages (`app.backlinks`, `app.shared`, …) are **compatibility shims** that re-export modular code — old imports keep working.
3. Discovery work no longer uses FastAPI `BackgroundTasks`. It flows:

   `API → Service → EventBus.publish → Celery task → pipeline_runner`

4. **Redis** is the Celery broker/result backend.
5. **docker-compose** now includes `redis` + `worker` services.
6. HTTP contracts (paths + JSON shapes) are unchanged for the MVP frontend.

## Architecture doc

See [docs/architecture/PHASE_1_CLEAN_ARCHITECTURE.md](../architecture/PHASE_1_CLEAN_ARCHITECTURE.md).

## Ops migration steps

1. Pull latest code.
2. Update `.env` from `.env.example` — add:

   ```env
   REDIS_URL=redis://redis:6379/0
   CELERY_BROKER_URL=redis://redis:6379/0
   CELERY_RESULT_BACKEND=redis://redis:6379/0
   CELERY_TASK_ALWAYS_EAGER=false
   ```

3. Restart stack:

   ```bash
   docker compose up --build -d
   ```

4. Confirm:

   - `GET /health` → `"architecture": "modular", "phase": 1`
   - Worker logs show Celery consuming `discovery`, `feeds`, `default`
   - Add a backlink → `pipeline_log` rows appear without blocking the HTTP response (unless eager mode)

## Local tests without Redis

```bash
cd backend
set CELERY_TASK_ALWAYS_EAGER=true
pytest -q
```

Conftest forces eager mode automatically.

## Rollback

If needed, pin to the pre-Phase-1 commit. Schema is unchanged — no DB migration required for Phase 1. Only process topology (API + worker + Redis) changed.

## Known follow-ups (later phases)

| Phase | Next work |
|-------|-----------|
| 2 | Discovery validator, robots/canonical/meta health score |
| 3 | Multi-sitemap engine polish, feed validation suite expansion |
| 4 | Enterprise analytics + Excel/PDF exports |
| 5 | RBAC, audit logs, API tokens, webhooks |
| 6 | AI scoring (`discovery_score`, `predicted_index_days`) |

## Honest limitations (unchanged)

Google decides indexing. IndexNow is own-domain only. No Google scraping. No black-hat techniques. Manual Check Now remains the honest third-party verification method.

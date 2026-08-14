# Phase 3 Migration Notes

**Completed:** Enterprise Discovery Pipeline & Feed Distribution  
**Date:** 2026-07-27  
**Depends on:** Phase 1 + Phase 2

---

## What changed

1. New module `backend/app/modules/discovery_pipeline/` — multi-stage orchestrator with isolated failures.
2. Tables: `pipeline_jobs`, `feed_generation_history`, `websub_hub_circuit` (Alembic `003_pipeline`).
3. EventBus create/update/delete/sync now enqueue **enterprise pipeline** (+ Phase 2 validation on create/update).
4. Multi-sitemap files under `data/sitemaps/` served at `/sitemap_index.xml` and `/sitemaps/*.xml`.
5. Multi-hub WebSub with circuit breaker.
6. APIs under `/api/pipeline/*` and UI at `/internal/pipeline`.
7. Phase 1 `run_discovery_pipeline` is a compatibility shim → Phase 3 orchestrator.

## Migration

```bash
cd backend
alembic upgrade head
```

## New env vars

```env
WEBSUB_CIRCUIT_FAILURE_THRESHOLD=5
WEBSUB_CIRCUIT_COOLDOWN_SECONDS=300
WEBSUB_HUB_TIMEOUT_SECONDS=15
WEBSUB_HUB_URLS=https://pubsubhubbub.appspot.com/
FEED_PAGE_SIZE=100
```

## New API endpoints

| Method | Path |
|--------|------|
| POST | `/api/pipeline/run` |
| POST | `/api/pipeline/retry/{job_id}` |
| GET | `/api/pipeline/jobs` |
| GET | `/api/pipeline/jobs/{job_id}` |
| GET | `/api/pipeline/stats` |
| GET | `/api/pipeline/history` |
| GET | `/api/pipeline/metrics` |
| GET | `/sitemap_index.xml` |
| GET | `/sitemaps/{featured\|feeds\|resources}.xml` |

Existing endpoints unchanged.

## Honest limitations

Discovery assets only. IndexNow = owned URLs only. No Google scraping. No indexing guarantees.

## Architecture

See [docs/architecture/PHASE_3_DISCOVERY_PIPELINE.md](../architecture/PHASE_3_DISCOVERY_PIPELINE.md).

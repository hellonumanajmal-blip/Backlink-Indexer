# Phase 12 Migration & Upgrade Notes

| Field | Value |
|---|---|
| Release Date | 2026-07-28 |
| Version | 1.0.0-phase12 |
| Previous | 1.0.0-phase11 |
| Alembic | `013_search_intelligence` ← `012_discovery_pipeline_tables` |

---

## Summary

**No breaking API changes.** Phase 12 adds Search Engine Intelligence & Index Tracking. Existing Phase 1–11 endpoints and payloads are unchanged.

- Manual indexing observations only (no SERP scraping)
- Recommendations are evidence-based, never indexing guarantees
- Additive `/api/search-intelligence/*` routes

---

## Database Changes

New tables (create-only; no alterations to existing tables):

| Table | Purpose |
|-------|---------|
| `index_observations` | Per-backlink observation + confidence |
| `discovery_trends` | Score / crawl time series |
| `search_engine_metrics` | Named metric samples |
| `portfolio_insights` | Portfolio snapshots |
| `manual_verification_history` | User-confirmed index status |
| `recommendation_snapshots` | Deterministic recommendations |

Enums: `verification_status_enum`, `recommendation_category_enum`.

```bash
cd backend
alembic upgrade head
```

`init_db()` also creates missing tables on startup for local/dev.

---

## Environment Variables

None required. Optional Celery beat already registers Phase 12 schedules when the worker process loads `celery_app`.

---

## New Endpoints

```
GET  /api/search-intelligence/overview
GET  /api/search-intelligence/trends
GET  /api/search-intelligence/backlink/{id}
GET  /api/search-intelligence/portfolio
GET  /api/search-intelligence/recommendations
POST /api/search-intelligence/manual-verification
POST /api/search-intelligence/recalculate
```

RBAC: `search_intelligence.view|verify|recalculate`.

---

## Deployment Notes

1. Deploy backend with migration `013_search_intelligence`.
2. Restart API + Celery worker/beat so schedules and RBAC seed include new permissions.
3. Confirm `/health` reports `phase: 12` and `implementation_phase: 12`.
4. Open `/internal/search-intelligence` after admin login.
5. Prometheus scrapes pick up `pda_search_intelligence_*` after overview/recalculate traffic.

Rollback: `alembic downgrade 012_discovery_pipeline_tables` drops Phase 12 tables only.

---

## Compatibility

| Area | Status |
|------|--------|
| Existing REST contracts | Unchanged |
| Discovery Signals | Read for average scores |
| Crawl / Validator | Evidence source for recommendations |
| Auth / tenancy / billing | Unchanged |
| IndexNow / WebSub / Feeds | Unchanged |

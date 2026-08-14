# Phase 4 — Migration Notes

**Phase:** Enterprise Analytics, Intelligence Dashboard & Reporting  
**Date:** 2026-07-27  
**Depends on:** Phases 1–3 complete

## Summary

Phase 4 expands the thin Phase 1 `analytics` module into a full enterprise analytics package without changing existing HTTP contracts. Legacy `GET /api/analytics` remains identical. New dashboard, report, and export APIs sit alongside it.

## Data model

| Table | Purpose |
|-------|---------|
| `generated_reports` | Async report jobs + file metadata |
| `analytics_daily_rollup` | Per-UTC-day KPI JSON (trends without full scans) |
| `scheduled_exports` | Foundation for cron exports (runner not enabled yet) |

Alembic revision: `004_analytics` (revises `003_pipeline`).

## New endpoints

| Method | Path |
|--------|------|
| GET | `/api/analytics/overview` |
| GET | `/api/analytics/trends` |
| GET | `/api/analytics/platforms` |
| GET | `/api/analytics/pipeline` |
| GET | `/api/analytics/validation` |
| GET | `/api/analytics/issues` |
| GET | `/api/analytics/metrics` |
| POST | `/api/analytics/rollups/refresh` |
| GET | `/api/reports` |
| POST | `/api/reports/generate` |
| GET | `/api/reports/{id}` |
| GET | `/api/reports/{id}/download` |
| GET | `/api/exports` |

Unchanged: `GET /api/analytics`, `POST /api/notifications/weekly-summary`.

## Report formats

CSV, Excel (`.xlsx`), PDF, JSON, Markdown — via `openpyxl` and `reportlab`.

Report types: executive_summary, discovery_health, validation, pipeline, platform_comparison, technical_seo, operational_summary.

## Performance notes

- Dashboard payloads cached in-process (~60s TTL); cache hit/miss counters exposed.
- Unfiltered daily trends prefer `analytics_daily_rollup`.
- Aggregations use filtered SQL + latest-validation logic; issues paginated.
- Report generation runs on Celery (`analytics.generate_report`).

## Dashboard

UI: `/internal/analytics` — filter bar + tabs (Overview, Discovery, Pipeline, Platforms, Trends, Reports). Reusable widgets under `frontend/src/components/analytics/`.

## Deploy steps

1. `pip install -r backend/requirements.txt` (adds openpyxl, reportlab)
2. `alembic upgrade head` (applies `004_analytics`)
3. Restart API + Celery worker
4. Optional: `POST /api/analytics/rollups/refresh?days=30` after cutover

## Honest limitations

Metrics are observed only. No indexing guarantees. IndexNow rates are owned-URL pipeline logs only. WebSub latency is `null` until a latency column exists.

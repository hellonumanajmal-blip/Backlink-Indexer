# Phase 4 — Enterprise Analytics, Intelligence Dashboard & Reporting

**Status:** Complete  
**Depends on:** Phase 1 (modules, EventBus, Celery), Phase 2 (validation results), Phase 3 (pipeline jobs)  
**Rule:** No breaking HTTP contracts. Metrics are **deterministic and observed only**. No fabricated estimates unless labelled. No Google scraping. No indexing guarantees.

---

## Honest limitations

- All KPIs are computed from rows already stored in Postgres (backlinks, validation results, pipeline jobs, feed history, WebSub logs).
- “Success rates” mean **our** job/validation outcomes — not Google indexing outcomes.
- IndexNow metrics cover **owned URLs only**.
- Health scores come from Phase 2 validators; analytics never invents scores.
- Missing data surfaces as `null` / empty series, never invented numbers.

---

## Goals

1. Expand `analytics` into a full modular package (`api/`, `services/`, `repositories/`, `dto/`, `models/`, `events/`, `tasks/`, `reports/`, `exporters/`).
2. Keep legacy `GET /api/analytics` shape unchanged (compat shim).
3. Add filtered dashboard APIs: overview, trends, platforms, pipeline, validation, issues.
4. Persist generated reports + export metadata; support CSV / JSON / Markdown / Excel / PDF.
5. Nightly (and on-demand) **daily rollups** to avoid full-table scans on hot paths.
6. In-process + optional Redis TTL cache for dashboard payloads.
7. Enterprise analytics UI with reusable widgets, filters, loading/empty/error states.
8. Observability counters for query/report/export timing and cache hits.

## Non-goals

- RBAC / audit / API tokens (Phase 5).
- AI scoring or predictive analytics (Phase 6).
- Guaranteeing search-engine indexing.
- Rewriting Phase 1–3 modules.

---

## Analytics architecture

```
┌─────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  Dashboard  │────▶│  Analytics API   │────▶│ AnalyticsService   │
│  (Next.js)  │     │  /analytics/*    │     │ + ReportService    │
└─────────────┘     │  /reports/*      │     └─────────┬──────────┘
                    │  /exports        │               │
                    └──────────────────┘               ▼
                                         ┌─────────────────────────┐
                                         │ AggregationRepository   │
                                         │ (SQL aggregates +       │
                                         │  daily rollups)         │
                                         └───────────┬─────────────┘
                                                     │
              ┌──────────────┬───────────────┬───────┴────────┬──────────────┐
              ▼              ▼               ▼                ▼              ▼
        tracked_       backlink_       pipeline_        feed_gen /      websub_log
        backlinks      validation_     jobs             hub_circuit     pipeline_log
                       results
```

**Layering (same as Phases 1–3):**

| Layer | Responsibility |
|-------|----------------|
| `api/` | Auth, query params, DTO responses |
| `services/` | Filters, KPI formulas, cache, orchestrate reports |
| `repositories/` | SQLAlchemy aggregates; no business rules |
| `reports/` | Build in-memory report documents by type |
| `exporters/` | Serialize documents → bytes (csv/xlsx/pdf/json/md) |
| `tasks/` | Celery: generate report, refresh rollups |
| `models/` | `GeneratedReport`, `AnalyticsDailyRollup`, `ScheduledExport` (foundation) |

---

## Data aggregation strategy

### Live aggregates (filterable)

Used when filters are present or rollup is stale:

- Backlink counts: `deleted_at IS NULL` vs soft-deleted; group by `platform`, `indexed_status`.
- Validation: latest-per-backlink subquery for “current” health; full history for trends.
- Pipeline: group by day/status; parse `stages_json` for stage duration averages.
- Issues: explode `warnings` / `recommendations` JSON arrays; count frequencies.
- Platforms: join latest validation → backlink.platform.

### Daily rollups (`analytics_daily_rollup`)

One row per UTC calendar day with JSON payload:

```json
{
  "backlinks_active": 0,
  "backlinks_added": 0,
  "backlinks_deleted": 0,
  "validation_runs": 0,
  "avg_health_score": null,
  "pipeline_jobs": 0,
  "pipeline_completed": 0,
  "pipeline_failed": 0,
  "pipeline_partial": 0,
  "avg_pipeline_ms": null,
  "feed_generations": 0,
  "websub_success": 0,
  "websub_total": 0,
  "indexnow_success": 0,
  "indexnow_total": 0
}
```

- Built by `analytics.refresh_daily_rollups` (Celery beat or manual).
- Trends API prefers rollups for `granularity ∈ {day, week, month, quarter, year}` when **no** health/platform/status filters are applied.
- Custom date ranges still supported; missing days return `0` / `null` honestly.

### Determinism rules

- Rates = `success / total` when `total > 0`, else `null`.
- Averages use only non-null samples; expose `sample_size`.
- Every response includes a short `disclaimer`.

---

## Historical retention

| Store | Retention | Notes |
|-------|-----------|-------|
| Raw validation / pipeline / WebSub rows | Indefinite (ops decision) | Source of truth |
| Daily rollups | ≥ 5 years | Compact; regenerateable |
| Generated report files | Configurable (`analytics_report_ttl_days`, default 90) | Path + metadata in DB |
| Scheduled export defs | Indefinite | Foundation only — no cron runner yet |

Soft-deleted backlinks remain countable as “Deleted Backlinks” but are excluded from “Active”.

---

## Report generation flow

```
POST /api/reports/generate
  → create GeneratedReport (status=queued)
  → Celery analytics.generate_report
       → ReportBuilder(type, filters) → document dict
       → Exporter(format) → bytes + content_type
       → write to reports_dir/{id}.{ext}
       → status=ready | failed; duration_ms recorded
GET /api/reports/{id} → metadata (+ download URL when ready)
GET /api/reports/{id}/download → file stream
```

**Report types:** `executive_summary`, `discovery_health`, `validation`, `pipeline`, `platform_comparison`, `technical_seo`, `operational_summary`.

**Formats:** `csv`, `xlsx`, `pdf`, `json`, `markdown`.

Each document includes: `generated_at`, `filters`, `report_type`, `format`, `disclaimer`, `metrics`.

---

## Dashboard widget architecture

Frontend widgets are pure presentational components under `frontend/src/components/analytics/`:

| Widget | Props | Use |
|--------|-------|-----|
| `KpiCard` | label, value, hint | Overview KPIs |
| `TrendChart` | series[{t,v}] | Historical trends (CSS bars; no heavy chart lib) |
| `DataTable` | columns, rows | Issues / platforms |
| `Heatmap` | matrix | Health × platform (observed cells only) |
| `TopList` | items[{label,value}] | Common issues |
| `Timeline` | events | Validation / pipeline activity |
| `HealthDistribution` | buckets 0–20…80–100 | Discovery analytics |
| `StatusStrip` | map status→count | Pipeline status |

Widgets accept `loading` / `empty` / `error` so pages stay consistent.

---

## Performance strategy

1. **Indexed filters:** `validated_at`, `created_at`, `platform`, `status`, `health_score`, `http_status`.
2. **Latest-validation CTE** instead of N+1.
3. **Rollups** for unfiltered trend windows.
4. **Pagination** on issues / export listings (`page`, `page_size` ≤ 100).
5. **Lazy UI sections:** overview loads first; secondary panels fetch on tab/visibility.
6. Avoid `SELECT *` + Python loops for KPIs; prefer SQL `func.count` / `avg` / `group_by`.

---

## Cache strategy

- Key: `analytics:{endpoint}:{sha256(normalized_filters)}`.
- Backend: in-process TTL dict (default 60s); optional Redis when `REDIS_URL` is not memory.
- Invalidation: soft — TTL expiry; report generation does not require immediate bust.
- Metrics: `analytics_cache_hit` / `analytics_cache_miss` counters.

---

## Testing strategy

| Layer | Coverage |
|-------|----------|
| Repository | Aggregate queries with seeded SQLite fixtures |
| Services | KPI math, filter parsing, cache hit/miss |
| Reports / exporters | Each format produces non-empty bytes; JSON round-trip |
| API | Auth required; legacy `/api/analytics` unchanged; new routes 200 |
| Frontend | Widget empty/loading render (lightweight) |
| Regression | Full Phase 1–3 suite green |

Target: ≥ 90% line coverage on new analytics package paths exercised by tests.

---

## Database changes (migration `004_analytics`)

### `generated_reports`

- `id`, `report_type`, `format`, `status`, `filters_json`, `file_path`, `file_size`, `error_message`, `duration_ms`, `celery_task_id`, `created_at`, `completed_at`

### `analytics_daily_rollup`

- `day` (date, PK), `payload_json`, `computed_at`

### `scheduled_exports` (foundation)

- `id`, `name`, `report_type`, `format`, `filters_json`, `cron_expr`, `enabled`, `last_run_at`, `created_at`

---

## API additions (non-breaking)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/analytics` | **Unchanged** legacy summary |
| GET | `/api/analytics/overview` | KPI cards + filters |
| GET | `/api/analytics/trends` | granularity + date range |
| GET | `/api/analytics/platforms` | platform comparison |
| GET | `/api/analytics/pipeline` | pipeline analytics |
| GET | `/api/analytics/validation` | discovery/validation analytics |
| GET | `/api/analytics/issues` | top technical issues |
| GET | `/api/reports` | list generated reports |
| POST | `/api/reports/generate` | queue report |
| GET | `/api/reports/{id}` | status/metadata |
| GET | `/api/reports/{id}/download` | file |
| GET | `/api/exports` | export listing (+ scheduled foundation) |

Shared filters (query): `date_from`, `date_to`, `platform`, `status`, `health_min`, `health_max`, `http_status`, `validation_ok`, `pipeline_status`.

---

## Observability

In-process counters (JSON + optional Prometheus text via `/api/analytics/metrics`):

- `analytics.query_ms_*`
- `analytics.dashboard_load_ms`
- `analytics.report_ms`
- `analytics.export_ms`
- `analytics.cache_hit` / `analytics.cache_miss`

---

## Frontend

Route: `/internal/analytics` — filter bar + tabbed panels (Overview, Discovery, Pipeline, Platforms, Trends, Reports). Nav links from Backlinks / Pipeline / Validator.

---

## Acceptance checklist

- [ ] Architecture doc complete before merge of code (this file)
- [ ] Legacy `/api/analytics` compatible
- [ ] New endpoints auth-gated and deterministic
- [ ] Reports generate in all five formats
- [ ] Dashboard performs with rollups + cache
- [ ] Existing tests green; new module tests added
- [ ] Migration notes published

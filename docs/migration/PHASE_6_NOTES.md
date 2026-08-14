# Phase 6 — Migration Notes

**Phase:** AI Discovery Intelligence, Quality Scoring & Predictive Insights  
**Date:** 2026-07-27  
**Depends on:** Phases 1–5

## Summary

Phase 6 adds a deterministic intelligence layer over observed validation/pipeline data. No LLM scoring. No Google scraping. No indexing guarantees. Optional future LLMs may only explain stored results.

## Database changes

Alembic revision: `006_intelligence` (revises `005_security`).

| Table | Purpose |
|-------|---------|
| `intelligence_scores` | Versioned discovery / indexability / quality scores |
| `intelligence_recommendations` | Rule-based recommendations |
| `intelligence_anomalies` | Severity-flagged anomalies |
| `intelligence_predictions` | Advisory predictions + confidence |
| `intelligence_duplicates` | Duplicate groups |
| `intelligence_broken_links` | Broken-link findings |
| `intelligence_job_runs` | Recalc idempotency / timing |

## Scoring formulas (summary)

**Discovery (0–100):** weighted points for HTTP, redirects, robots, meta robots, canonical, OG, Twitter, schema, content, latency, health, feed/pipeline rates.

**Indexability:** High / Medium / Low from crawlability blockers (HTTP, robots, noindex, canonical, redirects, content). Explicitly not an indexing claim.

**Quality:** technical, content, discovery, authority (manual only), overall average of observed components.

`SCORE_VERSION` / `RULE_VERSION` = `6.0.0`.

## Recommendation rules

`fix_http_error`, `fix_server_error`, `fix_robots`, `remove_noindex`, `repair_canonical`, `reduce_redirects`, `add_open_graph`, `add_twitter_card`, `improve_structured_data`, `improve_content_quality`, `improve_performance`.

## Prediction limitations

Advisory only. Methods: health stdev stability, capped P0/P1 uplift heuristic, open-rec count, rolling pipeline success rate. Never predicts Google indexing.

## API additions

`GET /api/intelligence/{overview,scores,recommendations,anomalies,predictions,duplicates,broken-links}`  
`POST /api/intelligence/recalculate`

## RBAC

`intelligence.view`, `intelligence.manage`, `intelligence.recalculate` (seeded into default roles).

## Background jobs

Celery: `intelligence.recalculate_backlink`, `intelligence.recalculate_portfolio`, nightly/weekly helpers. Triggered from EventBus on backlink create/update, `ValidationCompleted`, `PipelineFinished`.

## Deploy

```bash
alembic upgrade head
# restart API + worker
# POST /api/intelligence/recalculate {"scope":"portfolio","force":true}
```

UI: `/internal/intelligence`

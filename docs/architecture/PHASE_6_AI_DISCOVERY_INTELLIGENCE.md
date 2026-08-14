# Phase 6 — AI Discovery Intelligence, Quality Scoring & Predictive Insights

**Status:** Complete  
**Depends on:** Phases 1–5  
**Rule:** No breaking HTTP contracts. No LLM-generated scores. No Google scraping. No indexing guarantees. All insights are deterministic, explainable, and backed by observed platform data.

---

## Honest limitations

- Scores reflect **technical signals already stored** (validation, pipeline, feeds, WebSub) — not Google’s index state.
- Predictions are **advisory** extrapolations from observed trends; they never claim indexing outcomes.
- Low-confidence results are labelled explicitly (`confidence` + `confidence_note`); the system does not invent missing fields.
- Optional future LLMs may only **explain** stored scores/recommendations in natural language; core engines remain offline and deterministic.

---

## Goals

1. Deterministic **Discovery**, **Indexability**, and **Quality** scores with versioned history.
2. Duplicate detection, broken-link detection, anomaly detection.
3. Rule-based recommendation engine (priority / impact / effort).
4. Advisory prediction engine with confidence scores.
5. Insights dashboard `/internal/intelligence`.
6. Celery recalculation (event-driven + nightly/weekly).
7. RBAC (`intelligence.view`, `intelligence.manage`, `intelligence.recalculate`) + audit logging.

## Non-goals

- LLM scoring or free-form “AI guesses”.
- Browser automation / SERP scraping.
- Guaranteeing or predicting Google indexing.
- Rewriting Phases 1–5 modules.

---

## AI architecture

```
Observed data (validation, pipeline, backlinks, feeds, websub)
        │
        ▼
┌───────────────────┐
│ Feature builder   │  ← pure functions; missing → null + confidence penalty
└─────────┬─────────┘
          ▼
┌───────────────────┐     ┌────────────────────┐
│ Scoring engines   │────▶│ Score history DB   │
│ (deterministic)   │     └────────────────────┘
└─────────┬─────────┘
          ├──────────▶ Recommendation rules
          ├──────────▶ Duplicate / broken detectors
          ├──────────▶ Anomaly detector (rolling baselines)
          └──────────▶ Prediction engine (trend extrapolations)
          ▼
┌───────────────────┐
│ Intelligence API  │◀── RBAC + audit
└───────────────────┘
          │
          ▼ (optional future)
┌───────────────────┐
│ LLM explainer     │  natural language ONLY over stored results
└───────────────────┘
```

**Module layout**

```
scoring/              discovery / indexability / quality formulas
recommendations/      rule catalog + generator
predictions/          advisory forecasts
anomaly_detection/    severity-flagged anomalies
ai_intelligence/      orchestration, API, tasks, overview aggregates
```

---

## Rule engine

- Rules are pure functions: `features → list[Recommendation]`.
- Each rule has stable `rule_id`, `version`, `priority`, `impact`, `effort`.
- Rules fire only when evidence keys are present; otherwise skipped (no guessing).
- Catalog version: `RULE_VERSION = "6.0.0"`.

---

## Scoring architecture

### Discovery Score (0–100)

Weighted sum of observed factors (weights sum to 100; absent factors redistribute or lower confidence):

| Factor | Weight | Source |
|--------|--------|--------|
| HTTP status | 15 | validation |
| Redirect count | 8 | validation |
| Robots.txt | 12 | validation |
| Meta / X-Robots | 12 | validation |
| Canonical | 10 | validation |
| Open Graph | 5 | validation |
| Twitter Card | 4 | validation |
| Structured data | 8 | validation |
| Content quality | 8 | title/h1/words |
| Response time | 6 | validation |
| Health score | 7 | Phase 2 |
| Feed / pipeline success | 5 | pipeline/feed history |

Store: `score`, `score_version`, `calculated_at`, `confidence`, `breakdown_json`, `backlink_id`.

### Indexability Score

Maps crawlability signals → **High / Medium / Low** + explanation list. Never asserts “indexed by Google”.

### Quality Score

Sub-scores 0–100: Authority (manual authority_score if present else low-confidence null contribution), Technical, Content, Discovery, Overall = weighted blend.

---

## Recommendation engine

Priority: `P0`–`P3`. Impact/effort: `high|medium|low`.  
Examples: fix robots, remove noindex, repair canonical, add OG/schema, reduce redirects, fix HTTP errors.

---

## Prediction engine

Examples (advisory only):

- Validation stability (variance of recent health scores)
- Expected health after applying open P0/P1 fixes (heuristic uplift caps)
- Pipeline reliability (rolling success rate trend)

Every prediction: `value`, `unit`, `confidence`, `method`, `disclaimer`.

---

## Feature engineering

`FeatureSet` dataclass from latest validation + recent pipeline jobs for that backlink (or global rates when backlink-scoped data missing). Confidence = fraction of critical features present × signal freshness decay.

---

## Confidence scoring

```
confidence = clamp(0, 1, present_critical / total_critical * freshness * consistency)
```

- `freshness`: 1.0 if validated < 7d; decays to 0.5 by 30d.
- If `confidence < 0.4`: attach `confidence_note = "Low confidence — insufficient observed signals."`

---

## Background job flow

```
BacklinkCreated/Updated → intelligence.recalculate_backlink
Validation saved → publish ValidationCompleted → recalculate_backlink
PipelineFinished → publish PipelineFinished → recalculate_portfolio_signals
Nightly → intelligence.nightly_maintenance (anomalies + stale scores)
Weekly → intelligence.full_recalculate
POST /api/intelligence/recalculate → queue (scoped or full)
```

Idempotency key: `(backlink_id, score_version, validation_id)`.

---

## Database changes (`006_intelligence`)

- `intelligence_scores` — per backlink score rows (type, value, band, confidence, breakdown, version, calculated_at)
- `intelligence_recommendations` — generated recs (rule_id, priority, …, active)
- `intelligence_anomalies` — anomaly events
- `intelligence_predictions` — latest advisory predictions
- `intelligence_duplicates` — duplicate groups
- `intelligence_broken_links` — broken findings
- `intelligence_job_runs` — recalculation audit/idempotency

---

## API additions

| Method | Path | Permission |
|--------|------|------------|
| GET | `/api/intelligence/overview` | `intelligence.view` |
| GET | `/api/intelligence/scores` | `intelligence.view` |
| GET | `/api/intelligence/recommendations` | `intelligence.view` |
| GET | `/api/intelligence/anomalies` | `intelligence.view` |
| GET | `/api/intelligence/predictions` | `intelligence.view` |
| GET | `/api/intelligence/duplicates` | `intelligence.view` |
| GET | `/api/intelligence/broken-links` | `intelligence.view` |
| POST | `/api/intelligence/recalculate` | `intelligence.recalculate` |

---

## Security model

New permissions seeded into Phase 5 RBAC:

- `intelligence.view` — Viewer+
- `intelligence.manage` — Admin+
- `intelligence.recalculate` — Editor+ / Admin

All recalculations and manage actions → audit log.

---

## Performance strategy

- Incremental: only recalculate when `validation_id` / pipeline fingerprint changed.
- Batch portfolio scans with chunked queries.
- In-process TTL cache for overview (60s).
- Avoid N+1: latest-validation map in one query.

---

## Testing strategy

Unit: formulas, rules, detectors, confidence.  
API: authz + shape.  
Celery: eager recalculate idempotency.  
Regression: full Phase 1–5 suite green.

---

## Future LLM plug-in

Interface: `Explainer.explain(result: IntelligenceDocument) -> str`.  
Default: `NullExplainer` / template explainer. Core path never calls remote models.

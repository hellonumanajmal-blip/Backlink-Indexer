# Performance Baseline

Indicative local baselines (Phase 10, mock billing, eager Celery where enabled):

| Endpoint / job | VUs | p95 target |
|----------------|----|------------|
| GET /health | 20 | < 50ms |
| GET /api/v1/backlinks | 20 | < 300ms |
| Intelligence overview | 5 | < 500ms |
| Config backup | 1 | < 2s |
| Report generate (md) | 1 | < 5s |

Load stub: `backend/loadtests/api_smoke.js` (k6).

Optimisation opportunities: Redis cache for analytics, DB indexes on `project_id`, Celery queue sharding, connection pooling.

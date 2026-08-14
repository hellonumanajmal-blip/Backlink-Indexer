# Phase 10 Migration & Upgrade Notes

| Field | Value |
|---|---|
| Release Date | 2026-07-27 |
| Version | 1.0.0-phase10 |
| Previous | 1.0.0-phase9 |

---

## Summary

**No breaking API changes.** Phase 10 is operations, reliability, and observability only. All Phases 1–9 features are preserved exactly as-is.

- No API contracts changed
- No request/response payloads modified
- No authentication flows altered
- No database schema changes to existing tables
- Zero-downtime upgrade supported

---

## Database Changes

### New Table: `backup_records`

- **Creation Method:** `CREATE TABLE IF NOT EXISTS` (ORM `create_all` pattern)
- **Data Loss Risk:** None — no existing tables are modified, no data migrated or touched
- **Migration File:** `backend/alembic/versions/010_operations.py` (also created via ORM `create_all` when missing)
- **Purpose:** Tracks backup job metadata (type, status, HMAC digest, size, storage location)

### New Indexes

None on existing tables. Only indexes on the new `backup_records` table.

---

## New Environment Variables

All variables are **optional** with safe defaults. Existing deployments without these variables will continue to work unchanged.

| Variable | Default | Purpose |
|---|---|---|
| `BACKUP_HMAC_SECRET` | Falls back to `SESSION_SECRET` if unset | HMAC-SHA256 key for backup integrity verification |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | *(disabled — tracing no-op)* | OpenTelemetry OTLP collector endpoint (e.g. `http://otel-collector:4317`) |
| `OTEL_SERVICE_NAME` | `backlink-indexer` | Service name label for traces and metrics |
| `BUILD_SHA` | `unknown` | Git commit SHA injected by CI; exposed via `/api/operations/version` |
| `BUILD_TIME` | `unknown` | Build timestamp injected by CI; exposed via `/api/operations/version` |
| `CERT_MANAGER_ISSUER` | *(K8s only — not set)* | cert-manager Issuer/ClusterIssuer name for TLS certificate provisioning |

---

## New Endpoints Added

No existing endpoints were modified or removed. All endpoints below are **new additions**.

### Health Probes (Kubernetes-compatible)

```
GET /healthz/liveness
GET /healthz/readiness
GET /healthz/startup
```

### Metrics

```
GET /metrics                          # Prometheus text-format exposition
```

### Operations API

```
GET    /api/operations/health
GET    /api/operations/metrics
GET    /api/operations/status
GET    /api/operations/backups
GET    /api/operations/version
POST   /api/operations/backups/run
POST   /api/operations/backups/verify
```

### Compliance & Governance API

```
GET    /api/compliance/gdpr/map
GET    /api/compliance/gdpr/dsar-procedure
GET    /api/compliance/gdpr/data-breach-procedure

GET    /api/compliance/soc2/matrix
GET    /api/compliance/soc2/checklist

GET    /api/compliance/iso27001/annex-a
GET    /api/compliance/iso27001/isms-scope

GET    /api/compliance/incidents/playbook
GET    /api/compliance/incidents/bcp

GET    /api/compliance/access-review/...
POST   /api/compliance/access-review/...

GET    /api/compliance/audit/export
```

---

## New Security Headers

Applied to **all responses** via middleware. No breaking behavior; additional hardening only.

| Header | Value |
|---|---|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` |
| `Cross-Origin-Opener-Policy` | `same-origin` |
| `Cross-Origin-Resource-Policy` | `same-site` |
| `X-Permitted-Cross-Domain-Policies` | `none` |

The existing CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy headers from Phase 9 remain unchanged.

---

## Upgrade Procedure (Zero-Downtime)

Follow these 4 steps in order. The application supports running a mix of Phase 9 and Phase 10 nodes during the transition window.

### Step 1 — Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**New production dependencies** (additions only — no existing pins changed):
- `prometheus-client` — metrics exposition
- `ulid-py` — lexicographically sortable backup IDs
- `python-json-logger` — structured JSON logging

**New optional dependencies** (suitable for CI/dev images):
- `opentelemetry-api`, `opentelemetry-sdk`, `opentelemetry-exporter-otlp-proto-grpc`
- `opentelemetry-instrumentation-fastapi`, `opentelemetry-instrumentation-requests`
- `opentelemetry-instrumentation-celery`, `opentelemetry-instrumentation-dbapi`

**Dev-only additions** (not installed in production images):
- `bandit` — static SAST scanner
- `pip-audit` — dependency vulnerability scanner
- `locust` — load testing framework

### Step 2 — Run Alembic Migrations

```bash
cd backend
alembic upgrade head
```

> No explicit new migration files are required for Phase 10. The `backup_records` table is created automatically by the ORM `create_all` call at startup. Run this step anyway to ensure parity with any future migrations.

### Step 3 — Restart Services

Restart the API and Celery worker processes in rolling fashion:

```bash
# Docker Compose
docker compose up -d --no-deps api worker-discovery worker-feeds worker-default
```

Post-restart, the health endpoint reports:

```
GET /health
{
  "status": "ok",
  "phase": 9,
  "implementation_phase": 10
}
```

> `phase=9` preserves backward compatibility for any clients checking the old phase field. `implementation_phase=10` is the new authoritative field.

### Step 4 (Optional) — Register `/metrics` with Prometheus

If you have an existing Prometheus server, add a scrape target:

```yaml
# prometheus.yml additions
scrape_configs:
  - job_name: 'backlink-indexer-api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: /metrics
    scrape_interval: 15s
```

---

## Rollback Procedure

If issues are detected post-upgrade:

1. **Restore the previous Phase 9 container image** (or roll back the code checkout to the Phase 9 tag/commit).
2. Restart API + worker processes with the Phase 9 binary.
3. The `backup_records` table and any new columns are **simply unused** by Phase 9 — no data cleanup or schema rollback is needed.
4. Monitor standard metrics for 30 minutes to confirm stability.

> **There is no destructive migration step.** The new table coexists harmlessly with older code.

---

## Compatibility Matrix

| Component | Phase 9 Client → Phase 10 Server | Phase 10 Client → Phase 9 Server | docker-compose.yml | K8s manifests |
|---|---|---|---|---|
| API REST endpoints | ✅ Fully compatible | ✅ Fully compatible (new endpoints return 404) | ✅ Works unchanged | ✅ New overlay optional |
| Celery queues/tasks | ✅ Old tasks unchanged | ✅ New tasks gracefully no-op on Phase 9 workers | ✅ Works unchanged | ✅ Works |
| Database schema | ✅ Old queries unaffected | ✅ New `backup_records` table ignored by Phase 9 ORM | ✅ Works unchanged | ✅ Works |
| Redis keys / caching | ✅ Same keys, same TTLs | ✅ No new mandatory keys | ✅ Works unchanged | ✅ Works |
| Frontend Next.js | ✅ No contract changes | ✅ Works with Phase 9 API | ✅ Works unchanged | ✅ Works |

---

## Known Issues

None at release time.

---

## Post-Upgrade Validation Checklist (Smoke Tests)

Run these 12 curl checks against the upgraded environment to confirm success:

```bash
# 1. Liveness probe
curl -f http://localhost:8000/healthz/liveness

# 2. Readiness probe
curl -f http://localhost:8000/healthz/readiness

# 3. Startup probe
curl -f http://localhost:8000/healthz/startup

# 4. Legacy /health (backward compat)
curl -f http://localhost:8000/health | grep -q '"phase":9'

# 5. Prometheus metrics endpoint
curl -f http://localhost:8000/metrics | grep -q 'pda_http_requests_total'

# 6. Operations health
curl -f -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/operations/health

# 7. Operations version (check build SHA populated in CI)
curl -f -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/operations/version

# 8. Operations status (worker connectivity)
curl -f -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/operations/status

# 9. GDPR map endpoint
curl -f -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/compliance/gdpr/map

# 10. SOC2 matrix endpoint
curl -f -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/compliance/soc2/matrix

# 11. ISO 27001 annex A
curl -f -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:8000/api/compliance/iso27001/annex-a

# 12. Trigger and verify a backup
curl -f -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/operations/backups/run?type=all"
```

All 12 checks should return HTTP 200.

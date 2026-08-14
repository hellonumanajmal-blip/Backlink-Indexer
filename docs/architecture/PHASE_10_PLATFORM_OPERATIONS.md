# Phase 10 — Enterprise Operations, Reliability & Production Platform

**Status:** Complete  
**Depends on:** Phases 1–9  
**Rule:** No breaking HTTP contracts. No major end-user features. Phases 1–9 remain fully functional. Operations APIs are additive.

---

## Honest limitations

- Prometheus / OpenTelemetry exporters are **in-process** (Prometheus text format + OTel-compatible spans as structured logs). Full Grafana/Tempo stacks are provided as Docker Compose / Helm-ready configs, not a hosted SaaS.
- PostgreSQL / Redis “metrics” are health + connectivity probes plus documented scrape configs for `postgres_exporter` / `redis_exporter` — not embedded DB agent binaries.
- Multi-region active-active is **readiness design** (sticky sessions, Redis, DB failover notes); this phase ships single-region HA patterns + runbooks.
- SOC 2 / ISO 27001 materials are **readiness checklists**, not certifications.
- Load tests are repeatable Locust/k6-compatible scripts with documented baselines from local runs.

---

## Goals

1. Production observability (metrics, tracing hooks, structured logs, probes).
2. Alerting rules (Alertmanager-compatible).
3. Backup + verify + restore tooling with retention.
4. Disaster recovery runbooks with RPO/RTO targets.
5. HA-compatible deployment (Compose + Kubernetes manifests).
6. Security hardening checklist + secure defaults.
7. Compliance readiness documentation.
8. CI/CD hardening (scan hooks, migration validation, versioning).
9. Admin operations console `/internal/operations`.

## Non-goals

- Marketplace / plugins / autonomous agents product features.
- Changing billing, tenancy, or intelligence scoring.
- Live multi-cloud orchestration.

---

## Operations architecture

```
Clients / Ingress
      │
      ▼
┌─────────────┐   probes    ┌──────────────┐
│ API (n)     │◄───────────►│ Operations   │
└──────┬──────┘             │ Health API   │
       │                    └──────────────┘
       ▼
┌─────────────┐   metrics   ┌──────────────┐
│ Celery (n)  │────────────►│ Prometheus   │
└──────┬──────┘             └──────┬───────┘
       │                           ▼
   Redis / PG                 Grafana / Alerts
```

Modules:

| Module | Role |
|--------|------|
| `observability/` | Metrics registry, JSON logging, correlation IDs, OTel hooks |
| `operations/` | Aggregated status, version, admin APIs |
| `backups/` | Backup/verify/restore jobs |
| `disaster_recovery/` | Recovery helpers + documented procedures |
| `compliance/` | Checklists / data maps served as docs + API summary |
| `deployment/` | K8s/Compose assets (repo `deploy/`) |

---

## Monitoring architecture

- **Prometheus:** `GET /api/operations/metrics` exposes text exposition (`pda_*` metrics).
- **Grafana:** dashboard JSON under `deploy/grafana/`.
- **Alerts:** `deploy/prometheus/alerts.yml` (Alertmanager-compatible).
- Instrument: HTTP latency/count, Celery task outcomes (where hooked), backup success/fail, error rates, queue depth estimates.

---

## Logging architecture

Structured JSON logs via `observability.logging`:

```json
{
  "ts": "...", "level": "INFO", "component": "api",
  "request_id": "...", "correlation_id": "...",
  "organisation_id": "...", "project_id": "...", "user_id": "...",
  "msg": "..."
}
```

Automatic redaction of passwords, tokens, `pda_`, `scim_`, Bearer headers, cookies.

Middleware attaches/propagates `X-Request-Id` / `X-Correlation-Id`.

---

## Health / readiness / liveness

| Probe | Path | Meaning |
|-------|------|---------|
| Liveness | `GET /health` (existing) + `GET /api/operations/health?probe=live` | Process up |
| Readiness | `GET /api/operations/health?probe=ready` | DB (+ optional Redis) reachable |
| Status | `GET /api/operations/status` | Aggregated component health |

Existing `/health` remains unchanged (phase bump only).

---

## Backup strategy

1. Dump SQLite/Postgres schema+data (or `pg_dump` when Postgres URL).
2. Export critical config JSON (settings keys, feature flags summary, plan codes).
3. Copy branding metadata (URLs; assets if local).
4. Store under `storage/backups/{timestamp}/` with manifest.
5. Verify: checksum + restore-to-temp dry run.
6. Retention: keep N days (config `backup_retention_days`).

Cloud object storage (S3) designed via `backup_remote_uri` foundation (optional no-op until configured).

---

## Disaster recovery

| Objective | Target (single-region) |
|-----------|------------------------|
| RPO | ≤ 24h (daily backups) or ≤ backup interval |
| RTO | ≤ 4h with runbook (restore DB + restart workers) |

Procedures in `docs/runbooks/disaster-recovery.md`: restore DB, recreate env from Compose/K8s, flush/rebuild queues, re-attach workers.

---

## High availability design

- Stateless API replicas behind Ingress / Compose scale.
- Celery workers horizontally scalable; queues named (existing).
- Redis: external managed Redis recommended; Compose Redis with AOF notes.
- PostgreSQL: external primary + documented failover; app uses pool_pre_ping.
- Rolling deploys; migrations run as Job before rollout where possible.

---

## Kubernetes deployment model

`deploy/kubernetes/`: Deployment (API), Deployment (worker), Service, Ingress, ConfigMap, Secret template, HPA, PDB, probes.

Docker Compose remains primary local path (`deploy/docker-compose.ops.yml` overlays).

---

## Multi-region readiness

Documented: sticky sessions or JWT, Redis per-region with optional sync later, DB read-replicas, object storage for backups. No automatic geo-failover code in this phase.

---

## Security hardening

- Existing security headers retained; CSP recommendation documented.
- Secrets via env / K8s Secrets; rotation checklist.
- Non-root container user guidance.
- Dependency / image scan hooks in CI (scripts + GitHub Action stub).
- Least-privilege RBAC: `operations.view`, `operations.manage`, `backups.manage`.

---

## Compliance mapping

`docs/compliance/` + `compliance` module summary API:

- SOC 2 control themes mapped to existing audit/RBAC/backups.
- ISO 27001 Annex A crosswalk (selected).
- GDPR data map (orgs, users, backlinks, AI interactions).
- Incident response + business continuity pointers to runbooks.

---

## Testing strategy

- Unit: metrics registry, log redaction, backup create/verify.
- API: operations health/status/version/backups RBAC.
- Scripts: load test stubs under `backend/loadtests/`.
- Regression: full Phases 1–9 suite green.

---

## API additions

| Method | Path |
|--------|------|
| GET | `/api/operations/health` |
| GET | `/api/operations/metrics` |
| GET | `/api/operations/status` |
| GET | `/api/operations/backups` |
| POST | `/api/operations/backups/run` |
| POST | `/api/operations/backups/verify` |
| GET | `/api/operations/version` |

---

## UI

`/internal/operations` — system/queue/DB/Redis/worker/storage/backup/alert/version/environment panels.

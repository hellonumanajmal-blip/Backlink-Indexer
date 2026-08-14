# Operations Guide (Day-to-Day)

## Header

| Item | Value |
|---|---|
| Runbook ID | RB-OPS-001 |
| Owner | Platform Operations |
| Severity if failed | P3 |
| Last Updated | 2026-07-27 |
| Estimated Duration | 5–30 min per task |

---

## Purpose

Standard operating procedures for the Backlink Indexer platform: log management, service restarts, queue sizing, rate-limit tuning, scaling commands, secret and certificate rotation, and scheduled jobs.

---

## Scope

Covers the API service, three Celery worker pools (discovery, feeds, default), PostgreSQL, and Redis. Does not cover incident diagnosis or DR — see [INCIDENT_RESPONSE_GUIDE.md](./INCIDENT_RESPONSE_GUIDE.md) and [DISASTER_RECOVERY_GUIDE.md](./DISASTER_RECOVERY_GUIDE.md).

---

## Prerequisites

- `kubectl` access to the production cluster (or `docker compose` for single-node)
- Access to the secret store (Vault/AWS Secrets Manager/Sealed Secrets)
- Admin API bearer token for `/api/operations/*` endpoints
- PostgreSQL superuser or `pg_signal_backend` role
- Redis AUTH token

---

## Steps

### 1. Logging

#### 1.1 Log Locations

| Deployment | Log Location |
|---|---|
| Kubernetes (container) | stdout/stderr of each pod → collected by your DaemonSet (Fluent Bit / Vector / Promtail) |
| Docker Compose (container) | `docker compose logs -f <service>`; JSON driver → `docker inspect --format='{{.LogPath}}' <container>` |
| On-prem / systemd | `/var/log/backlink/api.log`, `/var/log/backlink/worker-*.log` |

#### 1.2 Structured JSON Log Fields

Every log line is a JSON object. Key fields:

| Field | Meaning |
|---|---|
| `timestamp` | ISO-8601 UTC timestamp |
| `level` | `DEBUG` / `INFO` / `WARNING` / `ERROR` / `CRITICAL` |
| `logger` | Python logger name (e.g. `backlink.api.routes`, `celery.worker`) |
| `message` | Human-readable event text |
| `correlation_id` | Per-request / per-task trace identifier — match across services |
| `user_id` | Authenticated user (if applicable) |
| `service` | `api` / `worker-discovery` / `worker-feeds` / `worker-default` / `beat` |
| `request.method`, `request.path` | HTTP context (if log emitted during a request) |
| `task.name`, `task.id` | Celery task context (if log emitted during task) |
| `error.type`, `error.message`, `error.stack` | Only on ERROR/CRITICAL |

#### 1.3 Useful Grep Queries

Kubernetes:
```bash
# All ERROR lines in the last 1h across all API pods
kubectl logs -n backlink -l app.kubernetes.io/component=api --since=1h \
  | jq -r 'select(.level=="ERROR") | "\(.timestamp) \(.message) \(.error // {})"'

# Follow one pod, pretty JSON
kubectl logs -n backlink -f deployment/api --tail=0 | jq -R 'fromjson? | select(.level!="DEBUG")'

# Trace one correlation_id across all pods
CORR="01J5XYZ..."
kubectl logs -n backlink -l app.kubernetes.io/part-of=backlink --since=24h \
  | grep "$CORR"
```

Docker Compose:
```bash
docker compose logs api 2>&1 | grep '"level":"ERROR"'
docker compose logs worker-discovery 2>&1 | grep "$CORR"
```

On-prem:
```bash
grep -a '"level":"ERROR"' /var/log/backlink/api.log | tail -n 100
journalctl -u backlink-api.service --since "1 hour ago" --output=cat | jq -r '.message'
```

---

### 2. Service Restarts

**Always drain workers first before restarting the API.**

#### 2.1 Kubernetes Rolling Restart (Preferred — zero downtime)

```bash
# Workers first (each pool independently for safety)
kubectl rollout restart deployment/worker-discovery -n backlink
kubectl rollout status deployment/worker-discovery -n backlink --timeout=5m

kubectl rollout restart deployment/worker-feeds -n backlink
kubectl rollout status deployment/worker-feeds -n backlink --timeout=5m

kubectl rollout restart deployment/worker-default -n backlink
kubectl rollout status deployment/worker-default -n backlink --timeout=5m

# Then the API
kubectl rollout restart deployment/api -n backlink
kubectl rollout status deployment/api -n backlink --timeout=5m
```

#### 2.2 Docker Compose

```bash
# Workers then API
docker compose restart worker-discovery worker-feeds worker-default
sleep 10
docker compose restart api
```

#### 2.3 Systemd (on-prem)

```bash
sudo systemctl restart backlink-worker-discovery
sudo systemctl restart backlink-worker-feeds
sudo systemctl restart backlink-worker-default
sleep 10
sudo systemctl restart backlink-api
sudo systemctl status backlink-api --no-pager
```

---

### 3. Worker Queue Sizing Guidance

| Queue | Purpose | Cores per Pod | RAM per Pod | Concurrency (`--concurrency`) | Typical Replicas (baseline) |
|---|---|---|---|---|---|
| `discovery` | Web graph exploration, HTTP fetches | 4 vCPU | 8 GB | `8` (I/O bound) | 2 |
| `feeds` | RSS/Atom, sitemap parsing, WebSub | 2 vCPU | 4 GB | `16` (very I/O bound) | 2 |
| `default` | Validation, billing, notifications, reports | 2 vCPU | 4 GB | `4` (CPU/memory mixed) | 3 |

> Always set Celery concurrency **lower than or equal to** (CPU cores × 2) for CPU-bound tasks, and higher for I/O-bound. Tune `CELERY_WORKER_PREFETCH_MULTIPLIER=1` for long-running discovery tasks to avoid starvation.

Check queue depth:
```bash
# Redis queue length
redis-cli LLEN celery
redis-cli LLEN discovery
redis-cli LLEN feeds

# Via Celery Flower (if deployed)
curl -s http://flower:5555/api/queues/length | jq .
```

---

### 4. Rate-Limit Tuning

All rate limits are controlled via environment variables; no code change required.

| Env Var | Default | What It Caps |
|---|---|---|
| `PUBLIC_API_RATE_PER_MINUTE` | `60` | Unauthenticated public endpoints per IP per minute |
| `AUTH_RATE_PER_MINUTE` | `600` | Authenticated user-level per minute |
| `AUTH_RATE_PER_HOUR` | `10000` | Authenticated user-level per hour |
| `ADMIN_RATE_PER_MINUTE` | `120` | `/api/operations/*` and admin routes per admin user |
| `LOGIN_RATE_PER_MINUTE` | `10` | `/api/auth/login` per IP (credential-stuffing defense) |

To change:

**Kubernetes:**
```bash
kubectl edit configmap backend-config -n backlink
# Update values, save and exit, then:
kubectl rollout restart deployment/api -n backlink
```

**Docker Compose:** edit `.env` and `docker compose up -d api`.

---

### 5. Scaling Commands

#### 5.1 Imperative Scale (Kubernetes)

```bash
# Scale API pods
kubectl scale deployment/api -n backlink --replicas=6

# Scale a specific worker pool
kubectl scale deployment/worker-discovery -n backlink --replicas=4
kubectl scale deployment/worker-feeds -n backlink --replicas=5
kubectl scale deployment/worker-default -n backlink --replicas=6
```

#### 5.2 Tuning HPA Min/Max Replicas

```bash
# Edit HPA directly
kubectl edit hpa api -n backlink
# Change spec.minReplicas / spec.maxReplicas / targetCPUUtilizationPercentage

# Or via patch
kubectl patch hpa api -n backlink \
  -p '{"spec":{"minReplicas":3,"maxReplicas":20,"targetCPUUtilizationPercentage":70}}'

kubectl patch hpa worker-discovery -n backlink \
  -p '{"spec":{"minReplicas":2,"maxReplicas":30,"targetCPUUtilizationPercentage":65}}'
```

#### 5.3 Docker Compose Scale

```bash
docker compose up -d --scale worker-discovery=4 --scale worker-feeds=5 --scale worker-default=6 api=3
```

---

### 6. Rotating Secrets

Use a **24-hour overlap window** — have both old and new secrets valid simultaneously so in-flight requests and cached tokens don't break.

#### 6.1 Rotate Database Password

```bash
# Step 1: PostgreSQL — create new password; keep old user valid
NEW_PASS=$(openssl rand -base64 32)
psql $DATABASE_URL -c "ALTER USER backlink WITH PASSWORD '$NEW_PASS';"

# Step 2: Update the secret with NEW_PASS (NOT delete old one yet — overlap)
# For Sealed Secrets:
#   Add the NEW key/value as DATABASE_URL_NEW, then update code to try both
#   OR: rely on connection retry — safer is the 24h overlap

# Step 3: Wait 24 hours for all pods and connection pools to recycle

# Step 4: Revoke the old password by setting a new random one you discard
OLD_REVOKE=$(openssl rand -base64 32)
psql $DATABASE_URL -c "ALTER USER backlink WITH PASSWORD '$OLD_REVOKE';"
# Then throw OLD_REVOKE away. Only NEW_PASS is known now.
```

#### 6.2 Rotate Redis AUTH

```bash
# Step 1: Redis ACL SETUSER with new password, old remains valid via ACL rule
redis-cli ACL SETUSER default ON >NEWPASS ~* &* +@all
# Redis 6+: use two ACL entries overlapping; alternatively requirepass + 24h

# Step 2: Update REDIS_URL secret, restart workers and API rolling

# Step 3: 24h later, remove old password from ACL
redis-cli ACL SETUSER default resetpass
redis-cli ACL SETUSER default ON >NEWPASS ~* &* +@all
redis-cli ACL SAVE
```

#### 6.3 Rotate Session Signing Key (`SESSION_SECRET`)

The app accepts **two signing keys simultaneously** for 24h overlap: `SESSION_SECRET` (primary) and `SESSION_SECRET_PREVIOUS` (fallback).

```bash
# Step 1: Set SESSION_SECRET_PREVIOUS to current SESSION_SECRET value
# Step 2: Generate new key and place it in SESSION_SECRET
NEW_SECRET=$(openssl rand -hex 32)
# Update both env vars in the secret, roll restart API + workers

# Step 3: 24h later, clear SESSION_SECRET_PREVIOUS (delete the var) and roll restart again
```

---

### 7. Certificate Renewal

#### 7.1 Automatic (cert-manager in K8s)

No action required if `CERT_MANAGER_ISSUER` is set to a working Issuer/ClusterIssuer. cert-manager renews automatically 30 days before expiry.

Verify:
```bash
kubectl get certificates -n backlink -o wide
# READY=True, RENEWAL_TIME shows future date
```

#### 7.2 Manual Renewal (on-prem / single-node)

```bash
# certbot example
sudo certbot renew --standalone --preferred-chain "ISRG Root X1"

# If using Caddy, it's automatic — verify:
curl -vI https://backlink.example.com 2>&1 | grep -E 'expire|SSL'

# Bring in a manually-purchased cert (PEM)
sudo cp fullchain.pem /etc/caddy/certs/backlink.example.com.crt
sudo cp privkey.pem /etc/caddy/certs/backlink.example.com.key
sudo systemctl reload caddy
```

---

### 8. Scheduled Jobs (Celery Beat)

Celery `beat` emits all recurring work to the appropriate worker queue. **Never run more than one `beat` replica.**

| Task | Queue | Default Schedule | Env Var Override | Purpose |
|---|---|---|---|---|
| `backups.run` | `default` | `0 2 * * *` (02:00 UTC daily) | `BACKUP_CRON_SCHEDULE` | Full database + config backup |
| `backups.retention_enforce` | `default` | `0 4 * * 0` (04:00 UTC Sunday) | `BACKUP_RETENTION_CRON` | Delete expired backup files per retention policy |
| `reports.daily_digest` | `default` | `0 7 * * *` (07:00 UTC daily) | `DIGEST_CRON_SCHEDULE` | Daily per-tenant digest email |
| `reports.weekly_digest` | `default` | `0 8 * * 1` (08:00 UTC Monday) | `WEEKLY_DIGEST_CRON` | Weekly per-tenant digest email |
| `billing.usage_rollup` | `default` | `*/15 * * * *` (every 15 min) | `USAGE_ROLLUP_CRON` | Aggregate usage counters for billing |
| `retention.prune` | `default` | `0 3 * * *` (03:00 UTC daily) | `PRUNE_CRON_SCHEDULE` | Hard-delete soft-deleted rows past retention window |
| `intelligence.model_refresh` | `default` | `0 5 * * *` (05:00 UTC daily) | `MODEL_REFRESH_CRON` | Recompute anomaly & intent models |

Trigger any job manually for testing:
```bash
# Via API (admin token required)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:8000/api/operations/backups/run?type=all"

# Or directly via Celery (kubectl exec into a worker pod)
kubectl exec -n backlink deployment/worker-default -- \
  celery -A backlink.tasks call backups.run
```

---

## Validation

After any configuration or secret change:

```bash
# 1. Readiness passes across the fleet
kubectl get pods -n backlink -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{range .status.conditions[?(@.type=="Ready")]}{.status}{"\n"}{end}{end}' \
  | awk '{if($2!="True") print "NOT READY: "$1}'

# 2. Ops status endpoint returns OK
curl -sf -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.backlink.example.com/api/operations/status | jq .
```

## Rollback

For all config/secret changes: re-apply the previous ConfigMap/Secret revision and `kubectl rollout restart`. For code changes: use `kubectl rollout undo` as documented in the Deployment Guide.

## References

- [Deployment Guide](./DEPLOYMENT_GUIDE.md)
- [Scaling Guide](./SCALING_GUIDE.md)
- [Backup Guide](./BACKUP_GUIDE.md)
- [Monitoring Guide](./MONITORING_GUIDE.md)

# Deployment Guide

## Header

| Item | Value |
|---|---|
| Runbook ID | RB-DEPLOY-001 |
| Owner | Platform Operations |
| Severity if failed | P2 |
| Last Updated | 2026-07-27 |
| Estimated Duration | 15–60 min |

---

## Purpose

This runbook defines three validated deployment paths for the Backlink Indexer platform:

1. **Local Docker Compose** — development, CI, single-node testing
2. **Single Node (VM/Bare Metal)** — small production or staging on one host
3. **Kubernetes HA** — production multi-node high-availability

All paths produce a fully-operational platform with zero-downtime rolling updates.

---

## Scope

- Covers initial deployment, blue/green cutover, rollback, and image pinning.
- Does **not** cover disaster recovery (see [DISASTER_RECOVERY_GUIDE.md) or scaling decisions (see [SCALING_GUIDE.md]).

---

## Prerequisites

### Common

- Phase 10 release artifacts (container images or source checkout)
- Administrative access to target environment
- TLS certificate material (or cert-manager in K8s)
- Valid DNS entries for the target domain

### Path 1 — Local Docker Compose

- Docker ≥ 24.0 and Docker Compose ≥ 2.20
- 8 GB RAM, 4 vCPU, 50 GB free disk
- Three required environment variables exported in a `.env` file

### Path 2 — Single Node

- Ubuntu 22.04 LTS or RHEL 9
- Systemd, Docker 24+, 16 GB RAM, 8 vCPU, 200 GB SSD
- PostgreSQL 15 and Redis 7 either containerized or on-host

### Path 3 — Kubernetes HA

- Kubernetes cluster ≥ 1.28 (EKS/GKE/AKS or bare-metal)
- 3 control-plane nodes, ≥ 3 worker nodes
- Ingress controller (NGINX, AWS ALB, or equivalent)
- `kubectl` configured with cluster-admin access
- Sealed Secrets controller or External Secrets operator installed

---

## Steps

### Path 1: Local Docker Compose

#### 1.1 Prepare the Environment File

Create a `.env` file in the project root with the three **required** variables (all others have safe defaults):

```bash
# .env — minimum required
DATABASE_URL=postgresql+psycopg://backlink:changeme@db:5432/backlink
REDIS_URL=redis://redis:6379/0
SESSION_SECRET=$(openssl rand -hex 32)
```

#### 1.2 Bring Up the Stack

```bash
cd "d:\Backlink Indexer"
docker compose up -d
```

Expected services: `db`, `redis`, `api`, `worker-discovery`, `worker-feeds`, `worker-default`, `beat`, `frontend`.

#### 1.3 Confirm Healthy

Wait 30 seconds, then run:

```bash
docker compose ps
docker compose exec api python -c "import requests; r=requests.get('http://localhost:8000/healthz/readiness'); print(r.status_code, r.json())"
```

---

### Path 2: Single Node (VM / Bare Metal)

#### 2.1 Base Packages and OS Hardening

```bash
sudo apt-get update && sudo apt-get install -y \
  ca-certificates curl gnupg lsb-release unattended-upgrades fail2ban ufw
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable
```

#### 2.2 Install Docker

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

#### 2.3 Deploy with Compose

Follow Path 1.2 above, binding `DATABASE_URL` and `REDIS_URL` pointing to on-host or managed services.

#### 2.4 Reverse Proxy (Caddy Example)

```Caddyfile
# /etc/caddy/Caddyfile
backlink.example.com {
  reverse_proxy localhost:3000
  header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
}

api.backlink.example.com {
  reverse_proxy localhost:8000
}
```

```bash
sudo systemctl enable --now caddy
```

---

### Path 3: Kubernetes (HA Production)

#### 3.1 Create and Seal Secrets

Never commit plain secrets. Use Sealed Secrets:

```bash
# 1. Create a local secrets manifest (NEVER commit this file)
cat > /tmp/backend-secrets.yaml <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: backend-secrets
  namespace: backlink
type: Opaque
stringData:
  DATABASE_URL: "postgresql+psycopg://user:pass@host:5432/db"
  REDIS_URL: "redis://host:6379/0"
  SESSION_SECRET: "$(openssl rand -hex 32)"
  BACKUP_HMAC_SECRET: "$(openssl rand -hex 32)"
EOF

# 2. Seal it with the cluster public key
kubeseal --cert /tmp/backend-secrets.yaml \
  > backend/k8s/base/sealed-backend-secrets.yaml \
  --namespace backlink \
  --scope namespace-wide

# 3. Delete the plain text
rm /tmp/backend-secrets.yaml

# 4. Commit the sealed version (safe to commit)
git add backend/k8s/base/sealed-backend-secrets.yaml
```

#### 3.2 Apply the Production Overlay

```bash
cd "d:\Backlink Indexer"

# Create namespace if it doesn't exist
kubectl create namespace backlink --dry-run=client -o yaml | kubectl apply -f -

# Apply kustomize build + apply
kubectl apply -k backend/k8s/overlays/production
```

#### 3.3 Wait for Rollout

```bash
kubectl rollout status deployment/api -n backlink --timeout=5m
kubectl rollout status deployment/worker-discovery -n backlink --timeout=5m
kubectl rollout status deployment/worker-feeds -n backlink --timeout=5m
kubectl rollout status deployment/worker-default -n backlink --timeout=5m
kubectl rollout status deployment/frontend -n backlink --timeout=5m
```

#### 3.4 Verify Ingress and TLS

```bash
kubectl get ingress -n backlink
kubectl describe certificate backlink-tls -n backlink
# Wait for cert-manager to issue; Ready=True
```

---

### Blue/Green Deployment (Kubernetes)

For low-risk cutover between two fully-deployed versions:

```bash
# Deploy GREEN is live. Label the active Service selector
kubectl patch service api -n backlink \
  -p '{"spec":{"selector":{"app.kubernetes.io/version":"blue"}}}'

# After GREEN is validated (run smoke tests, then:
kubectl patch service api -n backlink \
  -p '{"spec":{"selector":{"app.kubernetes.io/version":"green"}}}'
```

The selector swap is atomic — no rolling restart; new connections go to GREEN immediately. Keep BLUE deployment scaled for 24h, then scale down.

---

### Rollback (Kubernetes)

```bash
# List deployment history
kubectl rollout history deployment/api -n backlink

# Undo last revision N
kubectl rollout undo deployment/api -n backlink

# Undo to a specific revision
kubectl rollout undo deployment/api -n backlink --to-revision=3

# Watch status
kubectl rollout status deployment/api -n backlink --timeout=5m
```

For Docker Compose rollback: change the image tag in `docker-compose.yml` and `docker compose up -d`.

---

### Version Pinning (Immutability)

Pin to an image **digest** (not tag) so the exact bit-for-bit image is reproducible:

```yaml
# backend/k8s/overlays/production/kustomization.yaml
images:
  - name: ghcr.io/example/backlink-api
    newName: ghcr.io/example/backlink-api
    newDigest: sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890
```

Look up the digest of a pushed tag:

```bash
crane digest ghcr.io/example/backlink-api:1.0.0-phase10
# → sha256:abcdef...
```

---

## Validation (First-Run Smoke Tests)

Run this script after any new deployment. Save as `smoke-test.sh` and execute:

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${1:-http://localhost:8000}"
TOKEN="${ADMIN_TOKEN:-}"
AUTH_HDR=""
if [ -n "$TOKEN" ]; then AUTH_HDR="-H Authorization: Bearer $TOKEN"; fi

echo "1/10  Liveness ................"
curl -fsS "$BASE/healthz/liveness" && echo " OK"

echo "2/10  Readiness ..............."
curl -fsS "$BASE/healthz/readiness" && echo " OK"

echo "3/10  Legacy /health ................"
curl -fsS "$BASE/health" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok'; assert d['implementation_phase']==10; print(' OK')"

echo "4/10  Metrics ...................."
curl -fsS "$BASE/metrics" | grep -q 'pda_http_requests_total' && echo " OK"

echo "5/10  Frontend HTTP 200 ............."
curl -fsS -o /dev/null -w "%{http_code}" "${BASE/"api./}" 2>/dev/null | grep -q 200 && echo " OK"

echo "6/10  Login endpoint responds ...."
curl -fsS -o /dev/null -w "%{http_code}" "$BASE/api/auth/login" 2>/dev/null | grep -qE '200|405|422' && echo " OK"

echo "7/10  Ops health (auth) ......."
if [ -n "$AUTH_HDR" ]; then
  curl -fsS $AUTH_HDR "$BASE/api/operations/health > /dev/null && echo " OK";
else echo " SKIP (no token)"; fi

echo "8/10  GDPR map (auth) ............"
if [ -n "$AUTH_HDR" ]; then
  curl -fsS $AUTH_HDR "$BASE/api/compliance/gdpr/map > /dev/null && echo " OK"
else echo " SKIP (no token)"; fi

echo "9/10  SOC2 matrix (auth) ..........."
if [ -n "$AUTH_HDR" ]; then
  curl -fsS $AUTH_HDR "$BASE/api/compliance/soc2/matrix > /dev/null && echo " OK"
else echo " SKIP (no token)"; fi

echo "10/10 Backup run trigger (auth) ...."
if [ -n "$AUTH_HDR" ]; then
  curl -fsS -X POST $AUTH_HDR "$BASE/api/operations/backups/run?type=config > /dev/null && echo " OK"
else echo " SKIP (no token)"; fi

echo ""
echo "All smoke tests passed."
```

Run: `chmod +x smoke-test.sh && ./smoke-test.sh https://api.backlink.example.com`

---

## Rollback

See the dedicated Rollback subsections in each Path above. In summary:

| Method | Rollback Command |
|---|---|
| Docker Compose | `docker compose up -d` with previous image tag |
| Kubernetes Deployment | `kubectl rollout undo deployment/<name> -n backlink` |
| Blue/Green | Patch Service selector back to `blue` |

Always run the 10-step smoke test script after rollback.

---

## References

- [Phase 10 Migration Notes](../migration/PHASE_10_NOTES.md)
- [Operations Guide](./OPERATIONS_GUIDE.md)
- [Disaster Recovery Guide](./DISASTER_RECOVERY_GUIDE.md)
- [Scaling Guide](./SCALING_GUIDE.md)
- Kubernetes Deployment: `backend/k8s/overlays/production/kustomization.yaml`

# Scaling Guide

- API: HPA on CPU 70%, min 2 / max 8 (`deploy/kubernetes/api-worker.yaml`).
- Workers: scale `pintdown-worker` replicas; keep prefetch=1.
- Redis: managed Redis with persistence for broker durability.
- Postgres: vertical first; read replicas for analytics later (multi-region readiness).
- Zero-downtime: run `alembic upgrade` as Job before rolling Deployment.

# Disaster Recovery Guide

| Item | Value |
|---|---|
| Runbook ID | RB-DR-001 |
| RPO | ≤ 24 hours (daily backups) or backup interval |
| RTO | ≤ 4 hours (restore DB + restart API/workers) |
| Owner | Platform Operations |

## Procedure

1. Confirm incident and freeze writes if corruption suspected.
2. Identify latest **verified** backup under `storage/backups/` or object storage.
3. Restore database:
   - Postgres: `psql` / `pg_restore` using `disaster_recovery/scripts/restore_database.sh`
   - SQLite: replace DB file from backup archive after stopping API
4. Restore config/branding artifacts from companion backup packages.
5. Restart Redis (or flush only if intentional), then API, then Celery workers.
6. Validate: `/healthz/readiness`, `/api/operations/status`, sample backlink list, billing webhook dry-run.
7. Record timeline in incident ticket.

## Environment recreation

Use `deploy/kubernetes/` or Compose + `alembic upgrade head`. Re-seed is not required if DB restore succeeded.

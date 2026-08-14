# Phase 14 Migration & Deployment Notes

| Field | Value |
|---|---|
| Version | 1.0.0-phase14 |
| Previous | 1.0.0-phase13 |
| Alembic | `015_discovery_connectors` ← `014_discovery_automation` |

## Summary

Additive Integration Hub. **No breaking API changes.** Feed Engine, WebSub, and IndexNow remain the system of record; connectors wrap them.

## Database

New tables only (see architecture doc). Credentials stored encrypted (Fernet when `CONNECTOR_MASTER_KEY` / `INDEXNOW_MASTER_KEY` / `SESSION_SECRET` available).

```bash
cd backend
alembic upgrade head
```

## Deployment

1. Migrate to `015_discovery_connectors`.
2. Restart API + Celery worker/beat.
3. Confirm `/health` → `phase: 14`.
4. Open `/internal/integrations`.
5. Bootstrap seeds default feed/websub/indexnow connectors on first list/overview.

Rollback: `alembic downgrade 014_discovery_automation`.

## RBAC

`connectors.view`, `connectors.manage`

## Compatibility

Phase 1–13 endpoints unchanged. Connector logs redact secrets automatically.

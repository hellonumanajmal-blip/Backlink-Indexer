# Phase 15 Migration & Deployment Notes

| Field | Value |
|---|---|
| Version | 1.0.0-phase15 |
| Previous | 1.0.0-phase14 |
| Alembic | `016_live_operations` ← `015_discovery_connectors` |

## Summary

Additive Live Operations Center. **No breaking changes** to Phase 10 operations endpoints or Phases 1–14 APIs.

## Database

New tables only: `live_events`, `worker_status`, `queue_snapshots`, `system_alerts`, `incidents`, `notifications`, `notification_providers`.

```bash
cd backend
alembic upgrade head
```

## Deployment

1. Migrate to `016_live_operations`.
2. Restart API + Celery worker/beat.
3. Confirm `/health` → `phase: 15`.
4. Open `/internal/ops-center` (Phase 10 console remains at `/internal/operations`).
5. SSE: `GET /api/operations/live/stream` (EventSource).

Rollback: `alembic downgrade 015_discovery_connectors`.

## RBAC

`live_ops.view`, `live_ops.manage`

## Compatibility

Existing `/api/operations/health|metrics|status|backups|version` unchanged.

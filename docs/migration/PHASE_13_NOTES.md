# Phase 13 Migration & Deployment Notes

| Field | Value |
|---|---|
| Version | 1.0.0-phase13 |
| Previous | 1.0.0-phase12 |
| Alembic | `014_discovery_automation` ← `013_search_intelligence` |

## Summary

Additive Discovery Automation Engine. **No breaking API changes.** Existing modules are called, not copied.

## Database

New tables only: `automation_workflows`, `automation_runs`, `automation_rules`, `automation_schedules`, `automation_history`, `automation_failures`, `automation_metrics`.

```bash
cd backend
alembic upgrade head
```

## Deployment

1. Migrate to `014_discovery_automation`.
2. Restart API + Celery worker/beat (new includes + beat entries).
3. Confirm `/health` → `phase: 13`.
4. Seed default workflow on first API overview/run if missing.
5. Open `/internal/automation`.

Rollback: `alembic downgrade 013_search_intelligence`.

## RBAC

`automation.view`, `automation.manage`

## Compatibility

All Phase 1–12 endpoints unchanged. Automation posts audit events for run/retry/pause/resume/cancel.

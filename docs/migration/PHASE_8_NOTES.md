# Phase 8 — Migration Notes

**Phase:** Multi-Tenant SaaS Platform & Organisation Workspaces  
**Date:** 2026-07-27  
**Depends on:** Phases 1–7

## Summary

Phase 8 introduces organisations, workspaces, and projects with repository-enforced isolation. Existing single-tenant deployments continue to work via an auto-bootstrapped **Default Organisation → Default Workspace → Default Project**. Phases 1–7 API paths and response shapes remain compatible (additive `project_id` on backlink DTOs only).

## Architecture

See `docs/architecture/PHASE_8_MULTI_TENANT.md`.

Hierarchy: Platform → Organisation → Workspace → Project → domain data.

## Database

Alembic revision: `008_multitenant` (revises `007_explainer`).

New tables: `organisations`, `organisation_members`, `workspaces`, `workspace_members`, `projects`, `project_members`, `project_settings`, `organisation_settings`, `user_tenant_preferences`, `feature_flags`, `usage_metrics`, `organisation_roles`.

Change: `tracked_backlinks.project_id` + unique `(project_id, url)` (replaces global URL unique).

Migration seeds fixed UUIDs for the default org/workspace/project and backfills existing backlinks.

## Isolation

- `BacklinkRepository` filters every query by active `project_id`.
- Cross-project `get_by_id` returns `None` (API → 404).
- Intelligence overview / AI context filter to project backlink IDs.
- AI cache keys include `project_id`.
- Celery validation resolves `project_id` from the backlink row.
- Portfolio recalculation is project-scoped.

## Permissions

`orgs.view|manage`, `workspaces.view|manage`, `projects.view|manage|switch`, `usage.view`, `features.manage`.

## API additions

| Method | Path |
|--------|------|
| GET/POST | `/api/organisations` |
| GET/PATCH | `/api/organisations/{id}` |
| POST | `/api/organisations/{id}/members` |
| GET/POST | `/api/workspaces` |
| GET/POST | `/api/projects` |
| POST | `/api/projects/switch` |
| GET | `/api/usage` |
| GET | `/api/features` |

Active project: `POST /api/projects/switch` preference and/or `X-Project-Id` header.

## UI

`/internal/organisations`, `/internal/workspaces`, `/internal/projects` (shared tenancy client).

## Deploy

```bash
cd backend
alembic upgrade head
# restart API + worker
curl -s http://localhost:8000/health   # phase: 8
```

## Rollback

```bash
alembic downgrade 007_explainer
```

Destructive for multi-tenant rows created after upgrade.

## Phase 9 readiness

`usage_metrics` → metered billing; `feature_flags` → plan entitlements; membership tables → SSO/SCIM; branding JSON → white-label; project-scoped tokens → public API/SDKs.

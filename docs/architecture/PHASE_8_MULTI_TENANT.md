# Phase 8 — Multi-Tenant SaaS Platform & Organisation Workspaces

**Status:** Complete  
**Depends on:** Phases 1–7  
**Rule:** No breaking HTTP contracts. Existing single-tenant deployments continue to work via automatic default-org / default-project bootstrap. Isolation is enforced in repositories and services — never frontend-only.

---

## Honest limitations

- Child tables that reference `backlink_id` without a formal FK inherit tenant scope **through the parent backlink’s `project_id`**. Direct queries that skip the parent must join or resolve project.
- Global platform resources (`ai_prompts` seeds, RBAC permission catalog) remain shared — they contain no customer data.
- Celery workers receive explicit `project_id` (or resolve it from `backlink_id`) — tasks that omit context run in the **default project** for backward compatibility only.
- Billing (Stripe, plans, usage invoicing) is **out of scope**; `usage_metrics` is the foundation only.

---

## Goals

1. Hierarchy: Platform → Organisation → Workspace → Project → existing domain data.
2. Complete data isolation between organisations.
3. Tenant-aware caching, queues, AI context, exports, and reports.
4. Extended RBAC with org / workspace / project membership + inheritance.
5. Feature flags and usage metrics for Phase 9 billing / marketplace.
6. UI for organisations, workspaces, projects, and context switching.
7. Zero breakage of Phases 1–7 APIs and existing tests.

## Non-goals

- Stripe subscriptions / invoices (Phase 9).
- Public multi-tenant API SDKs (Phase 9).
- Enterprise SSO / SCIM (Phase 9) — membership tables are SSO-ready.
- Physical database-per-tenant sharding.

---

## Tenant architecture

```
┌────────────── Platform (PDA instance) ──────────────┐
│  organisations                                      │
│    └─ workspaces                                    │
│         └─ projects  ◄── active tenant context      │
│              └─ backlinks → validation → pipeline   │
│                   → analytics → intelligence → AI   │
└─────────────────────────────────────────────────────┘
```

### TenantContext (request / job)

```python
@dataclass
class TenantContext:
    organisation_id: str
    workspace_id: str | None
    project_id: str
    user_id: str | None
    roles: set[str]          # effective at current scope
    permissions: set[str]    # platform + inherited
```

Resolution order for HTTP:

1. Explicit `X-Project-Id` header or `POST /api/projects/switch` session preference.
2. User’s last selected project (`user_tenant_preferences`).
3. User’s default membership project.
4. Bootstrap **Default Organisation / Default Project** (single-tenant compat).

Env admin (`settings.admin_username`) maps to platform-wide access and the default project when no memberships exist.

---

## Workspace model

| Field | Notes |
|-------|-------|
| id | UUID |
| organisation_id | FK |
| name, slug | Unique per org |
| description | Optional |
| status | active / archived |
| created_by, created_at | Audit |

Membership: `workspace_members (workspace_id, user_id, role)`.

---

## Project model

| Field | Notes |
|-------|-------|
| id | UUID |
| workspace_id | FK → workspace |
| organisation_id | Denormalised FK for fast isolation filters |
| name, slug | Unique per workspace |
| description, environment | e.g. production / staging |
| status | active / archived / suspended |
| logo_url | Optional |
| created_by, created_at | Audit |

`project_settings` / `organisation_settings`: key-value JSON rows.  
Membership: `project_members`.

---

## Data isolation strategy

1. **Column:** `tracked_backlinks.project_id` (nullable → backfilled → NOT NULL in same migration for new installs; existing rows backfilled).
2. **Uniqueness:** replace global `UNIQUE(url)` with `UNIQUE(project_id, url)` (soft-delete aware where practical).
3. **Repositories:** every list/get/mutate filters by `TenantContext.project_id` (or `organisation_id` for org-level APIs).
4. **Cross-entity:** intelligence / validation / pipeline rows scoped by joining `backlink_id → tracked_backlinks.project_id`, or by storing `project_id` on job tables where jobs are project-wide.
5. **AI context:** `ContextBuilder` requires `project_id`; evidence packs never mix projects.
6. **Exports / reports / digests:** persist `project_id` / `organisation_id` on job rows.
7. **Cache keys:** `tenant:{org_id}:{project_id}:{resource}:{hash}`.
8. **Celery:** task kwargs include `project_id`; queue routing optional `tenant.{org_slug}` later — Phase 8 tags headers / kwargs for isolation verification.
9. **ID enumeration:** `GET` by id returns 404 (not 403) when the resource exists in another tenant.

**Never** rely on UI filtering alone.

---

## Migration strategy

1. Create org/workspace/project/membership/settings/usage/feature_flag tables.
2. Seed **Default Organisation**, **Default Workspace**, **Default Project**.
3. Add nullable `project_id` to `tracked_backlinks` (+ selected job/report tables).
4. Backfill all existing rows → default project.
5. Alter uniqueness to `(project_id, url)`.
6. Attach bootstrap admin as org owner + workspace/project admin.
7. On `init_db` / first request: `ensure_default_tenant()` idempotent.

Downgrade removes FKs and tenant tables after clearing `project_id` columns (documented; destructive for multi-tenant data).

---

## API compatibility

| Existing | Behaviour |
|----------|-----------|
| All Phase 1–7 routes | Unchanged paths/shapes; auto-scoped to active project |
| Create backlink without project | Uses active / default project |
| Response DTOs | May **add** optional `project_id` fields (additive, non-breaking) |

### New endpoints

| Method | Path |
|--------|------|
| GET/POST | `/api/organisations` |
| GET/PATCH/DELETE | `/api/organisations/{id}` |
| GET/POST | `/api/workspaces` |
| GET/POST | `/api/projects` |
| POST | `/api/projects/switch` |
| GET | `/api/usage` |
| GET | `/api/features` |
| GET/POST | `/api/organisations/{id}/members` (foundation) |

---

## Cache isolation

- Analytics / AI response caches include `project_id` in the key.
- In-process caches (`_cache` dicts) must key by project.
- Redis (when used): prefix `pda:{org_id}:{project_id}:`.

---

## Queue isolation

- Celery tasks accept `project_id`.
- Portfolio / validate-all jobs iterate only within the requesting project (or explicit org admin scope).
- Task names unchanged for compat; kwargs extended.
- Observability: log `organisation_id` / `project_id` on task start.

---

## RBAC inheritance

```
Platform permissions (existing catalog)
        ↓
Organisation role (owner / admin / member / billing)
        ↓
Workspace role (admin / member / viewer)
        ↓
Project role (admin / editor / viewer)
```

Effective permission = union of platform role perms ∩ feature flags, plus membership role grants at the active scope.  
`system.admin` / env admin: full platform access.  
New permissions: `orgs.view`, `orgs.manage`, `workspaces.view`, `workspaces.manage`, `projects.view`, `projects.manage`, `projects.switch`, `usage.view`, `features.manage`.

Custom roles: `organisation_roles` / bindings foundation (name, permissions JSON) — seeded defaults; custom rows supported without code changes.

---

## Feature flags

`feature_flags`: `(organisation_id, key, enabled, config_json)`.  
Defaults when missing come from platform defaults. Keys: `ai_assistant`, `reports`, `api`, `integrations`, `marketplace`, `advanced_analytics`, `discovery_validator`, `pipeline`.

---

## Usage tracking

`usage_metrics`: daily counters per org/project for api_requests, pipeline_jobs, ai_requests, reports, exports, storage_bytes, projects, users, feeds, websub, indexnow, validation_jobs.  
Incremented from services / middleware hooks. Phase 9 billing reads these rows.

---

## Security review

| Threat | Mitigation |
|--------|------------|
| Tenant escape via ID | Repo scope + 404 on miss |
| Cross-project export | Report jobs store + filter `project_id` |
| Cross-project AI | ContextBuilder requires project |
| Cache bleed | Tenant-prefixed keys |
| Queue bleed | Task kwargs + scoped queries |
| Privilege escalation | Membership checks on org APIs |
| Suspended org | Status gate on resolve |

---

## Testing strategy

- Isolation: org A cannot read org B backlinks / scores / reports / AI context.
- RBAC inheritance and membership denial.
- Default tenant bootstrap: legacy login still works; existing tests green.
- Switch project changes subsequent list scope.
- Repository unit tests for forced cross-tenant access → empty / 404.
- Regression: full Phases 1–7 suite.

Target: additive coverage ≥ prior baseline; isolation suite mandatory.

---

## Modules

| Module | Role |
|--------|------|
| `tenancy/` | Models, TenantContext, bootstrap, isolation helpers |
| `organisations/` | Org CRUD, members, settings, branding |
| `workspaces/` | Workspace CRUD + members |
| `projects/` | Project CRUD, switch, settings |
| `feature_flags/` | Flag resolution |
| `usage/` | Metrics increment + API |

---

## Phase 9 readiness

- `usage_metrics` → Stripe metered billing  
- `feature_flags` → plan entitlements  
- Membership tables → SSO / SCIM mapping  
- `organisation_settings.branding` → white-label  
- Project-scoped API tokens → public API / SDKs  
- Integration endpoints already project-bindable → marketplace  

No redesign of the deterministic intelligence engine required.

# Phase 5 — Enterprise Security, Team Collaboration & Integration Platform

**Status:** Complete  
**Depends on:** Phases 1–4  
**Rule:** No breaking HTTP contracts. No AI features. Existing single-admin login must keep working during migration.

---

## Honest limitations

- CSRF for cookie sessions relies on SameSite=Lax + CORS allowlist; SPA double-submit token is optional hardening, not a full browser form CSRF suite.
- Email password-reset delivery is **foundation only** (token stored; send via Telegram/log until email SMTP is configured).
- JWT is optional for API clients; browser UI continues to use signed session cookies.
- Webhook delivery guarantees at-least-once with retries — not exactly-once.

---

## Goals

1. Multi-user accounts with hashed passwords, lockout, session revoke/expiry.
2. Data-driven RBAC (roles ↔ permissions).
3. Team invite / activate / role assign.
4. Append-only audit log.
5. Personal access tokens (hashed, scoped, revocable).
6. Outbound webhook engine (HMAC, retry, history).
7. Secure runtime settings store (editable without redeploy where practical).
8. Admin UI: Users, Roles, Permissions, Audit, API Tokens, Webhooks, Settings.
9. Keep `POST /api/auth/login|logout`, `GET /api/auth/me`, and all Phase 1–4 routes compatible.

## Non-goals

- AI scoring (Phase 6).
- Full SSO/SAML/OIDC.
- Multi-tenant org isolation beyond single-team users.
- Breaking or renaming existing analytics/pipeline/validator paths.

---

## Authentication architecture

```
Browser / API client
        │
        ├─ Cookie session (itsdangerous URLSafeTimedSerializer)  ← primary UI
        ├─ Bearer JWT (optional, HS256)                          ← POST /api/auth/token
        └─ Bearer API token (pda_…)                              ← hashed in DB
                │
                ▼
        resolve_principal(request) → Principal(user_id, username, roles, perms, auth_via)
                │
                ├─ require_authenticated
                ├─ require_permission("…")
                └─ require_admin (compat) → authenticated + (legacy env admin OR admin.* / * )
```

### Password hashing

- `bcrypt` via `passlib` (or `bcrypt` directly).
- Never store plaintext. Env `ADMIN_PASSWORD` used only for bootstrap verify + one-time seed hash.

### Bootstrap / migration of single-admin

1. On app start / first auth: ensure default roles + permissions seeded.
2. If no active users: create Super Admin from `ADMIN_USERNAME` / `ADMIN_PASSWORD` (hash password).
3. Login accepts:
   - DB user (active, not locked) with bcrypt verify, **or**
   - Legacy env credentials (still works) → issues same cookie shape `{"u": username, "uid": optional}`.
4. Existing tests keep using `admin` / `testpass` against env (and/or seeded user).

### Session

- Cookie: `pda_session` (configurable), HttpOnly, SameSite=Lax, Secure when `session_cookie_secure=true`.
- Payload: `{u, uid?, sid?}` signed; max_age from settings; optional shorter session without remember-me.
- Server-side `user_sessions` table enables **revocation** (sid must be active).
- Account lockout: `failed_login_count` / `locked_until` after N failures (default 5 / 15 min).

### JWT (optional)

- `POST /api/auth/token` with username/password → `{access_token, token_type, expires_in}`.
- Claims: `sub` (user id), `username`, `roles`, `exp`.
- Validated in `resolve_principal` when `Authorization: Bearer` looks like JWT (3 segments).

### Password reset foundation

- Table `password_reset_tokens` (user_id, token_hash, expires_at, used_at).
- `POST /api/auth/password/reset` creates token; delivery stub logs / Telegram if configured.

---

## Authorization model (RBAC)

### Tables

- `roles` (id, name, slug, description, is_system)
- `permissions` (id, code, description, category)
- `role_permissions` (role_id, permission_id)
- `user_roles` (user_id, role_id)

### Default roles

| Role | Slug | Intent |
|------|------|--------|
| Super Admin | `super_admin` | All permissions |
| Admin | `admin` | Operate system + users (no destroy Super Admin) |
| Editor | `editor` | Backlinks, validator, pipeline |
| Analyst | `analyst` | Analytics, reports (read/generate) |
| Viewer | `viewer` | Read-only dashboards |

### Permission codes (data-driven)

| Code | Category |
|------|----------|
| `backlinks.manage` | Backlinks |
| `backlinks.view` | Backlinks |
| `validator.run` | Validator |
| `validator.view` | Validator |
| `pipeline.manage` | Pipeline |
| `pipeline.view` | Pipeline |
| `analytics.view` | Analytics |
| `reports.generate` | Reports |
| `reports.view` | Reports |
| `users.manage` | Team |
| `roles.manage` | RBAC |
| `webhooks.manage` | Webhooks |
| `api_tokens.manage` | API Tokens |
| `settings.manage` | Settings |
| `audit.view` | Audit |
| `system.admin` | System |

`require_admin` (legacy) grants access if principal has `system.admin` **or** any of `*.manage` for the protected area **or** is the env bootstrap admin. Practically: Super Admin + Admin roles include `system.admin`, so all existing admin routes keep working for those roles. Editor/Analyst get finer gates on new endpoints; Phase 1–4 routes keep `require_admin` for zero contract change (they remain admin-gated as today).

---

## API Token architecture

- Prefix `pda_` + random 32+ bytes; store **SHA-256 hash only**.
- Fields: name, user_id, token_hash, token_prefix (first 8 for display), scopes (JSON), expires_at, last_used_at, revoked_at, created_at.
- Scopes: `read`, `write`, `reports`, `analytics`, `pipeline`, `validator`, `admin`.
- Scope → permission mapping (e.g. `analytics` → `analytics.view` + `reports.view`).
- Rotation: create new token + revoke old in one service call.

---

## Audit Log architecture

- Table `audit_logs` — **insert only** (no UPDATE/DELETE API).
- Columns: id, timestamp, user_id, username, action, resource, resource_id, ip, user_agent, success, detail_json.
- Service `AuditService.record(...)` called from auth, team, tokens, webhooks, settings, and EventBus hooks for backlink/validation/pipeline/report events.
- Repository exposes list/filter only.

---

## Webhook architecture

```
Domain event → EventBus → webhook.dispatch_task
    → load enabled endpoints for event
    → sign body HMAC-SHA256 (X-PDA-Signature)
    → POST with timeout
    → write delivery_history
    → on failure: retry Celery countdown = min(base*2^n, max)
```

Events subscribed: `BacklinkCreated`, `BacklinkUpdated`, `ValidationCompleted`, `PipelineFinished` (as PipelineCompleted), `ReportGenerated`, FeedGenerated / WebSubCompleted (emitted from pipeline stages or mapped from pipeline stage success).

---

## Security considerations

| Area | Approach |
|------|----------|
| CSRF | SameSite=Lax cookies; CORS credentials only for allowlisted origins |
| Cookies | HttpOnly; optional Secure; path=/ |
| Headers | Middleware: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` |
| Rate limit | In-process / Redis sliding window on `/api/auth/login` and `/api/auth/token` |
| Password policy | Min length 10; optional complexity flag |
| Secrets | Settings DB values encrypted-at-rest optional; prefer env for master keys |
| Trusted proxy | `FORWARDED_ALLOW_IPS` / settings for client IP from `X-Forwarded-For` |
| Input | Pydantic DTOs on all write endpoints |

---

## Database changes (migration `005_security`)

- `users`, `roles`, `permissions`, `role_permissions`, `user_roles`
- `user_sessions`, `password_reset_tokens`
- `audit_logs`
- `api_tokens`
- `webhooks`, `webhook_deliveries`
- `app_settings` (key, value_json, updated_at, updated_by)

---

## Event flow

1. Auth success/fail → audit  
2. User/role/token/webhook/settings mutations → audit  
3. Existing domain events → audit (best-effort) + webhook dispatch  
4. Webhook delivery result → audit + metrics  

---

## Migration strategy

1. Ship schema + seed roles/permissions.  
2. Bootstrap Super Admin from env if empty.  
3. Keep cookie login contract identical.  
4. Gradually attach `require_permission` to **new** admin routes only.  
5. Document cutover: create additional users, then rotate env password.

---

## Module layout

```
authentication/  api, services, repositories, dto, models, events, tasks
rbac/            api, services, repositories, dto, models, events
audit/           api, services, repositories, dto, models, events
api_tokens/      api, services, repositories, dto, models, events
webhooks/        api, services, repositories, dto, models, events, tasks
team/            api, services, repositories, dto, models, events
# settings live under authentication/settings or shared/settings — dedicated services in authentication or new settings package under team/system
```

Settings module: `backend/app/modules/settings/` (system settings API).

---

## Testing strategy

- Auth: login, lockout, logout, me, JWT, legacy env login  
- RBAC: permission checks allow/deny  
- Audit: append-only; login creates row  
- API tokens: create returns plaintext once; hash verify; revoke  
- Webhooks: HMAC verify helper; retry scheduling (eager)  
- Integration: existing Phase 1–4 suite still green with `auth_client`  

Target ≥ 90% coverage on new module paths exercised by tests.

---

## API additions (non-breaking)

All under `/api` unless noted. Existing auth paths remain.

| Method | Path |
|--------|------|
| POST | `/api/auth/login` (unchanged behaviour) |
| POST | `/api/auth/logout` |
| GET | `/api/auth/me` (extended fields optional, keep `username`) |
| POST | `/api/auth/token` |
| POST | `/api/auth/password/reset` |
| GET/POST | `/api/users` |
| PUT/DELETE | `/api/users/{id}` |
| GET | `/api/roles` |
| GET | `/api/permissions` |
| GET | `/api/audit` |
| GET/POST | `/api/api-tokens` |
| DELETE | `/api/api-tokens/{id}` |
| GET/POST | `/api/webhooks` |
| PUT/DELETE | `/api/webhooks/{id}` |
| GET/PUT | `/api/settings` |

---

## Observability

Counters: `auth.login_ok`, `auth.login_fail`, `auth.lockout`, `rbac.deny`, `webhook.delivery_ok|fail`, `api_token.use`, `audit.writes`.

---

## Acceptance checklist

- [ ] Architecture doc complete before merge of code (this file)
- [ ] Legacy login + Phase 1–4 tests green
- [ ] Passwords/tokens hashed
- [ ] Audit append-only
- [ ] Webhooks signed + retried
- [ ] Admin UI pages ship
- [ ] Migration notes published

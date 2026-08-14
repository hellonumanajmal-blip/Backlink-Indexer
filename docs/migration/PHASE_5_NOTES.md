# Phase 5 — Migration Notes

**Phase:** Enterprise Security, Team Collaboration & Integration Platform  
**Date:** 2026-07-27  
**Depends on:** Phases 1–4

## Summary

Phase 5 replaces single-env-admin-only identity with multi-user accounts, RBAC, audit logging, API tokens, webhooks, and editable runtime settings — while keeping `POST /api/auth/login|logout` and `GET /api/auth/me` behaviour compatible. Existing Phase 1–4 admin routes still use `require_admin` (env admin **or** `system.admin` permission).

## Database changes

Alembic revision: `005_security` (revises `004_analytics`).

| Table | Purpose |
|-------|---------|
| `users` | Accounts, lockout, last login |
| `roles` / `permissions` / `role_permissions` / `user_roles` | RBAC |
| `user_sessions` | Revocable sessions |
| `password_reset_tokens` | Reset foundation |
| `audit_logs` | Append-only audit |
| `api_tokens` | Hashed PATs |
| `webhooks` / `webhook_deliveries` | Outbound webhooks |
| `app_settings` | Runtime settings |

## Security model

- Passwords: bcrypt (passlib)
- Sessions: signed cookies (+ optional server-side session id for revoke)
- Optional JWT via `POST /api/auth/token`
- API tokens: `pda_…` plaintext shown once; SHA-256 stored
- Webhooks: HMAC-SHA256 `X-PDA-Signature`, Celery retry with exponential backoff
- Headers: nosniff, frame deny, referrer, permissions-policy
- Login/token rate limit (in-process)

## Bootstrap

On first auth: seed roles/permissions and create Super Admin from `ADMIN_USERNAME` / `ADMIN_PASSWORD` if no users exist. Env credential fallback remains for migration safety.

## RBAC matrix (default)

| Permission | Super Admin | Admin | Editor | Analyst | Viewer |
|------------|:-----------:|:-----:|:------:|:-------:|:------:|
| backlinks.* | ✓ | ✓ | ✓ | view | view |
| validator.* | ✓ | ✓ | ✓ | view | view |
| pipeline.* | ✓ | ✓ | ✓ | view | view |
| analytics.view | ✓ | ✓ | ✓ | ✓ | ✓ |
| reports.* | ✓ | ✓ | view | ✓ | view |
| users/roles/webhooks/tokens/settings | ✓ | ✓* | | | |
| audit.view | ✓ | ✓ | | ✓ | |
| system.admin | ✓ | ✓ | | | |

\* Admin includes `roles.manage` and `system.admin`.

## API additions

`/api/auth/token`, `/api/auth/password/reset`, `/api/users`, `/api/roles`, `/api/permissions`, `/api/audit`, `/api/api-tokens`, `/api/webhooks`, `/api/settings`

## Webhook events

`BacklinkCreated`, `BacklinkUpdated`, `ValidationCompleted`, `PipelineCompleted`, `ReportGenerated`, `FeedGenerated`, `WebSubCompleted`

## API token scopes

`read`, `write`, `reports`, `analytics`, `pipeline`, `validator`, `admin`

## Deploy steps

1. `pip install -r backend/requirements.txt`
2. `alembic upgrade head`
3. Restart API + worker
4. Log in with existing admin → bootstrap Super Admin created
5. Invite teammates under `/internal/admin`
6. Rotate `ADMIN_PASSWORD` / session secret in production; set `SESSION_COOKIE_SECURE=true` behind HTTPS

## UI

`/internal/admin` — Users, Roles, Audit, API Tokens, Webhooks, Settings.

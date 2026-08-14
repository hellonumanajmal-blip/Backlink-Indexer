# Phase 9 — Migration Notes

**Phase:** Commercial SaaS (Billing, Public API, SDKs & Enterprise Identity)  
**Date:** 2026-07-27  
**Depends on:** Phases 1–8

## Summary

Phase 9 adds commercial capabilities on the Phase 8 multi-tenant foundation: data-driven plans, Stripe/Mock billing, org metering & quotas, `/api/v1` public API, official SDK stubs, SSO/SCIM foundations, white-label branding, and organisation portfolio analytics. Internal `/api/*` contracts are unchanged.

## Database

Alembic: `009_commercial` (revises `008_multitenant`).

Tables: `billing_plans`, `billing_customers`, `organisation_subscriptions`, `billing_invoices`, `billing_webhook_events`, `sso_providers`, `sso_login_states`, `scim_tokens`, `scim_events`, `scim_role_maps`, `organisation_branding`.

Bootstrap seeds Free/Starter/Professional/Business/Enterprise plans and attaches Free to the default organisation.

## Billing & plans

- Provider: Stripe when `STRIPE_SECRET_KEY` set, else Mock.
- Checkout / portal / cancel / change-plan / webhook (signature verified).
- Limits & features live in `billing_plans.limits_json` / `features_json` — never hard-coded in app logic.

## Metering

`MeteringService` records into Phase 8 `usage_metrics` and enforces monthly quotas from the active plan (`-1` = unlimited).

## Public API

`/api/v1/{organisations,workspaces,projects,backlinks,analytics,intelligence,reports,validator,pipeline}`  
OpenAPI: `/api/v1/openapi.json` and `/api/public/openapi`.  
Headers: `X-Request-Id`, `ETag` (lists), rate limit, quota → 402.

## SDKs

Repo packages: `sdk/javascript`, `sdk/python`, `sdk/go`. Listed at `GET /api/public/sdk`.

## SSO / SCIM

SSO provider registry + OIDC mock/callback. SCIM `/api/scim/v2/Users` with bearer `scim_` tokens; events audited.

## Branding / Portfolio

`GET|PUT /api/branding`, `GET /api/portfolio` (org-scoped only).

## New permissions

`billing.view|manage`, `portfolio.view`, `branding.view|manage`, `sso.view|manage`, `scim.manage`, `public_api.use`.

## UI

`/internal/billing`, `/subscriptions`, `/api`, `/sso`, `/scim`, `/branding`, `/portfolio`.

## Deploy

```bash
cd backend
pip install -r requirements.txt   # optional stripe
alembic upgrade head
# export STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
# restart API + worker
curl -s http://localhost:8000/health  # phase: 9
```

## Rollback

```bash
alembic downgrade 008_multitenant
```

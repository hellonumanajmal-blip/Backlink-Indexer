# Phase 9 — Commercial SaaS Platform (Billing, Public API, SDKs & Enterprise Identity)

**Status:** Complete  
**Depends on:** Phases 1–8  
**Rule:** No breaking HTTP contracts. Tenant isolation unchanged. Billing and quotas are **data-driven**. Local login remains available alongside SSO.

---

## Honest limitations

- Stripe is optional: without `STRIPE_SECRET_KEY`, a **MockBillingProvider** drives checkout/portal/webhooks for tests and offline deploys.
- SAML 2.0 and full IdP adapters (Okta/Azure/Keycloak) ship as a **provider registry + OIDC authorization-code foundation**; production SAML assertion parsing is pluggable and mocked in tests.
- SCIM 2.0 covers Users (+ Groups foundation) with RBAC role mapping; advanced patch ops beyond replace/active are best-effort.
- White-label **custom domain** and **email branding** are foundation (settings + DNS checklist), not full CDN TLS automation.
- Official SDKs are generated stubs with typed clients, auth, retries, and examples — published as repo packages under `sdk/`, not npm/PyPI release automation.

---

## Goals

1. Subscription billing (plans, trial, upgrade/downgrade, cancel, grace, portal, webhooks).
2. Accurate org-level usage metering + configurable quotas.
3. Data-driven plan engine (limits + feature flags per plan).
4. Versioned Public API `/api/v1/*` with OpenAPI 3.1, pagination, rate limits, ETags, request IDs.
5. Official JS/TS, Python, Go SDK stubs.
6. Enterprise SSO (OIDC + SAML registry) + SCIM provisioning.
7. Org white-label branding.
8. Organisation portfolio analytics (no cross-org aggregation).
9. Admin consoles under `/internal/{billing,subscriptions,api,sso,scim,branding,portfolio}`.

## Non-goals

- Marketplace plugins / workflow automation (Phase 10).
- Multi-region HA / K8s operators (Phase 10).
- Changing Phase 6 scoring or Phase 8 isolation rules.

---

## Billing architecture

```
Org admin → Checkout / Portal
        │
        ▼
┌──────────────────┐
│ BillingService   │  plan lookup, subscription state machine
└────────┬─────────┘
         ▼
┌──────────────────┐
│ BillingProvider  │  Stripe | Mock
└────────┬─────────┘
         ▼
  Webhooks → verify signature → update subscriptions / invoices
```

### State machine

`trialing → active → past_due → grace → canceled` (also `incomplete`).

Grace period days are plan/org settings (default 7). During grace, read APIs work; write/metered features may soft-block via quota engine.

### Data

| Table | Purpose |
|-------|---------|
| `billing_plans` | code, name, interval, price_cents, trial_days, stripe_price_id, limits_json, features_json, active |
| `organisation_subscriptions` | org_id, plan_id, status, period_*, trial_*, cancel_at, stripe_ids |
| `billing_customers` | org_id ↔ stripe_customer_id |
| `billing_invoices` | metadata mirror for portal/UI |
| `billing_webhook_events` | idempotent event ids |

---

## Metering architecture

Extends Phase 8 `usage_metrics`.

- `MeteringService.record(org, project?, key, n)` → `UsageService.incr` + optional quota check.
- `QuotaService.check(org, key)` compares period usage vs plan `limits_json`.
- Middleware / dependency on public API increments `api_requests`.
- Keys: `api_requests`, `validation_jobs`, `pipeline_jobs`, `intelligence_jobs`, `ai_requests`, `reports`, `exports`, `projects`, `workspaces`, `users`, `storage_bytes`, `feeds`, `websub`, `indexnow`.

Quotas are never hard-coded in application logic — only read from the active plan row.

---

## Plan engine

Seeded plans: Free, Starter, Professional, Business, Enterprise.

Each plan row stores:

```json
{
  "limits": { "api_requests": 1000, "projects": 1, "ai_requests": 50, ... },
  "features": { "ai_assistant": true, "sso": false, "scim": false, ... }
}
```

`PlanEngine.entitlements(org_id)` merges subscription plan + org feature_flag overrides (org flags may only tighten Free; paid entitlements come from plan unless Enterprise override).

---

## Public API strategy

| Area | Path prefix |
|------|-------------|
| Internal (unchanged) | `/api/...` |
| Public v1 | `/api/v1/...` |

Public routes:

- Auth: `pda_` API tokens (project/org scoped preference via token metadata when present).
- Pagination: `page`, `page_size` (max 100).
- Filtering / sorting: query params passthrough where safe.
- Rate limit: per-token / per-org sliding window (config).
- `X-Request-Id` generated or echoed.
- `ETag` on list/get where cheap (hash of ids+updated).
- OpenAPI: `GET /api/public/openapi` (+ FastAPI `/api/v1/openapi.json` mount).

Resources: backlinks, validator, pipeline, analytics, intelligence, reports, projects, workspaces, organisations (read-scoped).

---

## SDK strategy

Generated under `sdk/`:

| Lang | Path |
|------|------|
| TypeScript | `sdk/javascript/` |
| Python | `sdk/python/` |
| Go | `sdk/go/` |

Each includes: client, auth header, retry with backoff, pagination iterator, error types, README examples.  
`GET /api/public/sdk` lists download metadata / repo paths.

---

## Identity / SSO architecture

```
Browser → /api/sso/login?provider=oidc
       → IdP authorize
       → /api/sso/callback
       → map assertion → local User + org membership
       → session cookie (existing)
```

`sso_providers` table: org_id, type (oidc|saml), client config JSON, enabled.  
Registry: OIDC (generic), Azure AD, Google, Okta, Auth0, Keycloak profiles (issuer presets).  
SAML: metadata URL + ACS foundation endpoint.

Local username/password login **unchanged**.

---

## SCIM lifecycle

Base: `/api/scim/v2` (org-bound via bearer SCIM token).

| Op | Behaviour |
|----|-----------|
| POST Users | provision user + membership |
| PATCH/PUT Users | update profile / active |
| DELETE Users | disable (soft) |
| Groups | map to org roles foundation |

Every event → `scim_events` + audit log. Role mapping via `scim_role_maps`.

---

## White-label architecture

`organisation_branding` (or evolve `branding_json`): logo_url, primary/secondary colour, favicon_url, custom_domain, email_from_name, report_footer.  
APIs return branding for dashboard/report theming. Custom domain = DNS TXT verification foundation.

---

## Portfolio analytics

`PortfolioService` aggregates **within one organisation** across projects: health/discovery trends (from intelligence scores), pipeline success, AI usage, team activity proxies, cost estimates from meter × plan rates.  
No cross-organisation queries.

---

## Security review

| Surface | Control |
|---------|---------|
| Billing webhook | Stripe signature / mock shared secret |
| Checkout | `billing.manage` + org membership |
| Public API | token hash, scopes, quota, rate limit |
| SSO | state CSRF nonce, validated issuer |
| SCIM | dedicated token, TLS assumed at edge |
| Branding | org-scoped writes |

---

## Deployment strategy

```bash
alembic upgrade head
# optional Stripe keys
export STRIPE_SECRET_KEY=... STRIPE_WEBHOOK_SECRET=...
# restart API + worker
```

Free plan auto-attached to default org on migrate/bootstrap.

---

## Testing strategy

- Mock billing provider: checkout, webhook idempotency, plan change.
- Metering + quota deny.
- Public API auth, pagination, request id.
- SDK package import smoke.
- SSO mock callback.
- SCIM provision/disable.
- Branding get/set isolation.
- Portfolio org-scoped only.
- Full regression Phases 1–8.

---

## Modules

| Module | Role |
|--------|------|
| `billing/` | Plans, subscriptions, Stripe/Mock, webhooks |
| `metering/` | Record + quotas |
| `public_api/` | `/api/v1` routers |
| `sdk/` | Manifest + generation helpers |
| `sso/` | Provider registry + OIDC flow |
| `scim/` | SCIM 2.0 users/groups |
| `branding/` | White-label |
| `portfolio/` | Org-wide analytics |

---

## Phase 10 readiness

Billing webhooks + metering → marketplace entitlements.  
Public API versioning → plugin HTTP contracts.  
SCIM/SSO → enterprise compliance evidence.  
Portfolio metrics → observability exporters (OTel) without redesign.

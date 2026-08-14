# Discovery Accelerator (v1.0.0 Release Candidate)

> **Canonical ports and local dev commands live in [`PORTS.md`](PORTS.md).**
> The "Quick start" section below describes a Docker/Postgres setup that does
> not match the backend that actually exists in this repo (`freeindexer-backend`,
> not `backend`; SQLite by default, not Postgres). Until this doc is
> rewritten, treat `PORTS.md` as authoritative for how to actually run the
> two services locally.

A standalone, professional SaaS-style platform for backlink discovery, validation, and lifecycle visibility. It is designed to help teams understand how discovery signals are created and monitored without making indexing promises or using deceptive tactics.

## What it does

1. Offers a public landing experience for project and campaign submission
2. Tracks submitted backlinks through a transparent discovery workflow
3. Publishes a human-useful public hub and feeds when needed
4. Supports validation, queueing, analytics, and reporting in a future-ready architecture
5. Keeps the platform aligned with legitimate discovery principles and measurable outcomes

## Product positioning

This product is not a black-box indexing service. It is a transparent discovery accelerator focused on:

- project and campaign organization
- backlink validation and queueing
- lifecycle visibility and reporting
- explainable recommendations and analytics
- enterprise-grade operations and monitoring

## What it explicitly does NOT do / guarantee

- **Google ultimately decides** whether a page is indexed — this tool cannot force it.
- **No tool, free or paid, can guarantee indexing** of a page on a domain you do not own.
- Google Search Console “Request Indexing” only works for verified properties you own.
- **IndexNow only works for domains you own** — third-party backlink URLs are never submitted.
- This platform only increases legitimate discovery signals (crawlable hub + feeds + WebSub). It does **not** scrape Google, simulate traffic, use PBNs/link farms, spam ping services, or any black-hat technique.
- Manual **Check Now** (`site:` search in a new tab) remains the only honest way to confirm whether a third-party page has been indexed.
- `authority_score` is a **manual optional field** — never auto-fetched from Moz/Ahrefs/SEMrush or any paid API.

These limitations are also shown in the dashboard UI.

## Stack (Phase 1 modular)

| Layer | Choice |
|--------|--------|
| Backend | FastAPI + SQLAlchemy + Alembic + PostgreSQL |
| Jobs | **Redis + Celery** (EventBus → workers; eager mode in pytest) |
| Architecture | `app/modules/*` Clean Architecture (Service / Repository / DTO / API / Tasks) |
| Frontend | Next.js + React + Tailwind + TypeScript |
| Auth | Single admin session cookie (RBAC in Phase 5) |
| Notify | Telegram only (more channels in Phase 5) |
| Reports | CSV + JSON (Excel/PDF in Phase 4) |

See [docs/architecture/PHASE_1_CLEAN_ARCHITECTURE.md](docs/architecture/PHASE_1_CLEAN_ARCHITECTURE.md),
[docs/architecture/PHASE_2_DISCOVERY_VALIDATOR.md](docs/architecture/PHASE_2_DISCOVERY_VALIDATOR.md),
[docs/architecture/PHASE_3_DISCOVERY_PIPELINE.md](docs/architecture/PHASE_3_DISCOVERY_PIPELINE.md),
[docs/architecture/PHASE_11_DISCOVERY_PIPELINE.md](docs/architecture/PHASE_11_DISCOVERY_PIPELINE.md),
[docs/architecture/PHASE_12_SEARCH_INTELLIGENCE.md](docs/architecture/PHASE_12_SEARCH_INTELLIGENCE.md),
[docs/architecture/PHASE_13_DISCOVERY_AUTOMATION.md](docs/architecture/PHASE_13_DISCOVERY_AUTOMATION.md),
[docs/architecture/PHASE_14_DISCOVERY_CONNECTORS.md](docs/architecture/PHASE_14_DISCOVERY_CONNECTORS.md),
[docs/architecture/PHASE_15_ENTERPRISE_OPERATIONS_CENTER.md](docs/architecture/PHASE_15_ENTERPRISE_OPERATIONS_CENTER.md),
and migration notes under `docs/migration/`.

## Quick start (Docker)

```bash
cp .env.example .env
# edit ADMIN_PASSWORD, SESSION_SECRET, optional Telegram + IndexNow
# Redis/Celery vars are set by docker-compose for backend + worker

docker compose up --build
```

Services: `db`, `redis`, `backend`, `worker` (Celery), `frontend`.

- Public hub: http://localhost:3000/featured  
- Admin login: http://localhost:3000/internal/login  
- API health: http://localhost:8000/health  
- Feeds: http://localhost:8000/feed.xml (also rewritten via Next)

## Local backend (without Docker frontend)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
# set DATABASE_URL (Postgres) or use docker compose up db
uvicorn main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

### Migrations

On a fresh Postgres:

```bash
cd backend
alembic upgrade head
```

`init_db()` also creates tables on API startup if missing (handy for local/dev).

## Environment variables

See `.env.example`. Important ones:

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` / `CELERY_BROKER_URL` | Celery broker (Redis) |
| `CELERY_RESULT_BACKEND` | Celery results |
| `CELERY_TASK_ALWAYS_EAGER` | `true` only for tests / no-worker local runs |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Single admin login |
| `SESSION_SECRET` | Cookie signing (≥32 chars) |
| `DATABASE_URL` | SQLAlchemy URL |
| `SITE_URL` | Canonical site (`https://pintdown.site`) |
| `INDEXNOW_KEY` | Optional; leave empty to skip IndexNow |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Optional notifications |
| `WEBSUB_HUB_URL` | Default Google public hub |

## Manual weekly-check workflow

1. Open `/internal/backlinks`
2. Filter status = `unknown` (or whatever needs review)
3. Click **Check Now** → Google `site:<exact URL>` opens in a new tab
4. Manually update status to `indexed` / `404` / `noindex` / etc. based on what you see
5. Optionally POST `/api/notifications/weekly-summary` (or wire a Coolify cron) for a Telegram reminder

Never automate or scrape the Google results page.

## API (auth-protected unless noted)

```
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
POST   /api/backlinks
GET    /api/backlinks
PUT    /api/backlinks/{id}
DELETE /api/backlinks/{id}
POST   /api/backlinks/bulk-import
GET    /api/backlinks/export/csv
GET    /api/backlinks/export/json
POST   /api/sync
GET    /api/analytics
GET    /api/search-intelligence/overview
GET    /api/search-intelligence/trends
GET    /api/search-intelligence/portfolio
GET    /api/search-intelligence/recommendations
POST   /api/search-intelligence/manual-verification
POST   /api/search-intelligence/recalculate
GET    /api/automation/overview
GET    /api/automation/workflows
GET    /api/automation/runs
POST   /api/automation/run
GET    /api/connectors
POST   /api/connectors/run
GET    /api/public/featured   (public)
GET    /feed.xml | /feed.atom | /feed.json
```

## Phase 12 — Search Intelligence

Legitimate visibility into discovery and indexing **progress signals** — not Google scraping and not indexing guarantees.

- Architecture: [docs/architecture/PHASE_12_SEARCH_INTELLIGENCE.md](docs/architecture/PHASE_12_SEARCH_INTELLIGENCE.md)
- Migration: [docs/migration/PHASE_12_NOTES.md](docs/migration/PHASE_12_NOTES.md)
- Dashboards: `/internal/search-intelligence`, `/internal/portfolio-insights`, `/internal/discovery-trends`, `/internal/campaign-comparison`, `/internal/manual-verification`, `/internal/recommendation-timeline`

Manual verification remains the only honest confirmation of third-party indexing.

## Phase 13 — Discovery Automation

Campaign orchestration engine that automatically runs:

detect → validate → crawl → signals → feeds → WebSub → IndexNow (owned only) → search intelligence → analytics.

- Architecture: [docs/architecture/PHASE_13_DISCOVERY_AUTOMATION.md](docs/architecture/PHASE_13_DISCOVERY_AUTOMATION.md)
- Migration: [docs/migration/PHASE_13_NOTES.md](docs/migration/PHASE_13_NOTES.md)
- Dashboard: `/internal/automation`

## Phase 14 — Discovery Connectors

Integration hub for RSS/Atom/JSON feeds, WebSub, IndexNow (owned only), webhooks, REST/HTTP, and custom connectors.

- Architecture: [docs/architecture/PHASE_14_DISCOVERY_CONNECTORS.md](docs/architecture/PHASE_14_DISCOVERY_CONNECTORS.md)
- Migration: [docs/migration/PHASE_14_NOTES.md](docs/migration/PHASE_14_NOTES.md)
- Dashboard: `/internal/integrations`

## Phase 15 — Enterprise Live Operations Center

Real-time operations center for queue/worker/pipeline visibility, alerts, incidents, and pluggable notifications (SSE + polling fallback). Monitoring only — no indexing guarantees.

- Architecture: [docs/architecture/PHASE_15_ENTERPRISE_OPERATIONS_CENTER.md](docs/architecture/PHASE_15_ENTERPRISE_OPERATIONS_CENTER.md)
- Migration: [docs/migration/PHASE_15_NOTES.md](docs/migration/PHASE_15_NOTES.md)
- Dashboard: `/internal/ops-center`

## Tests

```bash
cd backend
pip install -r requirements.txt
pytest -q
```

Coverage spans feeds, WebSub, IndexNow refusal, discovery signals, search intelligence, live operations, and regression across earlier phases.

## Coolify / production notes

- Deploy alongside the main PintDown stack on the same VPS.
- Proxy `/featured`, feeds, and `/{INDEXNOW_KEY}.txt` to this service (or merge `/featured` into the main Next app later and keep this API private).
- Do not link `/internal/*` from public nav; keep robots disallow in place.
- Prefer IP allowlist + strong admin password.

## Integrating `/featured` into main pintdown.site

This repo ships a self-contained Next app so the MVP can run alone. To serve `https://pintdown.site/featured` from the main PintDown frontend later:

1. Copy `frontend/src/app/featured` (and sitemap entry) into `PintDown-frontend`
2. Point `API_INTERNAL_URL` at this backend
3. Keep the internal dashboard on a private host or path

Until then, reverse-proxy `/featured` from Coolify/nginx to this frontend.

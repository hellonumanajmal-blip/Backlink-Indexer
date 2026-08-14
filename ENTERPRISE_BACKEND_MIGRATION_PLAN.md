# Enterprise Backend Migration Plan — PintDown Discovery Accelerator

## Executive Summary
This migration plan details the architectural blueprint and operational roadmap to transition the **PintDown Discovery Accelerator** from its current Next.js-consolidated state into a multi-service enterprise platform featuring a dedicated **FastAPI** backend, **PostgreSQL** relational storage, **Redis** caching/broker, and **Celery** background worker cluster.

---

## 1. Current Repository Architecture

The repository is currently structured as a Next.js-centric application:

* **Frontend Framework:** Next.js 15 (App Router) located in `/frontend`.
* **API Handling:** Simulated/mock API routing implemented in Next.js catch-all route `src/app/api/[...path]/route.ts`.
* **Public Feeds & Health:** Handled directly by Next.js routes (`/feed.xml`, `/feed.atom`, `/feed.json`, `/health`).
* **State & Persistence:** In-memory client/server state with transient mock data adapters.
* **Client SDKs:** Maintained under `/sdk/javascript`, `/sdk/python`, and `/sdk/go`.

---

## 2. Missing Backend Components

To restore full enterprise-scale capabilities, the following backend components must be provisioned:

1. **FastAPI Application Core:** Asynchronous Python API service for core backlink discovery, verification, and campaign orchestration.
2. **PostgreSQL Relational Storage:** Primary persistence database storing multi-tenant organizations, workspaces, backlinks, discovery runs, and system audit logs.
3. **Alembic Database Migration Engine:** Version-controlled database schema migrations.
4. **SQLAlchemy 2.0 ORM:** Async ORM models defining data structures and relationships.
5. **Redis Message Broker & Cache:** Persistent key-value store powering Celery queues, rate limiting, and short-term response caching.
6. **Celery Worker Engine:** Distributed asynchronous worker pool handling heavy verification pipelines, WebSub pings, and IndexNow submissions.
7. **Celery Beat Scheduler:** Periodic task manager executing scheduled workflows and maintenance routines.

---

## 3. Components That Should Remain in Next.js

The Next.js framework will serve as the primary presentation and client-interaction layer:

* **User Interfaces & Dashboards:** Admin panel, Operations Center (`/internal/ops-center`), analytics, search intelligence, and integration pages.
* **Backend-for-Frontend (BFF) Proxy:** Secure HTTP-only session management and proxying client API requests to the upstream FastAPI service.
* **Public SEO & Feeds:** Dynamic RSS/Atom/JSON feed generators (`/feed.xml`, `/feed.atom`, `/feed.json`), `sitemap.ts`, and `robots.ts`.
* **Static Assets & Client Utilities:** UI component rendering, Tailwind CSS v4 styling, and visual widget logic.

---

## 4. Components That Must Move into a Backend

The following domain responsibilities must be isolated inside the FastAPI backend:

* **Core Discovery & Verification Logic:** URL health checks, HTTP header parsing, canonical detection, and backlink validation.
* **Search Intelligence Processing:** High-volume calculations for portfolio trends, campaign benchmarks, and recommendation timelines.
* **Auth & RBAC Authority:** JWT token issuance/verification, password hashing (Argon2), and fine-grained role-based permission checks.
* **Asynchronous Integration Connectors:** IndexNow submissions, Webhooks dispatching, Telegram notifications, and WebSub hub pings.
* **Database Transactions:** ACID-compliant data mutations across multi-tenant scopes.

---

## 5. API Contract Between Frontend and Backend

Communication between the Next.js BFF/Frontend and FastAPI Backend will follow a standardized REST contract over HTTPS:

* **Base URL:** `/api/v1/*` (proxied by Next.js to `http://backend:8000/api/v1/*`).
* **Authentication Header:** `Authorization: Bearer <JWT_ACCESS_TOKEN>`.
* **Response Envelope Format:**
  ```json
  {
    "success": true,
    "data": {},
    "error": null,
    "meta": {
      "timestamp": "2026-07-30T00:00:00Z",
      "version": "1.0.0"
    }
  }
  ```
* **Error Response Format:**
  ```json
  {
    "success": false,
    "data": null,
    "error": {
      "code": "UNAUTHORIZED",
      "message": "Invalid or expired session token",
      "details": {}
    },
    "meta": {
      "timestamp": "2026-07-30T00:00:00Z"
    }
  }
  ```

---

## 6. Authentication Flow

```
[Browser / User]
       │  1. POST /api/v1/auth/login (credentials)
       ▼
[Next.js Proxy / BFF]
       │  2. Proxies request to FastAPI
       ▼
[FastAPI Auth Service]
       │  3. Validates credentials vs PostgreSQL (Argon2)
       │  4. Issues Signed JWT Access & Refresh Tokens
       ▼
[Next.js Proxy / BFF]
       │  5. Encapsulates JWT in Secure, HTTP-Only, SameSite=Lax Cookie
       ▼
[Browser / User]
```

* **Session Validation:** On subsequent requests, Next.js extracts the JWT from the HTTP-only cookie and passes it to FastAPI in the `Authorization` header.
* **Token Invalidation:** Logout requests clear the browser cookie and revoke the token via Redis blacklisting.

---

## 7. Queue Architecture

Redis (v7.x) acts as the central message broker for Celery worker processes, organized into isolated queues:

| Queue Name | Priority | Purpose | Task Examples |
|------------|----------|---------|---------------|
| `high_priority` | High | Immediate user-driven tasks | Manual backlink re-check, manual verification |
| `discovery` | Medium | Bulk backlink validation | URL crawl, HTTP status verification, signal parsing |
| `integrations` | Normal | External API dispatching | IndexNow submissions, Webhook calls, Telegram alerts |
| `automation` | Low | Scheduled & cron workflows | Daily analytics aggregation, campaign trend snapshots |

---

## 8. Database Architecture

PostgreSQL (v16+) managed via SQLAlchemy 2.0 ORM and Alembic migrations.

### Primary Domain Schema Models
1. **Multi-Tenancy & Access Control:**
   * `tenants` (id, name, plan, created_at)
   * `organizations` (id, tenant_id, name)
   * `users` (id, tenant_id, email, password_hash, role)

2. **Core Backlink Engine:**
   * `backlinks` (id, tenant_id, url, target_url, status, quality_score, created_at)
   * `discovery_runs` (id, backlink_id, http_code, response_time_ms, verified_at)
   * `discovery_signals` (id, backlink_id, signal_type, payload)

3. **Automation & Operations:**
   * `automation_workflows` (id, tenant_id, title, trigger_type, status)
   * `automation_runs` (id, workflow_id, status, error_message, executed_at)
   * `connector_configs` (id, tenant_id, connector_type, is_active)

---

## 9. Worker Architecture

The background worker tier consists of decoupled stateless Python container instances:

* **Celery Worker Nodes:** Run `celery -A app.worker worker --loglevel=info -Q discovery,integrations,automation`.
* **Worker Auto-Scaling:** Triggered based on Redis queue length (`LLEN celery`).
* **Beat Container:** Single-instance scheduler running `celery -A app.worker beat` for periodic workflow schedules.
* **Concurrency:** Eventlet/Gevent or prefork worker pools configured according to CPU/IO characteristics.

---

## 10. Deployment Architecture

```
                      ┌─────────────────────────┐
                      │   Nginx Reverse Proxy   │
                      │       (Port 3000)       │
                      └────────────┬────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
    ┌────────────────────┐                  ┌────────────────────┐
    │  Next.js Frontend  │                  │  FastAPI Backend   │
    │    (App Router)    │                  │    (Port 8000)     │
    └────────────────────┘                  └──────────┬─────────┘
                                                       │
                           ┌───────────────────────────┼───────────────────────────┐
                           ▼                           ▼                           ▼
                 ┌──────────────────┐        ┌──────────────────┐        ┌──────────────────┐
                 │  PostgreSQL DB   │        │   Redis Broker   │        │  Celery Workers  │
                 │   (Port 5432)    │        │   (Port 6379)    │        │  & Beat Engine   │
                 └──────────────────┘        └──────────────────┘        └──────────────────┘
```

---

## 11. Folder Structure

Target enterprise directory topology:

```
/
├── backend/                        # Python FastAPI Backend
│   ├── app/
│   │   ├── api/                    # REST Route Controllers (v1)
│   │   │   ├── endpoints/
│   │   │   └── router.py
│   │   ├── core/                   # Security, Config, Database connection
│   │   ├── models/                 # SQLAlchemy ORM Models
│   │   ├── repositories/           # Data Access Layer
│   │   ├── services/               # Core Business Logic Services
│   │   ├── tasks/                  # Celery Task Definitions
│   │   └── main.py                 # FastAPI Application Entry
│   ├── alembic/                    # Migration Scripts
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/                       # Next.js Application
│   ├── src/
│   │   ├── app/                    # Next.js App Router Pages & API Proxies
│   │   ├── components/             # UI Components
│   │   └── lib/                    # Client API & Integration Utils
│   └── Dockerfile
├── docker-compose.yml              # Local Multi-Container Orchestration
├── docker-compose.prod.yml         # Production Stack Deployment Configuration
└── README.md
```

---

## 12. Migration Roadmap

### Phase 1: Infrastructure & Database Bootstrap
* Provision PostgreSQL database and Redis cluster.
* Initialize `backend/` directory with FastAPI, SQLAlchemy 2.0, and Alembic.
* Implement base database schema migrations for multi-tenancy and backlinks.

### Phase 2: FastAPI Core API & Auth Implementation
* Implement authentication endpoints (`/auth/login`, `/auth/refresh`, `/auth/me`) with Argon2 hashing and JWT token generation.
* Re-implement backlink CRUD operations, discovery signal services, and search intelligence APIs in FastAPI.

### Phase 3: Celery Task Queue Integration
* Configure Celery task worker app with Redis broker.
* Port backlink verification, WebSub hub pinging, IndexNow submissions, and Webhook dispatchers to Celery tasks.
* Deploy Celery Beat scheduler for automated workflows.

### Phase 4: Next.js Frontend Integration & Proxy Layer
* Update Next.js `src/app/api/[...path]/route.ts` to proxy requests to `http://backend:8000/api/v1/*`.
* Store JWT tokens in secure HTTP-only session cookies.
* Validate all UI screens against the live FastAPI backend API.

### Phase 5: Verification, Benchmarking & Deployment
* Execute end-to-end integration test suites across frontend, backend, database, and background queues.
* Verify security headers, rate limiting, and CORS parameters.
* Deploy via Docker Compose / Cloud Run multi-service configuration.

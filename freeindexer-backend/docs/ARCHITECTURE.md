# Technical Architecture Specification — FreeIndexer Backend

## Overview
This document specifies the software architecture, dependency rules, and infrastructure boundaries of the `freeindexer-backend` core engine.

---

## Clean Architecture Layers

1. **Entities & Models (`app/models/`):** Core SQLAlchemy domain models inheriting from `BaseModel` (UUID + UTC timestamps).
2. **Repositories (`app/repositories/`):** Data access abstractions implementing generic CRUD operations on AsyncSession.
3. **Services (`app/services/`):** Business logic layer encapsulating domain rules and multi-repository workflows.
4. **API Controllers (`app/api/`):** FastAPI route controllers validating request payloads and returning standardized `ApiResponse[T]` envelopes.
5. **Workers (`app/workers/`):** Asynchronous Celery tasks executing background workloads outside the HTTP request path.

---

## Infrastructure Boundaries

* **PostgreSQL:** ACID relational database for tenants, users, backlinks, and discovery logs.
* **Redis:** In-memory store for session invalidation, rate limiting, and Celery broker queues.
* **Prometheus:** Metrics scraping endpoint exposed at `/metrics`.
* **OpenTelemetry / Structlog:** Distributed tracing and structured JSON logging with correlation IDs (Phase 34).
* **Observability module:** `/api/observability/*` for health, SLA, incidents, alerts, governance, compliance, and security monitoring. See `docs/observability/`.

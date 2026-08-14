# FreeIndexer Backend Engine (`freeindexer-backend`)

Production-grade Clean Architecture Foundation for the FreeIndexer enterprise backlink indexing platform.

## Architecture

* **Framework:** Python 3.10+ / FastAPI / Uvicorn
* **Database & Persistence:** Async SQLAlchemy 2.0 / PostgreSQL / Alembic
* **Cache & Message Broker:** Async Redis 7 / Celery
* **Security & Auth:** JWT Tokens / Argon2id Password Hashing / Role-Based Access Control (RBAC)
* **Observability:** Structlog JSON Logging / Prometheus Metrics / OpenTelemetry Tracing / Request-ID Correlation

## Directory Structure

```
freeindexer-backend/
├── app/
│   ├── api/                  # API Routers & Endpoints
│   ├── auth/                 # JWT & Argon2 Auth
│   ├── core/                 # Config & Redis & Container
│   ├── database/             # Async Sessions, UoW, Transactions
│   ├── middleware/           # Error Handler & Request-ID
│   ├── models/               # SQLAlchemy Declarative Base
│   ├── modules/              # Domain Modules
│   ├── observability/        # Logging, Metrics, Tracing
│   ├── rbac/                 # Permissions, Roles, Registry
│   ├── repositories/         # Generic Repositories
│   ├── services/             # Base Business Services
│   ├── shared/               # Standard DTOs
│   ├── workers/              # Celery App Configuration
│   └── main.py               # FastAPI App Factory
├── alembic/                  # Async Database Migrations
├── deployment/               # Dockerfile & K8s Manifests
├── docs/                     # Technical Architecture Specs
├── scripts/                  # Operation Scripts
├── tests/                    # Pytest Suite
├── .env.example
├── alembic.ini
├── docker-compose.yml
├── pyproject.toml
└── pytest.ini
```

## Quickstart

```bash
# 1. Install dependencies in virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"

# 2. Run Test Suite
pytest

# 3. Start Local Environment via Docker Compose
docker compose up -d
```

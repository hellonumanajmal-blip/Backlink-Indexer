# Discovery Accelerator — Phase 1 Architecture

## 1. Business Goals
- Build a standalone SaaS for professional backlink discovery workflows.
- Help users organize projects, campaigns, and discovery submissions in a transparent, enterprise-ready way.
- Keep all behavior compliant with search-engine-safe practices and avoid any indexing guarantees.
- Provide a clean foundation for later phases such as validation, queue processing, analytics, and billing.

## 2. System Overview
The platform consists of:
- A Next.js frontend for public marketing pages and authenticated workspace screens.
- A FastAPI backend organized into domain modules with clear service and repository boundaries.
- A PostgreSQL-backed persistence layer with SQLAlchemy and Alembic.
- Redis/Celery infrastructure prepared for later asynchronous workflows.
- Docker Compose and GitHub Actions support for local development and deployment.

## 3. User Journey
1. Visitor lands on the public homepage.
2. Visitor creates a free account or starts with a workspace.
3. User creates a project.
4. User creates a campaign under the project.
5. User submits backlink URLs for the campaign.
6. The system stores the submission and prepares the queue for later processing.

## 4. Module Diagram
- Authentication
- Projects
- Campaigns
- Discovery
- Validation
- Queue
- Analytics
- Reports
- Billing
- Users
- Settings
- Notifications
- API
- AI
- Integrations

## 5. Database Strategy
Initial schema focuses on core entities:
- users
- projects
- campaigns
- backlinks
- queue_items
- validation_results
- discovery_results
- reports
- notifications
- settings

All tables include:
- id
- created_at
- updated_at
- deleted_at (soft delete where appropriate)
- indexes and foreign keys

## 6. API Strategy
The backend uses FastAPI with explicit DTOs and validation rules.
Core endpoints in Phase 1:
- POST /api/projects
- POST /api/campaigns
- POST /api/discovery/submit
- GET /api/dashboard/summary
- GET /api/projects
- GET /api/campaigns
- GET /api/campaign/{id}

All responses follow consistent error-handling and OpenAPI-friendly schemas.

## 7. Queue Strategy
Queueing is prepared but not executed in Phase 1.
The discovery submission endpoint creates queue records only.
Later phases will move the queue into background workers.

## 8. Security Model
- Secure password handling and session-based authentication.
- Environment-based secrets.
- No indexing guarantees or deceptive behavior.
- Input validation and structured error responses.
- Future-ready support for OAuth providers and JWT.

## 9. Scalability
- Module-oriented backend boundaries.
- Stateless API services.
- Database access through SQLAlchemy sessions.
- Redis/Celery foundation for future async workloads.
- Containerized deployment with Docker Compose and Kubernetes-ready structure.

## 10. Folder Structure
- frontend/ for Next.js UI
- backend/app/modules/ for domain modules
- docs/ for architecture and product documentation
- deploy/ for deployment assets
- scripts/ for operational helpers
- sdk/ for future client SDKs

## 11. Coding Standards
- Strict TypeScript in the frontend
- Python type hints throughout the backend
- Repository and service layers
- DTOs for API contracts
- No duplicate logic and no placeholder code

## 12. Testing Strategy
- Backend tests for project, campaign, and submission flows
- API tests for status codes and payloads
- Frontend type checks and UI build validation

## 13. Deployment Strategy
- Docker Compose for local development
- Dockerfiles for backend and frontend
- GitHub Actions ready for CI
- Prometheus, Grafana, and OpenTelemetry configured for later observability expansion

## 14. Future Roadmap
Phase 2: validation engine and queue processing
Phase 3: analytics and reporting
Phase 4: enterprise billing and integrations

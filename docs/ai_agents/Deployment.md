# Deployment

The AI Agent Platform uses the same operational footprint as the rest of the backend:

- FastAPI router registration
- Async SQLAlchemy session handling
- Shared RBAC and tenant isolation
- Celery for long-running tasks
- Prometheus metrics export

Production deployment should provide provider credentials through the existing credential vault and environment configuration pattern rather than direct hardcoding.
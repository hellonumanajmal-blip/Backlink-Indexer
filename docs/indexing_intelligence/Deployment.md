# Deployment & Operational Guide

## Database Migrations
Apply Alembic migration `0006_indexing_intelligence`:
```bash
alembic upgrade head
```

## Celery Worker Execution
Run Celery workers with scheduled beat tasks:
```bash
celery -A app.core.celery worker --loglevel=info
celery -A app.core.celery beat --loglevel=info
```

## Prometheus Monitoring
Scrape telemetry from `/metrics`:
- `indexing_priority_calculations_total`
- `indexing_average_index_time_hours`
- `indexing_average_success_rate_percent`
- `indexing_health_score_gauge`
- `indexing_automation_executions_total`

# Phase 24 Deployment & Configuration Guide

## Database Migration
Execute Alembic migration `0010_seo_intelligence`:
```bash
alembic upgrade head
```

## Celery Background Workers
Ensure the following background tasks are registered in Celery beat schedules:
- `refresh_benchmark_job` (Daily)
- `aggregate_trends_job` (Weekly/Monthly)
- `run_gap_analysis_job` (Daily)
- `generate_recommendations_job` (Daily)
- `process_scheduled_reports_job` (Scheduled)
- `process_alerts_job` (Hourly)

## Verification
Run tests:
```bash
pytest tests/test_seo_intelligence.py
```

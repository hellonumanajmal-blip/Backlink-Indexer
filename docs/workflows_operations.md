# Workflow Platform Operations & Administration Guide

## Background Tasks

The workflow platform utilizes Celery background workers for background processing and cron scheduling:

- `app.modules.workflows.tasks.run_scheduled_workflows_task`: Runs periodically (e.g., every 60 seconds) to evaluate scheduled/cron workflows.
- `app.modules.workflows.tasks.retry_failed_workflow_executions_task`: Retries failed actions according to backoff configurations.

## Monitoring & Metrics

Scrape Prometheus endpoint for workflow operational health:

- `workflow_executions_total`: Execution counter by trigger type and tenant.
- `workflow_success_total`: Total successful runs.
- `workflow_failure_total`: Total failures grouped by error type.
- `workflow_duration_seconds`: Histogram of run times.
- `active_workflows_total`: Active rule count per tenant.

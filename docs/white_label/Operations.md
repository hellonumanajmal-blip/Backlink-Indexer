# Phase 26 Operations & Telemetry Manual

## Prometheus Metrics

- `white_label_brands_total`: Active agency/enterprise brand configurations.
- `client_workspaces_total`: Active client workspaces under brands.
- `reports_generated_total`: Executive reports generated across all formats.
- `scheduled_reports_total`: Configured automated report schedules.
- `report_delivery_success_total`: Successful email/portal report deliveries.
- `portal_logins_total`: Client portal session access events.

## Background Jobs

- `run_scheduled_report_generation`: Evaluates cron schedules and triggers report jobs.
- `render_report_task`: Renders PDF/CSV/Excel/ZIP exports.
- `generate_ai_executive_summary_task`: AI natural language summary generation.
- `deliver_client_notifications_task`: Email delivery worker.
- `run_white_label_cleanup`: Purges stale sessions and export caches.

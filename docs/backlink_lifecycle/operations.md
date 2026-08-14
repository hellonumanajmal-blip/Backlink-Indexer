# Enterprise Backlink Intelligence, Monitoring & Lifecycle Management Platform — Operations Guide

## Operational Monitoring & Metrics

The platform emits the following Prometheus metrics for monitoring backlink health and status:
- `backlinks_total`: Total managed backlinks count.
- `live_backlinks_total`: Active live backlinks count.
- `lost_backlinks_total`: Lost or removed backlinks count.
- `broken_backlinks_total`: Target 404 or broken links count.
- `average_health_score`: Composite health score across profile (0–100).
- `anchor_change_events_total`: Total detected anchor or rel attribute change events.
- `velocity_rate`: Net acquisition velocity rate.
- `alerts_generated_total`: Total generated anomaly alerts.

## Background Celery Tasks
- `run_lifecycle_monitoring_task`: Scheduled periodic verification sweeps.
- `recalculate_backlink_health_task`: Asynchronous health score calculation.
- `analyze_anchor_text_task`: Over-optimization and anchor distribution analysis.
- `aggregate_link_velocity_task`: Daily velocity snapshot aggregation.
- `generate_backlink_alerts_task`: Anomaly and spike alert detection.
- `cleanup_historical_backlink_records_task`: Retention cleanup for historical logs.

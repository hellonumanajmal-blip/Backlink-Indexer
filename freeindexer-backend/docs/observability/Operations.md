# Operations

## Incidents

Severity levels: `critical`, `high`, `medium`, `low`.

Lifecycle: `open` → `acknowledged` → `investigating` (escalation) → `resolved`
with optional RCA text and append-only history.

## Alerts

Alerts are routed by severity:

| Severity | Routes |
|----------|--------|
| critical | oncall, pager, slack-critical |
| high | oncall, slack-ops |
| warning/info | slack-ops |

## Celery jobs

| Task | Purpose |
|------|---------|
| `observability.health_monitoring` | Dependency probes |
| `observability.sla_evaluation` | SLA compliance |
| `observability.alert_processing` | Process firing alerts |
| `observability.compliance_scan` | Generate compliance report |
| `observability.log_cleanup` | Trim log/metric buffers |
| `observability.metrics_aggregation` | Aggregate metric snapshots |

Run worker: `celery -A app.workers.celery_app.celery_app worker --loglevel=info`

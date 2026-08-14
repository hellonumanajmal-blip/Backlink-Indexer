# Observability

## Distributed tracing

Spans are started via `POST /api/observability/traces` and finished via
`POST /api/observability/traces/finish`. Correlation IDs are injected by
`RequestIdMiddleware` and attached to structured logs.

OpenTelemetry is bootstrapped in `app/observability/tracing.py` with a console
exporter exporter suitable for local/dev; production can swap in an OTLP exporter.

## Structured logging

`LoggingService` emits JSON logs through structlog and keeps a tenant ring
buffer for API retrieval. Each record includes `correlation_id` and `trace_id`.

## Metrics

Prometheus counters/gauges for Phase 34 live in `app/observability/metrics.py`
and are scraped from `/metrics`. Custom business metrics can also be recorded
through `/api/observability/metrics`.

## Health & SLA

`HealthService` probes database/redis/celery/api dependencies. Results feed
`SLAMonitor` availability/latency/error-rate evaluations.

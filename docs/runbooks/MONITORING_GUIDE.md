# Monitoring Guide

- Scrape `/metrics` (Prometheus text).
- Alert rules: `deploy/prometheus/alerts.yml`.
- Dashboard: `deploy/grafana/pintdown-dashboard.json`.
- Probes: `/healthz/liveness|readiness|startup`.
- Ops console: `/internal/operations`.

Correlation: propagate `X-Request-ID` / `X-Correlation-ID`. Logs are JSON with redaction.

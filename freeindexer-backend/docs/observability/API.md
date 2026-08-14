# Observability API

Base path: `/api/observability`

All endpoints require a Bearer JWT and an observability permission.

## Permissions

| Permission | Capabilities |
|------------|--------------|
| `observability:read` | Overview, health, metrics, traces, logs, incidents, alerts, compliance readiness, diagnostics, SLA |
| `observability:write` | Record metrics/logs/traces, create alerts/incidents, security events, consent, diagnostics |
| `observability:admin` | Governance policies, retention, deletion, compliance reports/exports |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/overview` | Platform overview dashboard payload |
| GET | `/health` | Live dependency health + persist checks |
| GET | `/health/checks` | Historical health check rows |
| GET/POST | `/metrics` | List / record metrics |
| GET/POST | `/traces` | List / start spans |
| POST | `/traces/finish` | Finish a span |
| GET/POST | `/logs` | List / emit structured logs |
| GET/POST | `/alerts` | List / create alerts |
| POST | `/alerts/{id}/acknowledge` | Acknowledge alert |
| GET/POST | `/incidents` | List / create incidents |
| GET | `/incidents/{id}` | Incident detail |
| POST | `/incidents/{id}/acknowledge` | Acknowledge |
| POST | `/incidents/{id}/escalate` | Escalate |
| POST | `/incidents/{id}/resolve` | Resolve + RCA |
| GET/POST | `/governance/policies` | List / create policies |
| POST | `/governance/policies/{id}/approve` | Approve |
| POST | `/governance/policies/{id}/version` | Version bump |
| GET | `/compliance/readiness` | GDPR readiness |
| GET/POST | `/compliance/reports` | List / generate reports |
| POST | `/compliance/consent` | Consent tracking |
| POST | `/compliance/retention` | Retention policy |
| POST | `/compliance/deletion` | Deletion workflow |
| GET | `/compliance/export` | Audit export |
| GET/POST | `/security/events` | Security events |
| GET | `/security/ip/{ip}` | IP reputation |
| GET/POST | `/diagnostics` | List / run diagnostics |
| GET | `/sla` | SLA evaluation |

# Compliance Engine

## GDPR readiness

Readiness scoring checks:

- Consent tracking records present
- Retention policies configured
- Deletion workflow available
- Audit export available

## Workflows

| Workflow | Endpoint |
|----------|----------|
| Consent tracking | `POST /compliance/consent` |
| Retention policy | `POST /compliance/retention` |
| Deletion request | `POST /compliance/deletion` |
| Report generation | `POST /compliance/reports` |
| Audit export | `GET /compliance/export` |

Reports are persisted in `compliance_reports` for historical evidence.
Background task `observability.compliance_scan` regenerates readiness reports.

# Phase 26 White-Label Engine REST API Specification

## Base Route: `/api/white-label`

### Endpoints

- `POST /api/white-label/brands`: Create white-label agency/enterprise brand.
- `GET /api/white-label/brands`: List configured brands.
- `POST /api/white-label/workspaces`: Create client workspace.
- `GET /api/white-label/workspaces`: List client workspaces.
- `POST /api/white-label/members`: Add user to workspace with RBAC role.
- `POST /api/white-label/templates`: Create report template.
- `GET /api/white-label/templates`: List report templates.
- `POST /api/white-label/schedules`: Configure automated report schedule.
- `GET /api/white-label/schedules`: List active schedules.
- `POST /api/white-label/reports`: Generate executive report with AI summary.
- `GET /api/white-label/reports`: List generated reports.
- `GET /api/white-label/reports/download/{filename}`: Download report file.
- `POST /api/white-label/assets`: Upload logo or brand asset reference.
- `GET /api/white-label/portal/overview`: Fetch aggregated client portal metrics.
- `GET /api/white-label/analytics`: Get platform usage & delivery analytics.

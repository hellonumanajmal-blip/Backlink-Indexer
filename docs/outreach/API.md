# Phase 25 Outreach CRM API Specification

## Base Route: `/api/outreach`

### Endpoints

- `POST /api/outreach/campaigns`: Create new outreach campaign.
- `GET /api/outreach/campaigns`: List campaigns for tenant.
- `POST /api/outreach/publishers`: Register publisher organization.
- `GET /api/outreach/publishers`: List publisher organizations.
- `POST /api/outreach/contacts`: Create publisher contact.
- `GET /api/outreach/contacts`: List publisher contacts.
- `POST /api/outreach/opportunities`: Register link opportunity with AI scoring.
- `GET /api/outreach/opportunities`: List opportunities in pipeline.
- `POST /api/outreach/relationships`: Record relationship communication event.
- `GET /api/outreach/relationships`: View relationship interaction history.
- `POST /api/outreach/tasks`: Create campaign workflow task.
- `GET /api/outreach/tasks`: List campaign tasks.
- `POST /api/outreach/notes`: Attach note or document reference.
- `GET /api/outreach/notes`: List campaign notes.
- `POST /api/outreach/reports`: Generate executive report.
- `GET /api/outreach/reports`: List generated reports.
- `GET /api/outreach/reports/download/{filename}`: Download generated report file.

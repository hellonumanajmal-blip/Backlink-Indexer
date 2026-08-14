# Phase 25 Deployment Guide

## Database Migration

Run Alembic migration `0011_outreach_crm`:

```bash
alembic upgrade head
```

## Backend Verification

Run Pytest test suite:

```bash
pytest tests/test_outreach.py
```

## Frontend Next.js Client Route

The outreach CRM dashboard is accessible at:

`/internal/outreach`

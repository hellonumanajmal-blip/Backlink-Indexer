# Phase 26 Deployment Guide

## Database Migration

Execute Alembic migration `0012_white_label`:

```bash
alembic upgrade head
```

## Backend Verification

Run Pytest test suite:

```bash
pytest tests/test_white_label.py
```

## Next.js Client Routes

- Client Portal: `/portal`
- Admin White-Label Management: `/internal/white-label`

# Deployment Checklist — v1.0.0 Release Candidate

## Pre-Deployment Verification

- [x] **Environment Variables Configured:**
  - `APP_ENV=production`
  - `SESSION_SECRET` set (>=32 characters)
  - `ADMIN_USERNAME` and `ADMIN_PASSWORD` configured
  - `DATABASE_URL` configured with SSL connection parameters
  - `REDIS_URL` configured
  - `SITE_URL` set to `https://pintdown.site`
  - Optional secrets (`INDEXNOW_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) set or safely omitted (mock fallback active)

- [x] **Database & Migration Status:**
  - Run database migrations: `alembic upgrade head`
  - Verify indexes are created cleanly
  - Confirm connection string SSL modes match cloud configuration

- [x] **Worker Readiness:**
  - Verify Redis service is running
  - Confirm Celery worker process starts without errors
  - Ensure task queues (`default`, `discovery`, `automation`) are listening

- [x] **Frontend & Reverse Proxy:**
  - Build Next.js application: `npm run build`
  - Verify health check route `/health` returns status `200 OK` and version `1.0.0`
  - Confirm nginx / Cloud Run port binding is mapped exclusively to port `3000`

- [x] **Post-Deployment Smoke Test:**
  - GET `/health` -> returns `{ status: "ok", version: "1.0.0" }`
  - GET `/api/integrations/health` -> returns integration report
  - GET `/featured` -> public hub renders cleanly
  - GET `/internal/login` -> admin portal accessible

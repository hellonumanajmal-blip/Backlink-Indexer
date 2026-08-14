# Operations Runbook — v1.0.0 Release Candidate

## Routine Maintenance & Standard Procedures

### 1. Monitoring System Health
- **Public Health Endpoint:** `GET /health`
- **Integrations Health Endpoint:** `GET /api/integrations/health`
- **Operations Dashboard:** Navigate to `/internal/ops-center` to view real-time queue depths, latency spikes, and worker state.

### 2. Managing Failed Integrations & Retries
- If an integration enters `degraded` or `warning` status, check the `/internal/integrations` dashboard.
- The Production Integration Manager automatically retries transient failures with exponential backoff.
- For missing secrets in production, the system disables only the affected connector while preserving all remaining application functions.

### 3. Queue Depth & Worker Auto-Scaling
- If Celery queue depth exceeds 500 items:
  ```bash
  # Scale worker instances in Cloud Run or Docker Compose
  docker compose scale worker=3
  ```

### 4. Rotating Admin Credentials
- Update `ADMIN_PASSWORD` in environment configuration.
- Restart backend container: `docker compose restart backend`.
- Existing session cookies will automatically invalidate on next request.

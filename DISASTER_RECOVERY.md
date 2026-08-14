# Disaster Recovery Plan — v1.0.0 Release Candidate

## Objective
Minimize downtime and prevent data loss in the event of infrastructure outages, database corruption, or regional failures.

---

## Recovery Scenarios

### Scenario A: Database Service Disruption
1. **Detection:** Health check `/health` fails DB connection check or `/internal/ops-center` flags database error.
2. **Action:**
   - Switch application connection string (`DATABASE_URL`) to read-replica or secondary hot-standby instance.
   - Run `alembic upgrade head` to verify schema parity.
   - Restart backend service.
3. **RTO:** < 5 minutes.
4. **RPO:** < 1 minute (WAL replication enabled).

### Scenario B: Redis / Worker Failure
1. **Detection:** Worker queue metric reports stale process timestamps in Ops Center.
2. **Action:**
   - Flush corrupted Redis queue buffer: `redis-cli flushdb`.
   - Restart worker service: `docker compose restart worker`.
   - The Discovery Automation Manager will automatically re-queue pending workflow runs on the next heartbeat.
3. **RTO:** < 2 minutes.

### Scenario C: Complete Container / Regional Outage
1. **Action:**
   - Provision fresh container host using production Docker image tag `v1.0.0`.
   - Restore PostgreSQL from latest automated snapshot (see `BACKUP_STRATEGY.md`).
   - Launch stack: `docker compose -f docker-compose.prod.yml up -d`.
2. **RTO:** < 15 minutes.

# Phase 15 — Enterprise Live Operations Center

**Status:** Complete  
**Depends on:** Phases 1–14  
**Rule:** Monitoring and operational control only. No indexing guarantees. Consume existing queue/worker/automation/connector/ops health services — never duplicate business logic.

---

## Honest limitations

- CPU/memory per worker are best-effort from Celery `stats()` when available; otherwise reported as null.
- SSE is the real-time transport; dashboards also poll as a compatibility fallback.
- Email/Telegram/Webhook notification providers are pluggable interfaces; Telegram reuses the existing notifications module when configured.
- Phase 10 `/api/operations/{health,metrics,status,backups,version}` remain unchanged.

---

## Architecture

```
SSE / REST / Polling
        │
        ▼
┌──────────────────────────┐
│ OperationsCenterService  │
├────────┬─────────────────┤
│ LiveMetrics │ WorkerMonitor │ QueueMonitor │ PipelineMonitor
│ ActivityStream │ Alert │ Incident │ Notification
└────────┴─────────────────┘
        │ reads
 SystemHealthService · Automation · Connectors · Celery inspect · Redis
```

---

## Real-time transport

**SSE:** `GET /api/operations/live/stream`  
**Snapshot:** `GET /api/operations/live`  
Polling fallback on all dashboards (3–5s).

---

## Database

Migration `016_live_operations`:

- `live_events`, `worker_status`, `queue_snapshots`, `system_alerts`
- `incidents`, `notifications`, `notification_providers`

---

## REST API (additive under `/api/operations`)

Live, workers, queues, pipeline, events, alerts, incidents, notifications + acknowledge/resolve/test.

Permissions: `live_ops.view`, `live_ops.manage` (admin username still allowed).

---

## Celery

`operations.monitor` · `operations.alert` · `operations.snapshot` · `operations.cleanup`

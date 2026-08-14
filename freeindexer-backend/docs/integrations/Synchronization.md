# Synchronization Engine

The sync engine executes data synchronization between the platform and external
services via connectors.

## Modes

| Mode | Trigger | Behaviour |
|------|---------|-----------|
| `manual` | API call | One-off sync on demand |
| `scheduled` | Celery beat | Recurring sync on a schedule |
| `incremental` | API/schedule | Sync only changes since last checkpoint |
| `full` | API/schedule | Re-sync all data |

## Execution flow

1. `IntegrationService.run_sync` resolves the integration and decrypts
   credentials.
2. `SyncEngine.run` creates a `SyncJob` (status `running`) and instantiates the
   connector.
3. The connector's `synchronize(mode, checkpoint)` performs the transfer and
   returns a `SyncResult` with counts, a new checkpoint, and any conflicts.
4. The job is marked `succeeded`, `partial`, or `failed`; a `SyncHistory` row is
   written for auditing.

## Conflict detection

Connectors return conflicts in `SyncResult.conflicts`. The count is recorded in
the job's `stats.conflicts`. Resolution policy is connector-specific.

## Checkpoint recovery

`SyncResult.checkpoint` is persisted on the job. An incremental sync resumes
from the stored checkpoint, so an interrupted run can continue without
reprocessing.

## Retry management

Transient connector failures are retried up to `max_attempts` (default 3) within
a run. Each attempt increments `job.attempts`. Persistent failure marks the job
`failed` and sets the integration status to `error`.

## Metrics

- `sync_jobs_total{connector_type, mode, status}`
- `sync_failures_total{connector_type}`

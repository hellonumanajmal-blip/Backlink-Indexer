# Enterprise Workflow Builder & Event Processing Platform — Architecture Overview

## Overview

The Enterprise Workflow Builder & Event Processing Platform (`app/modules/workflows/`) provides an event-driven automation framework across all platform modules.

## Architecture & Components

1. **Workflow Engine (`WorkflowEngine`)**:
   - Evaluates trigger events.
   - Evaluates complex condition logic (AND, OR, NOT, field comparisons, dates, numeric thresholds, tenant isolations).
   - Coordinates ordered execution of workflow actions.
   - Handles retries and failure reporting.

2. **Event Bus (`EventBus`)**:
   - Manages publish-subscribe mechanism for system-wide events (`BacklinkCreated`, `HealthScoreChanged`, `IndexVerified`, `ReportGenerated`, `InvoicePaid`, etc.).
   - Asynchronously dispatches events to subscribed workflow rules.

3. **Registries**:
   - **Trigger Registry (`TriggerRegistry`)**: Validates supported trigger types (`Immediate`, `Scheduled`, `Cron`, `Threshold`, `MetricChange`, `Manual`, `Webhook`, `API`, `Recurring`).
   - **Action Registry (`ActionRegistry`)**: Executes system actions (`GenerateReport`, `RefreshDiscovery`, `RunVerification`, `RecalculatePriority`, `CreateTask`, `CreateAlert`, `SendNotification`, `ExportReport`, `ArchiveCampaign`, `UpdateStatus`, `CallInternalService`, `InvokeWebhook`).

4. **Data Models (`app/modules/workflows/models.py`)**:
   - `Workflow`: Workflow definitions with versioning and status.
   - `WorkflowVersion`: Historical definition snapshots.
   - `WorkflowTrigger`: Event, cron, or threshold triggers.
   - `WorkflowCondition`: Conditional rule filters.
   - `WorkflowAction`: Ordered action nodes.
   - `WorkflowExecution`: Execution history and durations.
   - `WorkflowEvent`: Event log stream.
   - `WorkflowTemplate`: Pre-configured automation templates.
   - `WorkflowFailure`: Dead-letter and failure tracking.

5. **Prometheus Metrics (`app/modules/workflows/metrics.py`)**:
   - `workflow_executions_total`
   - `workflow_success_total`
   - `workflow_failure_total`
   - `workflow_retry_total`
   - `workflow_duration_seconds`
   - `active_workflows_total`
   - `scheduled_workflows_total`

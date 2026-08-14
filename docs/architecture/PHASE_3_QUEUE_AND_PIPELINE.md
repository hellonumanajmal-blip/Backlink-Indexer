# Phase 3 Queue and Pipeline Architecture

## Overview
Phase 3 introduces an asynchronous processing platform for discovery submissions. The platform keeps the existing project/campaign/discovery APIs intact while moving work into queue-backed jobs and pipeline stages.

## Queue Architecture
- Queue jobs are created whenever a discovery submission is accepted.
- Each job owns one or more queue items, one per backlink submission.
- Queue processing is asynchronous and never executed inline in request handlers.
- Redis/Celery provide the execution foundation, while SQLAlchemy persists job state.

## Processing Pipeline
Every backlink progresses through the following stages:
1. Submitted
2. Queued
3. Validation
4. Technical Analysis
5. Discovery Preparation
6. Signal Generation
7. Feed Update
8. WebSub
9. Finished

The current phase implements the framework and lifecycle, while placeholder validation logic records progress and errors without performing external discovery work.

## Job Lifecycle
Supported states:
- Queued
- Waiting
- Running
- Paused
- Retrying
- Completed
- Failed
- Cancelled

Each state transition is recorded in append-only history entries.

## Retry Strategy
- Retry is available for recoverable validation failures.
- Retry count increments per attempt.
- Backoff is applied via job state transitions and event recording.
- Jobs remain recoverable until the failure is terminal.

## Failure Recovery
- Failed jobs remain persisted and can be retried.
- Errors include an error code, message, retry availability, and timestamp.
- Cancellation is explicit and recorded.

## Event Flow
Internal events emitted during processing include:
- BacklinkSubmitted
- JobCreated
- ValidationCompleted
- PipelineStarted
- PipelineFinished
- JobFailed
- RetryScheduled

## Worker Design
- Validation worker handles placeholder validation.
- Pipeline worker advances the job through the workflow stages.
- Notification worker is scaffolded for later integration.

## State Machine
The queue engine stores:
- current stage
- percentage complete
- started/completed timestamps
- retry count
- worker identity
- last error
- structured event history

## Database Changes
Phase 3 introduces the following tables:
- queue_jobs
- queue_items
- job_history

## Performance Strategy
- Long-running work is executed asynchronously.
- APIs return quickly and do not block on processing.
- The design supports thousands of jobs via queue-based execution.

## Scalability Plan
- Worker instances can scale horizontally.
- Job state remains in SQLAlchemy-backed tables.
- Redis/Celery provide queue fan-out and concurrency.

## Testing Plan
- Queue creation
- Job lifecycle transitions
- Retry and cancellation
- Worker execution
- Event bus behavior
- Ownership enforcement
- API contract stability

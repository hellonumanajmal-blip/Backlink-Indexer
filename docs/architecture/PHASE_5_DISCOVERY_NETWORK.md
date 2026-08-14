# Phase 5 — Discovery Network

This document describes Phase 5: Discovery Network & Signal Generation Engine.

## Goals
- Create standards-based discovery signals to help search engines discover backlinks faster.
- Keep all work transparent and compliant with search engine policies.
- Build modular pipeline stages for feed generation, WebSub publishing, and IndexNow submissions.

## Discovery Signal Architecture
- Campaigns and Backlinks feed into a modular pipeline:
  - Validation
  - Discovery Feed Builder
  - Feed Generators (RSS/Atom/JSON)
  - WebSub Publisher
  - IndexNow (owned domains only)
  - Signal History
- Each stage produces append-only events recorded in the signal history.

## Feed Generation
- Supported formats: RSS 2.0, Atom, JSON Feed.
- Feeds regenerated only when inputs change.
- Use atomic file writes and store feed history records.
- Keep canonical timestamps and checksums to detect changes.

## WebSub Flow
- Support multiple hubs (configurable).
- Publish hub notifications in background workers.
- Retry with exponential backoff and circuit-breaker logic.
- Log delivery attempts in an append-only `websub_deliveries` table.
- Do not block API requests — enqueue notifications.

## IndexNow Strategy
- Only submit URLs for domains verified by the customer.
- Store IndexNow keys encrypted in `indexnow_keys`.
- Batch submissions and retry failures.
- Log each submission in `indexnow_submissions`.
- Reject attempts to submit third-party URLs with clear error.

## Retry Logic
- Exponential backoff with jitter.
- Configurable max retries and timeouts per hub/service.
- Circuit breaker to pause publishing after repeated failures.

## Hub Management
- `websub_hubs` table: hub URLs, status, last_success, config.
- Admin can enable/disable hubs and set concurrency limits.

## Scheduler Design
- Background workers process feed builds and hub publishing.
- Configurable worker count and concurrency limits.

## Event Flow
- Events emitted and recorded: FeedGenerated, FeedUpdated, WebSubQueued, WebSubDelivered, WebSubFailed, IndexNowSubmitted, SignalCompleted

## Database Schema
- discovery_feed_history
- websub_hubs
- websub_deliveries
- indexnow_keys
- indexnow_submissions
- discovery_signal_events

All history tables are append-only.

## Security
- Encrypt secrets (IndexNow keys) at rest.
- Validate ownership before IndexNow submissions.
- Prevent duplicate submissions and audit admin changes.

## Testing Strategy
- Unit tests for feed generation and validity (RSS/Atom/JSON).
- Integration tests for WebSub retries and circuit breaker.
- Tests for IndexNow ownership validation and API endpoints.



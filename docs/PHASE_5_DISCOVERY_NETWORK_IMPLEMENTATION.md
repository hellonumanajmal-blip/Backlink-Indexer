# Phase 5 Implementation Plan

This document outlines the implementation details for Phase 5.

## Modules to add
- `app.modules.discovery_network.models` — DB models for feeds, hubs, deliveries, keys, submissions, events.
- `app.modules.discovery_network.services.feed_service` — build feeds, cache checksums, atomic writes.
- `app.modules.discovery_network.services.websub_service` — enqueue, deliver, retry.
- `app.modules.discovery_network.services.indexnow_service` — verify ownership, submit, batch, retry.
- `app.modules.discovery_network.api` — HTTP endpoints for feeds, hubs, publish, history, IndexNow.

## Database tables
- `discovery_feed_history` — id, campaign_id, feed_type, checksum, path/url, created_at
- `websub_hubs` — id, hub_url, active, config, created_at
- `websub_deliveries` — id, hub_id, feed_id, status, response_code, attempt, created_at
- `indexnow_keys` — id, org_id, domain, encrypted_key, verified, created_at
- `indexnow_submissions` — id, org_id, batch_id, status, response, created_at
- `discovery_signal_events` — id, event_type, details, created_at

## API endpoints
- `GET /api/discovery/signals` — list signals
- `GET /api/discovery/feed` — latest feed (by campaign/project)
- `GET /api/discovery/feed/history` — feed history
- `GET /api/websub/hubs` — list hubs
- `POST /api/websub/publish` — trigger publish for feed(s)
- `GET /api/websub/history` — deliveries history
- `GET /api/indexnow/status` — check ownership/status
- `POST /api/indexnow/submit` — submit batch (owned domains only)
- `GET /api/indexnow/history` — submissions history

## Background processing
- Use existing queue/QueueService to schedule feed builds and publishing.
- WebSub and IndexNow operations must run in background (Celery or queued worker).

## Security
- Use existing tenancy model to bind `indexnow_keys` to orgs.
- Encrypt keys using application secret.

## Testing
- Add unit and integration tests under `backend/tests/test_phase5_*`.


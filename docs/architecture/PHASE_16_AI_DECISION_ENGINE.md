# Phase 16: Enterprise AI Decision Engine Architecture

## Overview
The **Enterprise AI Decision Engine** module (`backend/app/modules/ai_decision_engine`) provides deterministic, weighted scoring, system risk analysis, metric forecasts, and recommendation generation across all PintDown Discovery Accelerator sub-systems.

## Architectural Principles
1. **Zero External LLM Dependencies**: Purely deterministic logic using weighted linear scoring models.
2. **Clean Architecture Isolation**: Strictly decoupled into `models`, `dtos`, `repository`, `service`, sub-engines (`risk`, `priority`, `predictions`, `recommendations`), `tasks`, and `router`.
3. **Multi-Source Data Ingestion**: Consumes metrics from Discovery Signals, Search Intelligence, Automation Runs, Connectors, Queues, Health Metrics, and Backlink statuses without duplicating business logic.

## Sub-Engine Scoring Models

### 1. Risk Engine (`risk.py`)
Weight Allocation:
- **Task Failure Rate** (25%): `(failed_count / total_count) * 1.5`
- **Queue Congestion** (20%): `(pending_items / max_capacity) * 100`
- **Retry Spikes** (15%): `(retry_count / total_count) * 200`
- **Connector Errors** (15%): `(connector_errors / connector_total) * 100`
- **System Latency** (15%): `max(0, (p95_latency_ms - 200) / 10)`
- **Unindexed Target Ratio** (10%): `(unindexed / total_backlinks) * 100`

### 2. Priority Engine (`priority.py`)
Calculates priority scores (0 - 100):
- Authority Score Weight: 40%
- Backlog Urgency Weight: 25%
- Priority Campaign Tier: 20%
- Target Volume Weight: 15%

### 3. Prediction Engine (`predictions.py`)
Computes:
- **Predicted Crawl Success %**: `(0.7 * historical_success) + (0.3 * crawled_ratio)`
- **Queue Completion Drain Time**: `queue_pending / (active_workers * 5.0)` tasks/sec
- **Estimated Indexation Yield**: Forecasted +8.5% over 24h horizon

### 4. Recommendation Engine (`recommendations.py`)
Generates actionable items categorized by `automation`, `health`, `optimization`, and `action`.

## API Routes
- `GET /api/ai/overview`
- `GET /api/ai/recommendations`
- `GET /api/ai/risk`
- `GET /api/ai/predictions`
- `GET /api/ai/opportunities`
- `POST /api/ai/recalculate`

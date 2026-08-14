# REST API Documentation — Index Verification Platform

## Endpoints

### 1. Trigger Verification
`POST /api/verification/verify`
Submits a URL for index verification.

### 2. Status & Visibility Metrics
`GET /api/verification/status`
Returns current overall search index verification status and visibility metrics.

### 3. Queue & History
`GET /api/verification/queue`
`GET /api/verification/history`
`GET /api/verification/indexed`
`GET /api/verification/non-indexed`

### 4. Visibility Snapshots & Backlinks
`GET /api/verification/visibility`
`GET /api/verification/backlinks`

### 5. Recommendations & Alerts
`GET /api/verification/recommendations`
`GET /api/verification/alerts`

### 6. Analytics & Scheduler
`GET /api/verification/analytics`
`POST /api/verification/scheduler/run`

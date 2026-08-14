# Enterprise Backlink Intelligence, Monitoring & Lifecycle Management Platform — API Reference

## Base Path
`/api/backlink-lifecycle`

## Endpoints

### 1. Register Managed Backlink
- **HTTP Method:** `POST /add`
- **Query Params:** `tenant_id` (string)
- **Request Body:**
  ```json
  {
    "source_url": "https://searchengineland.com/backlink-article",
    "target_url": "https://freeindexer.io/product",
    "target_domain": "freeindexer.io",
    "anchor_text": "indexing engine",
    "rel_attribute": "Follow",
    "anchor_type": "Brand"
  }
  ```
- **Response:** `BacklinkStatusResponse`

### 2. List Tracked Backlinks
- **HTTP Method:** `GET /list`
- **Query Params:** `tenant_id` (string)
- **Response:** `List[BacklinkLifecycleDTO]`

### 3. Backlink Health Breakdowns
- **HTTP Method:** `GET /health`
- **Query Params:** `tenant_id` (string)
- **Response:** `List[BacklinkHealthDTO]`

### 4. Anchor Text Intelligence
- **HTTP Method:** `GET /anchors`
- **Query Params:** `tenant_id` (string)
- **Response:** `AnchorAnalysisSummaryDTO`

### 5. Referring Domain Stats
- **HTTP Method:** `GET /domains`
- **Query Params:** `tenant_id` (string)
- **Response:** `List[ReferringDomainStatsDTO]`

### 6. Link Velocity Snapshots
- **HTTP Method:** `GET /velocity`
- **Query Params:** `tenant_id` (string)
- **Response:** `List[VelocitySnapshotDTO]`

### 7. Toxic Link Detection
- **HTTP Method:** `GET /toxic`
- **Query Params:** `tenant_id` (string)
- **Response:** `List[ToxicBacklinkDTO]`

### 8. Backlink Opportunities
- **HTTP Method:** `GET /opportunities`
- **Query Params:** `tenant_id` (string)
- **Response:** `List[OpportunityRecommendationDTO]`

### 9. Anomaly Alerts
- **HTTP Method:** `GET /alerts`
- **Query Params:** `tenant_id` (string)
- **Response:** `List[BacklinkAlertDTO]`

### 10. Anchor Change Audit Logs
- **HTTP Method:** `GET /history`
- **Query Params:** `tenant_id` (string)
- **Response:** `List[AnchorHistoryDTO]`

# SEO Intelligence & Competitor Benchmarking API Specification

## Endpoints

### 1. Competitor Management
- `GET /api/seo/projects` — List project configurations per tenant.
- `POST /api/seo/projects` — Create project configuration.
- `GET /api/seo/competitors?project_id={id}` — List active competitor domains.
- `POST /api/seo/competitors?project_id={id}` — Add new competitor domain.

### 2. Domain Benchmarking
- `GET /api/seo/benchmark?project_id={id}` — Calculate live domain comparison and metric gaps.
- `POST /api/seo/benchmark?project_id={id}` — Trigger background benchmark recalculation.

### 3. Backlink Gap Analysis
- `GET /api/seo/backlink-gap?project_id={id}` — Retrieve identified backlink gaps and opportunities.
- `POST /api/seo/backlink-gap?project_id={id}` — Run backlink gap analysis engine.

### 4. Content & Quality Intelligence
- `GET /api/seo/content?project_id={id}` — Analyze top URLs, traffic, and content growth.
- `GET /api/seo/domain-analysis?project_id={id}` — Evaluate trust scores, TLD distribution, and IP stability.
- `GET /api/seo/anchors?project_id={id}` — Compute anchor profile distribution and over-optimization risk.

### 5. Trend Analytics & AI Recommendations
- `GET /api/seo/trends?project_id={id}&period_type={Weekly|Monthly}` — Retrieve historical trend telemetry.
- `GET /api/seo/recommendations?project_id={id}` — Fetch AI-prioritized actionable recommendations.
- `GET /api/seo/alerts?project_id={id}` — Fetch active anomaly and competitor threat alerts.

### 6. Executive Reporting
- `GET /api/seo/reports?project_id={id}` — List generated executive reports.
- `POST /api/seo/reports?project_id={id}` — Generate downloadable PDF/CSV executive reports.
- `GET /api/seo/reports/download/{file_name}` — Secure report download endpoint.

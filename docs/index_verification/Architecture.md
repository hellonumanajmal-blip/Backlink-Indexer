# Enterprise Search Visibility & Index Verification Platform — Architecture

## Overview
The **Index Verification Platform** continuously verifies search engine discovery, crawl status, and indexing state for customer URLs and backlinks.

## Component Design
1. **IndexVerificationService**: Orchestrates verification routines, updates metrics, logs state transitions.
2. **VerificationScheduler**: Selects due jobs based on monitoring policy intervals.
3. **VerificationPolicyEngine**: Evaluates next verification window according to policy (Hourly, Daily, Weekly, Monthly, Adaptive, Priority Based, Manual).
4. **VisibilityAnalyzer**: Calculates Visibility Score, Index Rate, Discovery Rate, Retention Rate, Lost Index Rate, and Recovery Rate.
5. **VerificationAggregator**: Monitors anomalies and triggers alerts for severe index drops or backlink losses.
6. **VerificationRepository**: Async SQLAlchemy CRUD persistence for jobs, results, snapshots, alerts, and recommendations.

## Data Persistence
- `verification_jobs`: Scheduled and active verification tasks.
- `verification_results`: Execution outcome logs and crawl directives.
- `visibility_snapshots`: Historical visibility metrics.
- `index_history`: URL indexing state transitions.
- `backlink_history`: Backlink presence, status, and anchor verification.
- `visibility_alerts`: Index drop & anomaly alerts.
- `recommendation_history`: Actionable AI recommendations.
- `verification_statistics`: Aggregated daily statistics.

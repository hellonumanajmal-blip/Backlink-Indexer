# Operations & Celery Background Tasks

## Scheduled Celery Tasks
1. `run_verification_scheduler_task`: Periodic verification sweep.
2. `aggregate_visibility_task`: Aggregates visibility metrics and creates snapshots.
3. `calculate_visibility_trends_task`: Calculates 30-day visibility trend lines.
4. `generate_recommendations_task`: Evaluates crawl directives and generates AI recommendations.
5. `generate_visibility_alerts_task`: Triggers alerts on index drop anomalies.
6. `cleanup_verification_logs_task`: Purges expired logs.

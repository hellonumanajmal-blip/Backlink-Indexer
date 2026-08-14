# Incident Response Guide

1. Detect (alert / user report).
2. Triage severity (P1 API down → page on-call).
3. Stabilize (scale replicas, disable non-critical workers, enable maintenance messaging).
4. Investigate (`/api/operations/status`, logs by `request_id`, Celery failures).
5. Recover (rollback release or restore backup per DR guide).
6. Postmortem within 5 business days; file audit event.

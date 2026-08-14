# Phase 25 Operations Manual

## Prometheus Metrics

- `outreach_campaigns_total`: Counter tracking created campaigns by status.
- `outreach_contacts_total`: Counter tracking added publisher contacts.
- `outreach_opportunities_total`: Counter tracking pipeline opportunities.
- `outreach_pipeline_items_total`: Gauge tracking active pipeline volume.
- `outreach_relationships_total`: Counter tracking relationship interactions.
- `outreach_reports_generated_total`: Counter tracking report exports.

## Background Jobs

- `run_relationship_scoring`: Periodic trust score recalculations.
- `run_opportunity_scoring`: Periodic opportunity score refreshes.
- `run_scheduled_reports`: Weekly/Monthly report automation.
- `process_reminders`: Task due date notifications.
- `run_analytics_aggregation`: Daily conversion metrics rollup.
- `run_outreach_cleanup`: Purge/Archive worker.

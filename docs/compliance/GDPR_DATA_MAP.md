# GDPR Data Map (Readiness)

| Data class | Location | Retention note |
|------------|----------|----------------|
| User accounts | `users` | Until deleted / SCIM disable |
| Sessions | `user_sessions` | Cookie max-age |
| Org membership | `organisation_members` | With org lifecycle |
| Backlinks | `tracked_backlinks` | Project scoped |
| Validation | `backlink_validation_results` | Operational |
| AI interactions | `ai_interactions` | Audit / cost control |
| Billing | `organisation_subscriptions`, invoices | Financial retention policy |
| Backups | `storage/backups` | Retention days |

Rights: access/export via admin tools; erasure via soft-delete + backup expiry.

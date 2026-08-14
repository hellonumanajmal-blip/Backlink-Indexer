# Backup Strategy — v1.0.0 Release Candidate

## Backup Policies

### 1. PostgreSQL Database Backups
- **Frequency:** Continuous Write-Ahead Logging (WAL) + Daily Full Snapshots at 02:00 UTC.
- **Retention:**
  - Hourly snapshots: Retained for 48 hours.
  - Daily backups: Retained for 30 days.
  - Monthly snapshots: Retained for 12 months.
- **Automated Backup Command:**
  ```bash
  pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -Fc -f "/backups/db_backup_$(date +%Y%m%d_%H%M%S).dump"
  ```
- **Encryption:** Backup artifacts encrypted at rest using AES-256 GCM before uploading to isolated cloud bucket storage.

### 2. Redis State Backups
- Persistent RDB snapshots enabled with `save 60 1000` configuration.
- Redis treated as ephemeral; operational queues can be rebuilt safely from primary PostgreSQL state.

### 3. Restore Verification Procedure
- Monthly automated restore drill onto staging database instance to verify data integrity and schema compatibility.

# Backup Guide

## Create

```bash
curl -X POST -b cookies.txt 'http://localhost:8000/api/operations/backups/run?type=all'
```

Types: `database`, `config`, `assets`, `all`.

## Verify

```bash
curl -X POST -b cookies.txt 'http://localhost:8000/api/operations/backups/verify?backup_id=<ID>'
```

HMAC integrity uses `BACKUP_HMAC_SECRET` (falls back to session secret).

## Retention

Default 14 days (database). Config/assets 90 days. Adjust via backup settings / env.

## Cloud foundation

Set `BACKUP_REMOTE_URI` (S3-compatible) when ready; local storage remains default.

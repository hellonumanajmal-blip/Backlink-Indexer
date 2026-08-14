# Security Center

Phase 34 adds API security monitoring on top of existing JWT auth, RBAC, and
audit logging.

## Capabilities

- Failed login detection with escalating severity
- Suspicious activity scoring (failed logins, token abuse, geo anomalies)
- Token abuse detection by fingerprint hit counts
- IP reputation tracking derived from auth failures
- Rate-limit violation monitoring
- Webhook signature validation events
- Secret rotation tracking

## API

`POST /api/observability/security/events` with `event_type` one of:

`failed_login`, `token_abuse`, `rate_limit`, `webhook_validation`,
`secret_rotation`, `suspicious_activity`

`GET /api/observability/security/ip/{ip}` returns reputation score metadata.

## Guarantees

- Events are tenant-scoped and audited via `audit_log`
- Secrets continue to be masked by `app.core.audit.mask_secret`
- No credentials are stored in security event payloads

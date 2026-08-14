# Webhook Platform

Supports inbound and outbound webhooks with signature verification, replay
protection, idempotency, and retry queues.

## Outbound webhooks

1. Subscribe an endpoint: `POST /api/integrations/webhooks/endpoints` with
   `direction=outbound`, a `url`, `event_types`, and an optional `secret`.
2. When a platform event fires, `IntegrationService.publish_event` fans out to
   all active endpoints subscribed to that event type for the tenant.
3. Each delivery is signed (if a secret is set) and recorded in
   `webhook_deliveries`.

### Signature

```
X-Webhook-Timestamp: <unix seconds>
X-Webhook-Signature: hex(HMAC_SHA256(secret, "{timestamp}.{json_body}"))
```

Verify by recomputing the signature over the raw body and comparing with a
constant-time comparison.

## Inbound webhooks

`POST /api/integrations/webhooks/inbound/{endpoint_id}` with body:

```json
{
  "event_type": "backlink.lost",
  "payload": { "...": "..." },
  "idempotency_key": "unique-key",
  "signature": "hex",
  "timestamp": 1720000000
}
```

- **Signature verification** — required when the endpoint has a secret.
- **Replay protection** — timestamps outside the tolerance window (default
  300s) are rejected.
- **Idempotency** — a repeated `idempotency_key` returns the original delivery
  without reprocessing.

## Retries

Failed outbound deliveries are marked `retrying` and retried by the
`integrations.webhook_retries` Celery task with exponential backoff
(`min(2^attempts * 5, 900)` seconds), up to `webhook_max_retries` (default 5).
After the final attempt the delivery is marked `failed`.

## Delivery history

`GET /api/integrations/webhooks/deliveries/{endpoint_id}` returns recent
deliveries with status, attempts, response code, and timestamps.

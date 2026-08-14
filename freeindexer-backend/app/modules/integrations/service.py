"""Integration service: orchestrates connectors, credentials, sync, webhooks,
events, and health. This is the primary entry point used by the REST API and
background workers. It reuses the foundation's auth/RBAC/audit/metrics and the
connector SDK; it contains no duplicated business logic from other modules.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.audit import audit_log
from app.core.config import settings
from app.modules.integrations.connector_registry import ConnectorManager, get_manager
from app.modules.integrations.credential_vault import CredentialVault, get_vault
from app.modules.integrations.dtos import (
    ConnectionTestResult,
    OverviewRead,
)
from app.modules.integrations.models import (
    Connector,
    ConnectorCredential,
    Integration,
    IntegrationHealth,
    WebhookDelivery,
    WebhookEndpoint,
)
from app.modules.integrations.repository import (
    ConnectorRepository,
    CredentialRepository,
    HealthRepository,
    IntegrationRepository,
    SyncHistoryRepository,
    SyncJobRepository,
    WebhookDeliveryRepository,
    WebhookEndpointRepository,
)
from app.modules.integrations.sync_engine import SyncEngine
from app.modules.integrations.webhook_platform import WebhookPlatform, verify_signature
from app.observability import metrics

# Canonical platform event types external systems can subscribe to.
SUPPORTED_EVENTS = [
    "workflow.completed",
    "backlink.lost",
    "backlink.recovered",
    "index.verified",
    "visibility.changed",
    "report.generated",
    "invoice.paid",
    "alert.created",
    "campaign.completed",
]


class IntegrationService:
    def __init__(
        self,
        session: AsyncSession,
        *,
        vault: Optional[CredentialVault] = None,
        connector_manager: Optional[ConnectorManager] = None,
        webhook_platform: Optional[WebhookPlatform] = None,
    ) -> None:
        self.session = session
        self.vault = vault or get_vault()
        self.connector_manager = connector_manager or get_manager()
        self.webhooks = webhook_platform or WebhookPlatform()
        self.integrations = IntegrationRepository(session)
        self.connectors = ConnectorRepository(session)
        self.credentials = CredentialRepository(session)
        self.sync_jobs = SyncJobRepository(session)
        self.sync_history = SyncHistoryRepository(session)
        self.webhook_endpoints = WebhookEndpointRepository(session)
        self.webhook_deliveries = WebhookDeliveryRepository(session)
        self.health = HealthRepository(session)
        self.sync_engine = SyncEngine(session, self.connector_manager)

    # ------------------------------------------------------------------
    # Integrations
    # ------------------------------------------------------------------
    async def create_integration(
        self, tenant_id: str, actor: str, *, name: str, connector_type: str,
        config: Dict[str, Any], enabled: bool = True,
    ) -> Integration:
        if not self.connector_manager.registry.is_supported(connector_type):
            raise ValueError(f"Unsupported connector type: {connector_type}")
        integration = Integration(
            tenant_id=tenant_id, name=name, connector_type=connector_type,
            config=config, enabled=enabled, status="active" if enabled else "disabled",
        )
        await self.integrations.add(integration)
        # Create a default connector row bound to this integration.
        cls = self.connector_manager.registry.get(connector_type)
        await self.connectors.add(
            Connector(
                tenant_id=tenant_id, integration_id=integration.id,
                connector_type=connector_type,
                version=getattr(cls, "version", "1.0.0"),
                capabilities=list(getattr(cls, "capabilities", [])),
                config=config,
            )
        )
        audit_log("integration.create", tenant_id=tenant_id, actor=actor,
                  resource_type="integration", resource_id=integration.id)
        metrics.integrations_total.labels(tenant_id=tenant_id, status=integration.status).inc()
        return integration

    async def list_integrations(self, tenant_id: str) -> List[Integration]:
        return await self.integrations.list_for_tenant(tenant_id)

    async def get_integration(self, tenant_id: str, integration_id: str) -> Optional[Integration]:
        return await self.integrations.get_for_tenant(integration_id, tenant_id)

    async def update_integration(
        self, tenant_id: str, actor: str, integration_id: str, **changes: Any
    ) -> Optional[Integration]:
        integration = await self.get_integration(tenant_id, integration_id)
        if integration is None:
            return None
        for key, value in changes.items():
            if value is not None and hasattr(integration, key):
                setattr(integration, key, value)
        if "enabled" in changes and changes["enabled"] is not None:
            integration.status = "active" if changes["enabled"] else "disabled"
        await self.session.flush()
        audit_log("integration.update", tenant_id=tenant_id, actor=actor,
                  resource_type="integration", resource_id=integration_id)
        return integration

    async def delete_integration(self, tenant_id: str, actor: str, integration_id: str) -> bool:
        integration = await self.get_integration(tenant_id, integration_id)
        if integration is None:
            return False
        await self.integrations.delete(integration)
        audit_log("integration.delete", tenant_id=tenant_id, actor=actor,
                  resource_type="integration", resource_id=integration_id)
        return True

    # ------------------------------------------------------------------
    # Connectors
    # ------------------------------------------------------------------
    def list_connector_types(self) -> List[Dict[str, Any]]:
        return self.connector_manager.registry.describe_all()

    async def list_connectors(self, tenant_id: str, integration_id: str) -> List[Connector]:
        return await self.connectors.list_for_integration(tenant_id, integration_id)

    # ------------------------------------------------------------------
    # Credentials
    # ------------------------------------------------------------------
    async def store_credential(
        self, tenant_id: str, actor: str, *, integration_id: str, kind: str,
        secret: str, expires_at=None, extra: Optional[Dict[str, Any]] = None,
    ) -> ConnectorCredential:
        integration = await self.get_integration(tenant_id, integration_id)
        if integration is None:
            raise ValueError("Integration not found")
        cred = ConnectorCredential(
            tenant_id=tenant_id, integration_id=integration_id, kind=kind,
            secret_encrypted=self.vault.encrypt(secret),
            masked_hint=self.vault.hint(secret),
            expires_at=expires_at, extra=extra or {},
        )
        await self.credentials.add(cred)
        audit_log("credential.store", tenant_id=tenant_id, actor=actor,
                  resource_type="credential", resource_id=cred.id,
                  metadata={"kind": kind, "hint": cred.masked_hint})
        return cred

    async def list_credentials(
        self, tenant_id: str, integration_id: str
    ) -> List[ConnectorCredential]:
        return await self.credentials.list_for_integration(tenant_id, integration_id)

    async def rotate_credential(
        self, tenant_id: str, actor: str, credential_id: str, new_secret: str
    ) -> Optional[ConnectorCredential]:
        cred = await self.credentials.get_for_tenant(credential_id, tenant_id)
        if cred is None:
            return None
        cred.secret_encrypted, cred.masked_hint = self.vault.rotate(new_secret)
        cred.rotated_at = datetime.now(timezone.utc)
        await self.session.flush()
        metrics.credential_refresh_total.labels(status="rotated").inc()
        audit_log("credential.rotate", tenant_id=tenant_id, actor=actor,
                  resource_type="credential", resource_id=credential_id)
        return cred

    async def test_connection(self, tenant_id: str, integration_id: str) -> ConnectionTestResult:
        integration = await self.get_integration(tenant_id, integration_id)
        if integration is None:
            return ConnectionTestResult(ok=False, message="integration not found")
        creds = await self.credentials.list_for_integration(tenant_id, integration_id)
        decrypted = {c.kind: self.vault.decrypt(c.secret_encrypted) for c in creds}
        connector = self.connector_manager.create(
            integration.connector_type, tenant_id=tenant_id,
            integration_id=integration_id, config=integration.config, credentials=decrypted,
        )
        import time

        start = time.perf_counter()
        ok = await connector.authenticate() and await connector.validate()
        latency = int((time.perf_counter() - start) * 1000)
        return ConnectionTestResult(
            ok=ok, latency_ms=latency, message="ok" if ok else "authentication/validation failed"
        )

    async def expiring_credentials(
        self, tenant_id: str, within_days: int = 7
    ) -> List[ConnectorCredential]:
        return await self.credentials.list_expiring(tenant_id, timedelta(days=within_days))

    # ------------------------------------------------------------------
    # Synchronization
    # ------------------------------------------------------------------
    async def run_sync(
        self, tenant_id: str, actor: str, *, integration_id: str, mode: str = "manual"
    ):
        integration = await self.get_integration(tenant_id, integration_id)
        if integration is None:
            raise ValueError("Integration not found")
        creds = await self.credentials.list_for_integration(tenant_id, integration_id)
        decrypted = {c.kind: self.vault.decrypt(c.secret_encrypted) for c in creds}
        job = await self.sync_engine.run(
            tenant_id=tenant_id, integration_id=integration_id,
            connector_type=integration.connector_type, mode=mode,
            config=integration.config, credentials=decrypted,
        )
        integration.last_synced_at = datetime.now(timezone.utc)
        if job.status == "failed":
            integration.status = "error"
            integration.last_error = job.error
        await self.session.flush()
        audit_log("sync.run", tenant_id=tenant_id, actor=actor,
                  resource_type="sync_job", resource_id=job.id,
                  metadata={"mode": mode, "status": job.status})
        return job

    async def list_sync_jobs(self, tenant_id: str, integration_id: str) -> List:
        return await self.sync_jobs.list_for_integration(tenant_id, integration_id)

    # ------------------------------------------------------------------
    # Webhooks
    # ------------------------------------------------------------------
    async def create_endpoint(
        self, tenant_id: str, actor: str, *, direction: str, url: Optional[str],
        event_types: List[str], secret: Optional[str], active: bool,
        filters: Dict[str, Any], description: Optional[str],
    ) -> WebhookEndpoint:
        endpoint = WebhookEndpoint(
            tenant_id=tenant_id, direction=direction, url=url, event_types=event_types,
            secret_encrypted=self.vault.encrypt(secret) if secret else None,
            active=active, filters=filters, description=description,
        )
        await self.webhook_endpoints.add(endpoint)
        audit_log("webhook.endpoint.create", tenant_id=tenant_id, actor=actor,
                  resource_type="webhook_endpoint", resource_id=endpoint.id)
        return endpoint

    async def list_endpoints(self, tenant_id: str) -> List[WebhookEndpoint]:
        return await self.webhook_endpoints.list_for_tenant(tenant_id)

    async def publish_event(
        self, tenant_id: str, event_type: str, payload: Dict[str, Any]
    ) -> List[WebhookDelivery]:
        """Fan out an event to all subscribed outbound endpoints."""
        endpoints = await self.webhook_endpoints.list_subscribed(tenant_id, event_type)
        deliveries: List[WebhookDelivery] = []
        for endpoint in endpoints:
            delivery = await self._deliver(tenant_id, endpoint, event_type, payload)
            deliveries.append(delivery)
        return deliveries

    async def _deliver(
        self, tenant_id: str, endpoint: WebhookEndpoint, event_type: str, payload: Dict[str, Any]
    ) -> WebhookDelivery:
        secret = self.vault.decrypt(endpoint.secret_encrypted) if endpoint.secret_encrypted else None
        headers = self.webhooks.build_headers(secret, payload)
        delivery = WebhookDelivery(
            tenant_id=tenant_id, endpoint_id=endpoint.id, direction="outbound",
            event_type=event_type, payload=payload, status="pending", attempts=1,
        )
        status_code, body = await self.webhooks._deliver_http(endpoint.url or "", payload, headers)
        delivery.response_status = status_code
        delivery.response_body = body[:2000] if body else None
        if 200 <= status_code < 300:
            delivery.status = "delivered"
            delivery.delivered_at = datetime.now(timezone.utc)
            metrics.webhook_deliveries_total.labels(direction="outbound", status="delivered").inc()
        else:
            delivery.status = "retrying" if self.webhooks.should_retry(1) else "failed"
            metrics.webhook_failures_total.labels(direction="outbound").inc()
        await self.webhook_deliveries.add(delivery)
        return delivery

    async def receive_inbound(
        self, tenant_id: str, endpoint_id: str, *, event_type: str,
        payload: Dict[str, Any], signature: Optional[str], timestamp: Optional[int],
        idempotency_key: Optional[str],
    ) -> WebhookDelivery:
        endpoint = await self.webhook_endpoints.get_for_tenant(endpoint_id, tenant_id)
        if endpoint is None:
            raise ValueError("Endpoint not found")

        # Idempotency: return existing delivery if key already processed.
        if idempotency_key:
            existing = await self.webhook_deliveries.get_by_idempotency_key(tenant_id, idempotency_key)
            if existing is not None:
                return existing

        # Signature verification (if endpoint has a secret).
        if endpoint.secret_encrypted:
            if not signature or timestamp is None:
                raise ValueError("Missing signature or timestamp")
            secret = self.vault.decrypt(endpoint.secret_encrypted)
            ok, reason = verify_signature(secret, payload, signature, timestamp)
            if not ok:
                raise ValueError(f"Signature verification failed: {reason}")

        delivery = WebhookDelivery(
            tenant_id=tenant_id, endpoint_id=endpoint_id, direction="inbound",
            event_type=event_type, payload=payload, idempotency_key=idempotency_key,
            status="delivered", delivered_at=datetime.now(timezone.utc),
        )
        await self.webhook_deliveries.add(delivery)
        metrics.webhook_deliveries_total.labels(direction="inbound", status="delivered").inc()
        return delivery

    async def list_deliveries(self, tenant_id: str, endpoint_id: str) -> List[WebhookDelivery]:
        return await self.webhook_deliveries.list_for_endpoint(tenant_id, endpoint_id)

    async def retry_delivery(self, tenant_id: str, delivery_id: str) -> Optional[WebhookDelivery]:
        delivery = await self.webhook_deliveries.get_for_tenant(delivery_id, tenant_id)
        if delivery is None:
            return None
        endpoint = await self.webhook_endpoints.get_for_tenant(delivery.endpoint_id, tenant_id)
        if endpoint is None:
            return None
        delivery.attempts += 1
        secret = self.vault.decrypt(endpoint.secret_encrypted) if endpoint.secret_encrypted else None
        headers = self.webhooks.build_headers(secret, delivery.payload)
        status_code, body = await self.webhooks._deliver_http(endpoint.url or "", delivery.payload, headers)
        delivery.response_status = status_code
        delivery.response_body = body[:2000] if body else None
        if 200 <= status_code < 300:
            delivery.status = "delivered"
            delivery.delivered_at = datetime.now(timezone.utc)
            metrics.webhook_deliveries_total.labels(direction="outbound", status="delivered").inc()
        elif not self.webhooks.should_retry(delivery.attempts):
            delivery.status = "failed"
            metrics.webhook_failures_total.labels(direction="outbound").inc()
        else:
            delivery.status = "retrying"
        await self.session.flush()
        return delivery

    # ------------------------------------------------------------------
    # Health
    # ------------------------------------------------------------------
    async def check_health(self, tenant_id: str, integration_id: str) -> IntegrationHealth:
        integration = await self.get_integration(tenant_id, integration_id)
        if integration is None:
            raise ValueError("Integration not found")
        creds = await self.credentials.list_for_integration(tenant_id, integration_id)
        decrypted = {c.kind: self.vault.decrypt(c.secret_encrypted) for c in creds}
        connector = self.connector_manager.create(
            integration.connector_type, tenant_id=tenant_id,
            integration_id=integration_id, config=integration.config, credentials=decrypted,
        )
        status = await connector.health_check()
        record = IntegrationHealth(
            tenant_id=tenant_id, integration_id=integration_id, status=status.status,
            score=status.score, latency_ms=status.latency_ms, message=status.message,
            checked_at=datetime.now(timezone.utc), details=status.details,
        )
        await self.health.add(record)
        metrics.connector_health_score.labels(
            connector_id=integration_id, connector_type=integration.connector_type
        ).set(status.score / 100.0)
        return record

    async def latest_health(self, tenant_id: str, integration_id: str) -> Optional[IntegrationHealth]:
        return await self.health.latest_for_integration(tenant_id, integration_id)

    # ------------------------------------------------------------------
    # Overview / dashboard
    # ------------------------------------------------------------------
    async def overview(self, tenant_id: str) -> OverviewRead:
        counts = await self.integrations.count_by_status(tenant_id)
        since = datetime.now(timezone.utc) - timedelta(hours=24)
        sync_24h = await self.sync_jobs.count_since(tenant_id, since)
        webhook_24h = await self.webhook_deliveries.count_since(tenant_id, since)
        total = sum(counts.values())
        return OverviewRead(
            total_integrations=total,
            active=counts.get("active", 0),
            error=counts.get("error", 0),
            paused=counts.get("paused", 0),
            total_connectors=total,
            healthy_connectors=counts.get("active", 0),
            sync_jobs_24h=sync_24h,
            webhook_deliveries_24h=webhook_24h,
            supported_connector_types=self.connector_manager.registry.list_types(),
        )

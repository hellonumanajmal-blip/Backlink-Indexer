"""Repository layer for the integrations module."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.integrations.models import (
    Connector,
    ConnectorCredential,
    Integration,
    IntegrationHealth,
    SyncHistory,
    SyncJob,
    WebhookDelivery,
    WebhookEndpoint,
)
from app.repositories.base import BaseRepository


class IntegrationRepository(BaseRepository[Integration]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Integration, session)

    async def list_by_status(self, tenant_id: str, status: str) -> List[Integration]:
        stmt = select(Integration).where(
            Integration.tenant_id == tenant_id, Integration.status == status
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_by_status(self, tenant_id: str) -> dict:
        stmt = select(Integration.status, func.count()).where(
            Integration.tenant_id == tenant_id
        ).group_by(Integration.status)
        result = await self.session.execute(stmt)
        return {row[0]: row[1] for row in result.all()}


class ConnectorRepository(BaseRepository[Connector]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Connector, session)

    async def list_for_integration(
        self, tenant_id: str, integration_id: str
    ) -> List[Connector]:
        stmt = select(Connector).where(
            Connector.tenant_id == tenant_id,
            Connector.integration_id == integration_id,
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class CredentialRepository(BaseRepository[ConnectorCredential]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(ConnectorCredential, session)

    async def list_for_integration(
        self, tenant_id: str, integration_id: str
    ) -> List[ConnectorCredential]:
        stmt = select(ConnectorCredential).where(
            ConnectorCredential.tenant_id == tenant_id,
            ConnectorCredential.integration_id == integration_id,
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_expiring(self, tenant_id: str, within: timedelta) -> List[ConnectorCredential]:
        now = datetime.now(timezone.utc)
        stmt = select(ConnectorCredential).where(
            ConnectorCredential.tenant_id == tenant_id,
            ConnectorCredential.expires_at.isnot(None),
            ConnectorCredential.expires_at <= now + within,
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class SyncJobRepository(BaseRepository[SyncJob]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(SyncJob, session)

    async def list_for_integration(
        self, tenant_id: str, integration_id: str, limit: int = 50
    ) -> List[SyncJob]:
        stmt = (
            select(SyncJob)
            .where(
                SyncJob.tenant_id == tenant_id,
                SyncJob.integration_id == integration_id,
            )
            .order_by(SyncJob.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_since(self, tenant_id: str, since: datetime) -> int:
        stmt = select(func.count()).select_from(SyncJob).where(
            SyncJob.tenant_id == tenant_id, SyncJob.created_at >= since
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class SyncHistoryRepository(BaseRepository[SyncHistory]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(SyncHistory, session)


class WebhookEndpointRepository(BaseRepository[WebhookEndpoint]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(WebhookEndpoint, session)

    async def list_subscribed(
        self, tenant_id: str, event_type: str, direction: str = "outbound"
    ) -> List[WebhookEndpoint]:
        stmt = select(WebhookEndpoint).where(
            WebhookEndpoint.tenant_id == tenant_id,
            WebhookEndpoint.direction == direction,
            WebhookEndpoint.active.is_(True),
        )
        result = await self.session.execute(stmt)
        endpoints = list(result.scalars().all())
        return [e for e in endpoints if event_type in (e.event_types or [])]


class WebhookDeliveryRepository(BaseRepository[WebhookDelivery]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(WebhookDelivery, session)

    async def get_by_idempotency_key(
        self, tenant_id: str, key: str
    ) -> Optional[WebhookDelivery]:
        stmt = select(WebhookDelivery).where(
            WebhookDelivery.tenant_id == tenant_id,
            WebhookDelivery.idempotency_key == key,
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_endpoint(
        self, tenant_id: str, endpoint_id: str, limit: int = 50
    ) -> List[WebhookDelivery]:
        stmt = (
            select(WebhookDelivery)
            .where(
                WebhookDelivery.tenant_id == tenant_id,
                WebhookDelivery.endpoint_id == endpoint_id,
            )
            .order_by(WebhookDelivery.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_pending_retries(self, tenant_id: str, limit: int = 100) -> List[WebhookDelivery]:
        stmt = (
            select(WebhookDelivery)
            .where(
                WebhookDelivery.tenant_id == tenant_id,
                WebhookDelivery.status == "retrying",
            )
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def count_since(self, tenant_id: str, since: datetime) -> int:
        stmt = select(func.count()).select_from(WebhookDelivery).where(
            WebhookDelivery.tenant_id == tenant_id, WebhookDelivery.created_at >= since
        )
        result = await self.session.execute(stmt)
        return int(result.scalar_one())


class HealthRepository(BaseRepository[IntegrationHealth]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(IntegrationHealth, session)

    async def latest_for_integration(
        self, tenant_id: str, integration_id: str
    ) -> Optional[IntegrationHealth]:
        stmt = (
            select(IntegrationHealth)
            .where(
                IntegrationHealth.tenant_id == tenant_id,
                IntegrationHealth.integration_id == integration_id,
            )
            .order_by(IntegrationHealth.checked_at.desc().nullslast())
            .limit(1)
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

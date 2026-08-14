"""Async repository layer for backlink indexing persistence."""
from __future__ import annotations

from typing import List, Optional, Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.indexing.models import Backlink, PingLog
from app.repositories.base import BaseRepository


class BacklinkRepository(BaseRepository[Backlink]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(Backlink, session)

    async def get_by_hash(self, tenant_id: str, url_hash: str) -> Optional[Backlink]:
        stmt = select(Backlink).where(
            Backlink.tenant_id == tenant_id, Backlink.url_hash == url_hash
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def existing_hashes(self, tenant_id: str, hashes: Sequence[str]) -> set[str]:
        if not hashes:
            return set()
        stmt = select(Backlink.url_hash).where(
            Backlink.tenant_id == tenant_id, Backlink.url_hash.in_(list(hashes))
        )
        result = await self.session.execute(stmt)
        return set(result.scalars().all())

    async def search(
        self,
        tenant_id: str,
        *,
        query: Optional[str] = None,
        index_status: Optional[str] = None,
        dispatch_status: Optional[str] = None,
        domain: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[List[Backlink], int]:
        filters = [Backlink.tenant_id == tenant_id]
        if query:
            like = f"%{query}%"
            filters.append(Backlink.url.ilike(like) | Backlink.domain.ilike(like))
        if index_status:
            filters.append(Backlink.index_status == index_status)
        if dispatch_status:
            filters.append(Backlink.dispatch_status == dispatch_status)
        if domain:
            filters.append(Backlink.domain == domain)

        total = await self.session.scalar(
            select(func.count()).select_from(Backlink).where(*filters)
        )
        stmt = (
            select(Backlink)
            .where(*filters)
            .order_by(Backlink.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all()), int(total or 0)

    async def list_pending_dispatch(self, tenant_id: str, limit: int = 50) -> List[Backlink]:
        from app.modules.indexing.constants import DISPATCH_PENDING

        stmt = (
            select(Backlink)
            .where(
                Backlink.tenant_id == tenant_id,
                Backlink.dispatch_status == DISPATCH_PENDING,
            )
            .order_by(Backlink.created_at.asc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())


class PingLogRepository(BaseRepository[PingLog]):
    def __init__(self, session: AsyncSession) -> None:
        super().__init__(PingLog, session)

    async def list_for_backlink(
        self, tenant_id: str, backlink_id: str, limit: int = 100
    ) -> List[PingLog]:
        stmt = (
            select(PingLog)
            .where(PingLog.tenant_id == tenant_id, PingLog.backlink_id == backlink_id)
            .order_by(PingLog.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def list_recent(
        self,
        tenant_id: str,
        *,
        method: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[PingLog]:
        filters = [PingLog.tenant_id == tenant_id]
        if method:
            filters.append(PingLog.method == method)
        if status:
            filters.append(PingLog.status == status)
        stmt = (
            select(PingLog)
            .where(*filters)
            .order_by(PingLog.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

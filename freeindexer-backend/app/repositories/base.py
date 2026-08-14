"""Generic async repository base class."""
from __future__ import annotations

from typing import Any, Generic, List, Optional, Type, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.base import Base

ModelT = TypeVar("ModelT", bound=Base)


class BaseRepository(Generic[ModelT]):
    """Minimal async CRUD repository with tenant scoping helpers."""

    def __init__(self, model: Type[ModelT], session: AsyncSession) -> None:
        self.model = model
        self.session = session

    async def add(self, obj: ModelT) -> ModelT:
        self.session.add(obj)
        await self.session.flush()
        return obj

    async def get(self, id: Any) -> Optional[ModelT]:
        return await self.session.get(self.model, id)

    async def get_for_tenant(self, id: Any, tenant_id: str) -> Optional[ModelT]:
        stmt = select(self.model).where(
            self.model.id == id, self.model.tenant_id == tenant_id  # type: ignore[attr-defined]
        )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_for_tenant(
        self, tenant_id: str, limit: int = 100, offset: int = 0
    ) -> List[ModelT]:
        stmt = (
            select(self.model)
            .where(self.model.tenant_id == tenant_id)  # type: ignore[attr-defined]
            .limit(limit)
            .offset(offset)
        )
        result = await self.session.execute(stmt)
        return list(result.scalars().all())

    async def delete(self, obj: ModelT) -> None:
        await self.session.delete(obj)
        await self.session.flush()

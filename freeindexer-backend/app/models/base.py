"""Declarative base and common model mixins."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    """Project-wide declarative base."""

    def __getattr__(self, name: str):
        if name == "metadata" and hasattr(self, "metadata_payload"):
            return self.metadata_payload
        raise AttributeError(name)

    def __setattr__(self, name: str, value) -> None:
        if name == "metadata" and hasattr(self, "metadata_payload"):
            object.__setattr__(self, "metadata_payload", value)
            return
        object.__setattr__(self, name, value)


class TimestampMixin:
    """Adds created/updated timestamps."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


class UUIDPrimaryKeyMixin:
    """Adds a UUID string primary key named ``id``."""

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)


class TenantMixin:
    """Adds a tenant/organisation foreign key for multi-tenant isolation."""

    tenant_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)

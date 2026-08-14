"""Persistence models for backlink indexing dispatch."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import (
    JSON,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TenantMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.indexing.constants import DISPATCH_PENDING, INDEX_PENDING


class Backlink(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """A URL we want a search engine to discover.

    ``url_hash`` carries the uniqueness constraint rather than ``url`` itself,
    because a 2048-character column exceeds the btree index limit on Postgres
    once multibyte characters are involved.
    """

    __tablename__ = "backlinks"
    __table_args__ = (
        UniqueConstraint("tenant_id", "url_hash", name="uq_backlinks_tenant_url"),
    )

    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    url_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    domain: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    title: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    anchor_text: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    source: Mapped[str] = mapped_column(String(80), default="manual", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Editorial metadata owned by the dashboard. All nullable: the dispatch
    # pipeline never reads these, and older rows predate the columns.
    platform: Mapped[Optional[str]] = mapped_column(String(80), nullable=True, index=True)
    country: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    language: Mapped[Optional[str]] = mapped_column(String(80), nullable=True)
    rel_type: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    #: Manually entered by an operator; never fetched from a paid metrics API.
    authority_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    #: Where the search engine stands. Only ever set manually or by a verifier.
    index_status: Mapped[str] = mapped_column(
        String(32), default=INDEX_PENDING, nullable=False, index=True
    )

    #: What the dispatch pipeline last achieved for this URL.
    dispatch_status: Mapped[str] = mapped_column(
        String(32), default=DISPATCH_PENDING, nullable=False, index=True
    )
    dispatch_method: Mapped[Optional[str]] = mapped_column(String(40), nullable=True, index=True)
    dispatch_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_dispatched_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    #: Provider-side identifier: IndexBolt submissionId, Rapid URL Indexer project_id.
    external_ref: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    ping_logs: Mapped[list["PingLog"]] = relationship(
        back_populates="backlink", cascade="all, delete-orphan"
    )


class PingLog(Base, UUIDPrimaryKeyMixin, TenantMixin, TimestampMixin):
    """One row per provider call attempt, including the response code.

    ``url`` is denormalised so the audit trail survives deletion of the parent
    backlink, and ``request_payload`` stores the outbound body with secrets
    redacted so a failed submission can be diagnosed without leaking API keys.
    """

    __tablename__ = "ping_logs"

    backlink_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("backlinks.id", ondelete="CASCADE"), nullable=True, index=True
    )
    url: Mapped[str] = mapped_column(String(2048), nullable=False)
    method: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    endpoint: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    response_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    response_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    attempt: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    duration_ms: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    external_ref: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    request_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)

    backlink: Mapped[Optional[Backlink]] = relationship(back_populates="ping_logs")


__all__ = ["Backlink", "PingLog"]

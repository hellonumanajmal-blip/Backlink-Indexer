"""Pydantic DTOs for the backlink indexing dispatch API."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.modules.indexing.constants import INDEX_STATUSES


# ---------------------------------------------------------------------------
# Backlinks
# ---------------------------------------------------------------------------
class BacklinkCreate(BaseModel):
    url: str
    title: Optional[str] = None
    anchor_text: Optional[str] = None
    notes: Optional[str] = None
    source: str = "manual"
    platform: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    rel_type: Optional[str] = None
    authority_score: Optional[int] = None


class BacklinkBulkCreate(BaseModel):
    """Bulk submission: either a newline-separated blob or an explicit list."""

    urls: str | List[str]
    source: str = "bulk"
    dispatch: bool = Field(
        default=False,
        description="Dispatch each accepted URL immediately after import.",
    )


class BacklinkStatusUpdate(BaseModel):
    """Manual status edit from the dashboard dropdown."""

    index_status: str

    @field_validator("index_status")
    @classmethod
    def _known_status(cls, value: str) -> str:
        if value not in INDEX_STATUSES:
            raise ValueError(f"index_status must be one of {sorted(INDEX_STATUSES)}")
        return value


class BacklinkUpdate(BaseModel):
    """General field edit for a backlink record.

    Every field is optional; only those present in the request body are
    applied, so a partial edit never blanks out untouched columns.
    """

    title: Optional[str] = None
    url: Optional[str] = None
    #: Legacy dashboard alias for ``notes``.
    description: Optional[str] = None
    platform: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    anchor_text: Optional[str] = None
    rel_type: Optional[str] = None
    authority_score: Optional[int] = None
    notes: Optional[str] = None
    source: Optional[str] = None


class BacklinkRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    url: str
    domain: str
    title: Optional[str] = None
    anchor_text: Optional[str] = None
    source: str
    notes: Optional[str] = None
    platform: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    rel_type: Optional[str] = None
    authority_score: Optional[int] = None
    index_status: str
    dispatch_status: str
    dispatch_method: Optional[str] = None
    dispatch_attempts: int
    last_dispatched_at: Optional[datetime] = None
    last_error: Optional[str] = None
    external_ref: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class BacklinkListRead(BaseModel):
    items: List[BacklinkRead]
    total: int
    limit: int
    offset: int


class PublicBacklinkRead(BaseModel):
    """Public projection of a backlink, safe to serve without authentication.

    Only the fields meant for a public "featured on" page are declared, so
    ``model_validate`` on an ORM row can never leak internal columns
    (``dispatch_status``, ``notes``, ``tenant_id``, ping-log data, IDs, etc.):
    Pydantic reads only the attributes named here.
    """

    model_config = ConfigDict(from_attributes=True)

    url: str
    title: Optional[str] = None
    platform: Optional[str] = None
    domain: str


class PublicBacklinkListRead(BaseModel):
    items: List[PublicBacklinkRead]
    total: int


class BulkImportResult(BaseModel):
    created: int
    skipped_duplicates: int
    invalid: List[str] = Field(default_factory=list)
    backlink_ids: List[str] = Field(default_factory=list)


class CsvImportResult(BaseModel):
    """Summary of a CSV upload. ``errors`` lists per-row failures (e.g.
    ``"Row 4: invalid URL 'foo'"``) so the user can see which rows failed."""

    created: int
    skipped_duplicates: int
    errors: List[str] = Field(default_factory=list)
    backlink_ids: List[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Ping logs
# ---------------------------------------------------------------------------
class PingLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    backlink_id: Optional[str] = None
    url: str
    method: str
    endpoint: Optional[str] = None
    status: str
    response_code: Optional[int] = None
    response_body: Optional[str] = None
    error: Optional[str] = None
    attempt: int
    duration_ms: int
    external_ref: Optional[str] = None
    request_payload: Dict[str, Any]
    created_at: datetime


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
class DispatchAttemptRead(BaseModel):
    method: str
    status: str
    response_code: Optional[int] = None
    error: Optional[str] = None
    external_ref: Optional[str] = None
    duration_ms: int


class DispatchRead(BaseModel):
    backlink_id: str
    url: str
    dispatch_status: str
    dispatch_method: Optional[str] = None
    #: Dashboard string, e.g. "submitted via IndexBolt".
    summary: str
    attempts: List[DispatchAttemptRead]


class BatchDispatchRead(BaseModel):
    dispatched: int
    submitted: int
    failed: int
    skipped: int
    results: List[DispatchRead]


class ProviderStatusRead(BaseModel):
    method: str
    label: str
    configured: bool
    enabled: bool
    endpoint: str
    detail: Optional[str] = None

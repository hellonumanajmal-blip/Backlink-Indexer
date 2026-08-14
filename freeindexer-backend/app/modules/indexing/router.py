"""API router for backlink indexing dispatch."""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import Principal
from app.database import get_db
from app.modules.indexing.constants import (
    DISPATCH_FAILED,
    DISPATCH_SKIPPED,
    DISPATCH_SUBMITTED,
)
from app.modules.indexing.dtos import (
    BacklinkBulkCreate,
    BacklinkCreate,
    BacklinkListRead,
    BacklinkRead,
    BacklinkStatusUpdate,
    BacklinkUpdate,
    BatchDispatchRead,
    BulkImportResult,
    CsvImportResult,
    DispatchAttemptRead,
    DispatchRead,
    PingLogRead,
    ProviderStatusRead,
)
from app.modules.indexing.indexer_dispatch import (
    DispatchOutcome,
    IndexerDispatchService,
    normalise_url,
    url_fingerprint,
)
from app.modules.indexing.providers import host_of
from app.rbac import require_permission

router = APIRouter(prefix="/indexing", tags=["indexing"])


def _service(db: AsyncSession = Depends(get_db)) -> IndexerDispatchService:
    return IndexerDispatchService(db)


def _to_dispatch_read(outcome: DispatchOutcome) -> DispatchRead:
    return DispatchRead(
        backlink_id=outcome.backlink_id,
        url=outcome.url,
        dispatch_status=outcome.dispatch_status,
        dispatch_method=outcome.dispatch_method,
        summary=outcome.summary,
        attempts=[
            DispatchAttemptRead(
                method=a.method,
                status=a.status,
                response_code=a.response_code,
                error=a.error,
                external_ref=a.external_ref,
                duration_ms=a.duration_ms,
            )
            for a in outcome.attempts
        ],
    )


# ---------------------------------------------------------------------------
# Backlinks
# ---------------------------------------------------------------------------
@router.get("/backlinks", response_model=BacklinkListRead)
async def list_backlinks(
    principal: Principal = Depends(require_permission("indexing:read")),
    svc: IndexerDispatchService = Depends(_service),
    q: Optional[str] = Query(default=None, description="Match against URL or domain"),
    index_status: Optional[str] = None,
    dispatch_status: Optional[str] = None,
    domain: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> BacklinkListRead:
    items, total = await svc.list_backlinks(
        principal.tenant_id,
        query=q,
        index_status=index_status,
        dispatch_status=dispatch_status,
        domain=domain,
        limit=limit,
        offset=offset,
    )
    return BacklinkListRead(
        items=[BacklinkRead.model_validate(i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post("/backlinks", response_model=BacklinkRead, status_code=status.HTTP_201_CREATED)
async def create_backlink(
    body: BacklinkCreate,
    principal: Principal = Depends(require_permission("indexing:write")),
    svc: IndexerDispatchService = Depends(_service),
) -> BacklinkRead:
    backlink = await svc.create_backlink(
        principal.tenant_id,
        url=body.url,
        title=body.title,
        anchor_text=body.anchor_text,
        notes=body.notes,
        source=body.source,
        platform=body.platform,
        country=body.country,
        language=body.language,
        rel_type=body.rel_type,
        authority_score=body.authority_score,
    )
    if backlink is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="URL must be a valid absolute http(s) address",
        )
    return BacklinkRead.model_validate(backlink)


@router.post(
    "/backlinks/bulk",
    response_model=BulkImportResult,
    status_code=status.HTTP_201_CREATED,
)
async def bulk_import_backlinks(
    body: BacklinkBulkCreate,
    principal: Principal = Depends(require_permission("indexing:write")),
    svc: IndexerDispatchService = Depends(_service),
) -> BulkImportResult:
    outcome = await svc.bulk_import(principal.tenant_id, body.urls, source=body.source)
    if body.dispatch and outcome.created:
        await svc.dispatch_many(principal.tenant_id, outcome.created)
    return BulkImportResult(
        created=len(outcome.created),
        skipped_duplicates=outcome.skipped_duplicates,
        invalid=outcome.invalid,
        backlink_ids=[b.id for b in outcome.created],
    )


@router.post(
    "/backlinks/import-csv",
    response_model=CsvImportResult,
    status_code=status.HTTP_201_CREATED,
)
async def import_backlinks_csv(
    file: UploadFile = File(...),
    dispatch: bool = Query(default=True, description="Dispatch created rows after import."),
    principal: Principal = Depends(require_permission("indexing:write")),
    svc: IndexerDispatchService = Depends(_service),
) -> CsvImportResult:
    """Import backlinks from an uploaded CSV (requires a ``url`` column).

    Reuses the same insertion + free-signal dispatch path as the textarea bulk
    import; invalid rows are skipped and reported rather than failing the import.
    """
    raw = await file.read()
    try:
        outcome = await svc.import_csv(
            principal.tenant_id, raw, source="csv", dispatch=dispatch
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return CsvImportResult(
        created=len(outcome.created),
        skipped_duplicates=outcome.skipped_duplicates,
        errors=outcome.invalid,
        backlink_ids=[b.id for b in outcome.created],
    )


@router.get("/backlinks/{backlink_id}", response_model=BacklinkRead)
async def get_backlink(
    backlink_id: str,
    principal: Principal = Depends(require_permission("indexing:read")),
    svc: IndexerDispatchService = Depends(_service),
) -> BacklinkRead:
    backlink = await svc.get_backlink(principal.tenant_id, backlink_id)
    if backlink is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backlink not found")
    return BacklinkRead.model_validate(backlink)


@router.patch("/backlinks/{backlink_id}/status", response_model=BacklinkRead)
async def update_index_status(
    backlink_id: str,
    body: BacklinkStatusUpdate,
    principal: Principal = Depends(require_permission("indexing:write")),
    svc: IndexerDispatchService = Depends(_service),
) -> BacklinkRead:
    backlink = await svc.set_index_status(
        principal.tenant_id, backlink_id, body.index_status
    )
    if backlink is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backlink not found")
    return BacklinkRead.model_validate(backlink)


@router.put("/backlinks/{backlink_id}", response_model=BacklinkRead)
@router.patch("/backlinks/{backlink_id}", response_model=BacklinkRead)
async def update_backlink(
    backlink_id: str,
    body: BacklinkUpdate,
    principal: Principal = Depends(require_permission("indexing:write")),
    svc: IndexerDispatchService = Depends(_service),
) -> BacklinkRead:
    backlink = await svc.get_backlink(principal.tenant_id, backlink_id)
    if backlink is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backlink not found")

    if body.url is not None and body.url != backlink.url:
        normalised = normalise_url(body.url)
        if normalised is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL must be a valid absolute http(s) address",
            )
        fingerprint = url_fingerprint(normalised)
        existing = await svc.backlinks.get_by_hash(principal.tenant_id, fingerprint)
        if existing and existing.id != backlink_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Backlink with this URL already exists",
            )
        backlink.url = normalised
        backlink.url_hash = fingerprint
        backlink.domain = host_of(normalised)

    if body.title is not None:
        backlink.title = body.title
    if body.anchor_text is not None:
        backlink.anchor_text = body.anchor_text
    if body.notes is not None:
        backlink.notes = body.notes
    elif body.description is not None:
        backlink.notes = body.description
    if body.source is not None:
        backlink.source = body.source

    if body.platform is not None:
        backlink.platform = body.platform
    if body.country is not None:
        backlink.country = body.country
    if body.language is not None:
        backlink.language = body.language
    if body.rel_type is not None:
        backlink.rel_type = body.rel_type
    if body.authority_score is not None:
        backlink.authority_score = body.authority_score

    await svc.session.flush()
    return BacklinkRead.model_validate(backlink)


@router.delete("/backlinks/{backlink_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_backlink(
    backlink_id: str,
    principal: Principal = Depends(require_permission("indexing:write")),
    svc: IndexerDispatchService = Depends(_service),
) -> None:
    backlink = await svc.get_backlink(principal.tenant_id, backlink_id)
    if backlink is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backlink not found")
    await svc.backlinks.delete(backlink)


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
@router.post("/backlinks/{backlink_id}/dispatch", response_model=DispatchRead)
async def dispatch_backlink(
    backlink_id: str,
    principal: Principal = Depends(require_permission("indexing:write")),
    svc: IndexerDispatchService = Depends(_service),
) -> DispatchRead:
    """Re-ping a single URL through the channel chain."""
    backlink = await svc.get_backlink(principal.tenant_id, backlink_id)
    if backlink is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backlink not found")
    outcome = await svc.dispatch_backlink(principal.tenant_id, backlink)
    return _to_dispatch_read(outcome)


@router.post("/dispatch/pending", response_model=BatchDispatchRead)
async def dispatch_pending(
    principal: Principal = Depends(require_permission("indexing:write")),
    svc: IndexerDispatchService = Depends(_service),
    limit: Optional[int] = Query(default=None, ge=1, le=500),
) -> BatchDispatchRead:
    outcomes = await svc.dispatch_pending(principal.tenant_id, limit=limit)
    return BatchDispatchRead(
        dispatched=len(outcomes),
        submitted=sum(1 for o in outcomes if o.dispatch_status == DISPATCH_SUBMITTED),
        failed=sum(1 for o in outcomes if o.dispatch_status == DISPATCH_FAILED),
        skipped=sum(1 for o in outcomes if o.dispatch_status == DISPATCH_SKIPPED),
        results=[_to_dispatch_read(o) for o in outcomes],
    )


# ---------------------------------------------------------------------------
# Ping logs and providers
# ---------------------------------------------------------------------------
@router.get("/backlinks/{backlink_id}/logs", response_model=List[PingLogRead])
async def backlink_ping_logs(
    backlink_id: str,
    principal: Principal = Depends(require_permission("indexing:read")),
    svc: IndexerDispatchService = Depends(_service),
    limit: int = Query(default=100, ge=1, le=500),
) -> List[PingLogRead]:
    logs = await svc.logs_for_backlink(principal.tenant_id, backlink_id, limit=limit)
    return [PingLogRead.model_validate(log) for log in logs]


@router.get("/logs", response_model=List[PingLogRead])
async def recent_ping_logs(
    principal: Principal = Depends(require_permission("indexing:read")),
    svc: IndexerDispatchService = Depends(_service),
    method: Optional[str] = None,
    log_status: Optional[str] = Query(default=None, alias="status"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> List[PingLogRead]:
    logs = await svc.recent_logs(
        principal.tenant_id,
        method=method,
        status=log_status,
        limit=limit,
        offset=offset,
    )
    return [PingLogRead.model_validate(log) for log in logs]


@router.get("/providers", response_model=List[ProviderStatusRead])
async def provider_statuses(
    principal: Principal = Depends(require_permission("indexing:read")),
    svc: IndexerDispatchService = Depends(_service),
) -> List[ProviderStatusRead]:
    return [ProviderStatusRead(**s) for s in svc.provider_statuses()]

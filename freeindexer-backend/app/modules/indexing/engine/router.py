"""API for the free self-hosted indexing engine."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.auth import Principal
from app.database import get_db
from app.modules.indexing.engine.dtos import (
    BulkJobResult,
    DashboardRead,
    EngineBulkSubmit,
    EngineSubmit,
    ExperimentEnroll,
    IntelligenceRead,
    JobDetailRead,
    JobListRead,
    JobRead,
    ManualVerificationBody,
    MaxDiscoveryBatchResult,
    MaxDiscoveryRun,
    MetricsRead,
    TimelineEventRead,
)
from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.modules.indexing.engine.reports import build_report, report_csv, report_json
from app.modules.indexing.indexer_dispatch import normalise_url, url_fingerprint
from app.rbac import require_permission

router = APIRouter(prefix="/indexing/engine", tags=["indexing-engine"])


def _engine(db: AsyncSession = Depends(get_db)) -> IndexingEngine:
    return IndexingEngine(db)


def _orm(obj) -> Dict[str, Any]:
    data = {c.key: getattr(obj, c.key) for c in obj.__table__.columns}
    return data


def _job_read(job) -> JobRead:
    from app.modules.indexing.engine.states import final_status_for

    data = JobRead.model_validate(job)
    return data.model_copy(
        update={
            "max_discovery": bool(getattr(settings, "max_discovery_mode", False)),
            "final_status": final_status_for(job),
        }
    )


@router.post("/jobs", response_model=JobRead, status_code=status.HTTP_201_CREATED)
async def submit_job(
    body: EngineSubmit,
    principal: Principal = Depends(require_permission("indexing:write")),
    engine: IndexingEngine = Depends(_engine),
) -> JobRead:
    job = await engine.submit(
        principal.tenant_id,
        body.source_url,
        target_url=body.target_url,
        project=body.project,
        run=body.run,
    )
    return _job_read(job)


@router.post("/jobs/bulk", response_model=BulkJobResult, status_code=status.HTTP_201_CREATED)
async def submit_jobs(
    body: EngineBulkSubmit,
    principal: Principal = Depends(require_permission("indexing:write")),
    engine: IndexingEngine = Depends(_engine),
) -> BulkJobResult:
    created = 0
    reused = 0
    jobs = []
    for url in body.urls:
        fingerprint = url_fingerprint(normalise_url(url) or url)
        existing = await engine.jobs.get_by_hash(principal.tenant_id, fingerprint)
        job = await engine.submit(
            principal.tenant_id,
            url,
            target_url=body.target_url,
            project=body.project,
            run=body.run,
        )
        if existing and existing.id == job.id:
            reused += 1
        else:
            created += 1
        jobs.append(job)
    return BulkJobResult(
        created=created,
        reused=reused,
        jobs=[_job_read(j) for j in jobs],
    )


@router.get("/jobs", response_model=JobListRead)
async def list_jobs(
    principal: Principal = Depends(require_permission("indexing:read")),
    engine: IndexingEngine = Depends(_engine),
    project: Optional[str] = None,
    pipeline_status: Optional[str] = None,
    visibility_status: Optional[str] = None,
    property_type: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
) -> JobListRead:
    items, total = await engine.jobs.list_jobs(
        principal.tenant_id,
        project=project,
        pipeline_status=pipeline_status,
        visibility_status=visibility_status,
        property_type=property_type,
        limit=limit,
        offset=offset,
    )
    return JobListRead(
        items=[_job_read(i) for i in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/jobs/{job_id}", response_model=JobDetailRead)
async def get_job(
    job_id: str,
    principal: Principal = Depends(require_permission("indexing:read")),
    engine: IndexingEngine = Depends(_engine),
) -> JobDetailRead:
    detail = await engine.job_detail(principal.tenant_id, job_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Indexing job not found")
    job = detail["job"]
    return JobDetailRead(
        job=_job_read(job),
        timeline=[TimelineEventRead.model_validate(e) for e in detail["timeline"]],
        site_search_url=detail["site_search_url"],
        validations=[_orm(x) for x in detail["bundles"]["validations"]],
        inspections=[_orm(x) for x in detail["bundles"]["inspections"]],
        crawlability=[_orm(x) for x in detail["bundles"]["crawlability"]],
        discovery=[_orm(x) for x in detail["bundles"]["discovery"]],
        verification=[_orm(x) for x in detail["bundles"]["verification"]],
        crawl_evidence=[_orm(x) for x in detail["bundles"].get("crawl_evidence") or []],
        channel_cards=getattr(job, "channel_snapshot", None) or {},
    )


@router.get("/jobs/{job_id}/timeline", response_model=List[TimelineEventRead])
async def job_timeline(
    job_id: str,
    principal: Principal = Depends(require_permission("indexing:read")),
    engine: IndexingEngine = Depends(_engine),
) -> List[TimelineEventRead]:
    detail = await engine.job_detail(principal.tenant_id, job_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Indexing job not found")
    return [TimelineEventRead.model_validate(e) for e in detail["timeline"]]


@router.post("/jobs/{job_id}/run", response_model=JobRead)
async def run_job(
    job_id: str,
    principal: Principal = Depends(require_permission("indexing:write")),
    engine: IndexingEngine = Depends(_engine),
) -> JobRead:
    job = await engine.jobs.get_for_tenant(job_id, principal.tenant_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Indexing job not found")
    job = await engine.run_job(job)
    return _job_read(job)


@router.post("/jobs/{job_id}/verify", response_model=JobRead)
async def verify_job(
    job_id: str,
    principal: Principal = Depends(require_permission("indexing:write")),
    engine: IndexingEngine = Depends(_engine),
) -> JobRead:
    job = await engine.jobs.get_for_tenant(job_id, principal.tenant_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Indexing job not found")
    from app.modules.indexing.engine.states import PipelineStatus, can_transition

    if can_transition(PipelineStatus(job.pipeline_status), PipelineStatus.VERIFICATION_PENDING):
        from app.modules.indexing.engine.repository import transition

        await transition(
            engine.session,
            job,
            PipelineStatus.VERIFICATION_PENDING,
            note="Manual verification run requested",
        )
    await engine._verify(job)
    return _job_read(job)


@router.post("/jobs/{job_id}/manual-verification", response_model=JobRead)
async def manual_verification(
    job_id: str,
    body: ManualVerificationBody,
    principal: Principal = Depends(require_permission("indexing:write")),
    engine: IndexingEngine = Depends(_engine),
) -> JobRead:
    job = await engine.jobs.get_for_tenant(job_id, principal.tenant_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Indexing job not found")
    try:
        await engine.record_manual_verification(
            job,
            status=body.status,
            evidence=body.evidence,
            confidence=body.confidence,
            googlebot_visited=body.googlebot_visited,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _job_read(job)


@router.get("/dashboard", response_model=DashboardRead)
async def dashboard(
    principal: Principal = Depends(require_permission("indexing:read")),
    engine: IndexingEngine = Depends(_engine),
) -> DashboardRead:
    counts = await engine.jobs.counts(principal.tenant_id)
    return DashboardRead(
        **counts,
        max_discovery_mode=bool(getattr(settings, "max_discovery_mode", False)),
    )


@router.get("/metrics", response_model=MetricsRead)
async def metrics(
    principal: Principal = Depends(require_permission("indexing:read")),
    engine: IndexingEngine = Depends(_engine),
) -> MetricsRead:
    data = await engine.jobs.metrics(principal.tenant_id)
    from app.modules.indexing.engine.domain_intel import historical_insights

    intel = await historical_insights(engine.session, principal.tenant_id)
    data["average_indexing_days"] = intel.get("average_indexing_days")
    data["best_performing_domains"] = intel.get("best_performing_domains") or []
    data["insights"] = intel.get("insights") or []
    return MetricsRead(**data)


@router.get("/intelligence", response_model=IntelligenceRead)
async def intelligence(
    principal: Principal = Depends(require_permission("indexing:read")),
    engine: IndexingEngine = Depends(_engine),
) -> IntelligenceRead:
    from app.modules.indexing.engine.domain_intel import historical_insights

    return IntelligenceRead(**await historical_insights(engine.session, principal.tenant_id))


@router.post("/max-discovery/run", response_model=MaxDiscoveryBatchResult)
async def run_max_discovery(
    body: MaxDiscoveryRun,
    principal: Principal = Depends(require_permission("indexing:write")),
    engine: IndexingEngine = Depends(_engine),
) -> MaxDiscoveryBatchResult:
    """Process existing backlink rows through every legitimate discovery channel."""
    jobs, stored = await engine.submit_existing_backlinks(
        principal.tenant_id,
        target_url=body.target_url,
        run=body.run,
        limit=min(body.limit, 40),
    )
    eligible = 0
    rejected = 0
    published = 0
    websub = 0
    waiting = 0
    indexed = 0
    unknown = 0
    failed = 0
    from app.modules.indexing.engine.states import PipelineStatus, VisibilityStatus

    for job in jobs:
        snap = job.channel_snapshot or {}
        vis = job.visibility_status
        pipe = job.pipeline_status
        if vis == VisibilityStatus.INDEXED.value or pipe == PipelineStatus.INDEXED.value:
            indexed += 1
        elif vis == VisibilityStatus.UNKNOWN.value:
            unknown += 1
        if pipe in {
            PipelineStatus.INVALID_URL.value,
            PipelineStatus.URL_UNREACHABLE.value,
            PipelineStatus.BACKLINK_NOT_FOUND.value,
            PipelineStatus.BACKLINK_REMOVED.value,
            PipelineStatus.ROBOTS_BLOCKED.value,
            PipelineStatus.NOINDEX.value,
            PipelineStatus.DISCOVERY_FAILED.value,
        }:
            rejected += 1
            failed += 1
        else:
            eligible += 1
        if job.public_listed or (snap.get("public_hub") or {}).get("accepted"):
            published += 1
        if (snap.get("websub") or {}).get("accepted") or (snap.get("websub") or {}).get("status") == "WEBSUB_ACCEPTED":
            websub += 1
        if pipe in {
            PipelineStatus.WAITING_FOR_CRAWL.value,
            PipelineStatus.RETRY_PENDING.value,
            PipelineStatus.VERIFICATION_PENDING.value,
        }:
            waiting += 1
    celery_info: Dict[str, Any] = {"broker": "unchecked"}
    try:
        from app.workers.celery_app import celery_app

        inspect = celery_app.control.inspect(timeout=1.0)
        ping = inspect.ping() if inspect is not None else None
        celery_info = {
            "workers": list((ping or {}).keys()),
            "active": bool(ping),
            "note": (
                "Pipeline ran in-process. Celery retries are scheduled in the job rows "
                "even when workers are offline."
                if not ping
                else "Celery workers responded. Retry beat still required for T+6h cadence."
            ),
        }
    except Exception as exc:
        celery_info = {
            "workers": [],
            "active": False,
            "error": str(exc),
            "note": "Celery broker unreachable. Jobs were processed in-process, not queued.",
        }
    return MaxDiscoveryBatchResult(
        submitted=len(jobs),
        eligible=eligible,
        rejected=rejected,
        discovery_published=published,
        websub_accepted=websub,
        waiting=waiting,
        verified_indexed=indexed,
        unknown=unknown,
        failed=failed,
        max_discovery_mode=bool(getattr(settings, "max_discovery_mode", False)),
        celery=celery_info,
        jobs=[_job_read(j) for j in jobs],
        note=(
            f"Existing backlink rows in this tenant: {stored}. "
            "No new backlinks were created. WEBSUB_ACCEPTED is not INDEXED."
        ),
    )


@router.post("/experiment/enroll", response_model=BulkJobResult, status_code=status.HTTP_201_CREATED)
async def enroll_experiment(
    body: ExperimentEnroll,
    principal: Principal = Depends(require_permission("indexing:write")),
    engine: IndexingEngine = Depends(_engine),
) -> BulkJobResult:
    """Enroll existing third-party URLs. Does not create backlinks or spam farms."""
    urls = [u.strip() for u in body.urls if (u or "").strip()]
    if not urls:
        raise HTTPException(status_code=400, detail="Provide at least one source URL")
    if len(urls) > 40:
        raise HTTPException(status_code=400, detail="Enroll at most 40 URLs per request (rate limits)")
    if not body.target_url:
        raise HTTPException(status_code=400, detail="target_url is required")
    created = 0
    reused = 0
    jobs = []
    for url in urls:
        fingerprint = url_fingerprint(normalise_url(url) or url)
        existing = await engine.jobs.get_by_hash(principal.tenant_id, fingerprint)
        job = await engine.submit(
            principal.tenant_id,
            url,
            target_url=body.target_url,
            project="indexing-experiment",
            run=body.run,
        )
        if existing and existing.id == job.id:
            reused += 1
        else:
            created += 1
        jobs.append(job)
    return BulkJobResult(
        created=created,
        reused=reused,
        jobs=[_job_read(j) for j in jobs],
    )


@router.get("/experiment")
async def experiment_dashboard(
    principal: Principal = Depends(require_permission("indexing:read")),
    engine: IndexingEngine = Depends(_engine),
) -> dict:
    from app.modules.indexing.engine.experiment_stats import build_experiment_report

    jobs, _ = await engine.jobs.list_jobs(principal.tenant_id, limit=10_000, offset=0)
    return build_experiment_report(jobs)


@router.get("/experiment/export.json")
async def experiment_export_json(
    principal: Principal = Depends(require_permission("indexing:read")),
    engine: IndexingEngine = Depends(_engine),
) -> Response:
    from app.modules.indexing.engine.experiment_stats import export_rows
    import json

    jobs, _ = await engine.jobs.list_jobs(principal.tenant_id, limit=10_000, offset=0)
    body = json.dumps({"items": export_rows(jobs)}, default=str)
    return Response(content=body, media_type="application/json")


@router.get("/experiment/export.csv")
async def experiment_export_csv(
    principal: Principal = Depends(require_permission("indexing:read")),
    engine: IndexingEngine = Depends(_engine),
) -> Response:
    from app.modules.indexing.engine.experiment_stats import export_csv

    jobs, _ = await engine.jobs.list_jobs(principal.tenant_id, limit=10_000, offset=0)
    return Response(
        content=export_csv(jobs),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=indexing-experiment.csv"},
    )


@router.get("/reports")
async def project_report(
    principal: Principal = Depends(require_permission("indexing:read")),
    db: AsyncSession = Depends(get_db),
    project: Optional[str] = None,
    fmt: str = Query(default="json", alias="format"),
) -> Response:
    report = await build_report(db, principal.tenant_id, project=project)
    if fmt == "csv":
        return Response(
            content=report_csv(report),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=indexing-engine-report.csv"},
        )
    return Response(content=report_json(report), media_type="application/json")

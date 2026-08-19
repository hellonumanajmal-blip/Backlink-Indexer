"""Orchestrates the free indexing pipeline for one job.

Never sets INDEXED from HTTP 200, our crawler visit, or a discovery POST.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import List, Optional, Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.indexing.engine.backlink_checker import inspect_html
from app.modules.indexing.engine.backlink_quality import (
    BacklinkQualityEngine,
    QualityInput,
    source_domain,
)
from app.modules.indexing.engine.domain_intel import (
    domain_boost,
    record_verified_index,
    touch_submission,
)
from app.modules.indexing.engine.scheduler import (
    DiscoveryScheduler,
    experiment_verify_action,
    next_after_success,
    retry_action_for_job,
)
from app.modules.indexing.engine.experiment_stats import (
    experiment_channel_names,
    quality_band,
    rel_type_from_rel,
)
from app.modules.indexing.engine.channels import (
    ChannelOutcome,
    DiscoveryChannel,
    GscFeedSitemapChannel,
    ProviderBackedChannel,
    build_free_channels,
)
from app.modules.indexing.engine.crawlability import analyse_crawlability
from app.modules.indexing.engine.discovery_providers import wrap_channels
from app.modules.indexing.engine.feeds import (
    inventory_contains,
    render_rss,
)
from app.modules.indexing.engine.http_probe import CLASS_SSRF, OUR_CRAWLER_UA, probe_url
from app.modules.indexing.engine.js_backlink import inspect_js_backlink
from app.modules.indexing.engine.quality import (
    assign_experiment_group,
    compute_discovery_score,
    looks_like_spam,
    project_is_private,
)
from app.modules.indexing.engine.models import (
    BacklinkInspection,
    CrawlabilityReport,
    CrawlEvidence,
    DiscoveryAttempt,
    IndexingJob,
    UrlValidation,
    VerificationAttempt,
)
from app.modules.indexing.engine.priority import PriorityInput, compute_priority
from app.modules.indexing.engine.repository import (
    IndexingJobRepository,
    add_crawl_evidence,
    add_crawlability,
    add_discovery,
    add_inspection,
    add_validation,
    add_verification,
    append_history,
    history_bundles,
    list_feed_items,
    timeline,
    transition,
)
from app.modules.indexing.engine.retry_schedule import (
    MAX_DISCOVERY_ATTEMPTS,
    is_timed_out,
    next_retry_at,
    should_retry,
)
from app.modules.indexing.engine.states import (
    ChannelResultStatus,
    CrawlEvidenceType,
    DiscoveryStage,
    PipelineStatus,
    PropertyType,
    VisibilityStatus,
    can_transition,
    workflow_stage_for,
)
from app.modules.indexing.engine.url_validator import validate_url
from app.modules.indexing.engine.verification import (
    CrawlerEvidenceStrategy,
    CustomSearchStrategy,
    IndexVerificationService,
    ManualVerificationStrategy,
    SearchConsoleStrategy,
    VerificationResult,
    site_search_url,
)
from app.modules.indexing.indexer_dispatch import (
    IndexerDispatchService,
    normalise_url,
    url_fingerprint,
)
from app.modules.indexing.providers import build_providers, is_owned


class IndexingEngine:
    def __init__(
        self,
        session: AsyncSession,
        *,
        channels: Optional[Sequence[DiscoveryChannel]] = None,
        verifier: Optional[IndexVerificationService] = None,
        transport: Optional[object] = None,
        dispatch: Optional[IndexerDispatchService] = None,
    ) -> None:
        self.session = session
        self.jobs = IndexingJobRepository(session)
        self.dispatch = dispatch or IndexerDispatchService(session)
        self._channels = list(channels) if channels is not None else None
        self.verifier = verifier or default_verifier()
        self.transport = transport
        self.quality = BacklinkQualityEngine()
        self.scheduler = DiscoveryScheduler()

    async def submit(
        self,
        tenant_id: str,
        source_url: str,
        *,
        target_url: Optional[str] = None,
        project: Optional[str] = None,
        backlink_id: Optional[str] = None,
        run: bool = True,
    ) -> IndexingJob:
        normalised = normalise_url(source_url) or (source_url or "").strip()
        fingerprint = url_fingerprint(normalised)
        existing = await self.jobs.get_by_hash(tenant_id, fingerprint)
        if existing:
            return existing

        owned = is_owned(normalised)
        if backlink_id is None:
            backlink = await self.dispatch.create_backlink(
                tenant_id, url=normalised, source="engine"
            )
            if backlink is not None:
                backlink_id = backlink.id
        job = IndexingJob(
            tenant_id=tenant_id,
            backlink_id=backlink_id,
            project=project,
            source_url=normalised,
            source_url_hash=fingerprint,
            target_url=normalise_url(target_url) if target_url else None,
            property_type=(
                PropertyType.OWNED_PROPERTY.value
                if owned
                else PropertyType.THIRD_PARTY_BACKLINK.value
            ),
            pipeline_status=PipelineStatus.RECEIVED.value,
            visibility_status=VisibilityStatus.UNKNOWN.value,
            submitted_at=datetime.now(timezone.utc),
            channel_snapshot={},
            experiment_group=assign_experiment_group(fingerprint),
            experiment_assigned_at=datetime.now(timezone.utc),
            public_listed=False,
            source_domain=source_domain(normalised),
            workflow_stage="SUBMITTED",
        )
        await self.jobs.add(job)
        await touch_submission(self.session, tenant_id, normalised)
        await append_history(
            self.session,
            job,
            from_status=None,
            to_status=PipelineStatus.RECEIVED.value,
            note="URL submitted to the free indexing engine",
        )
        if run:
            await self.run_job(job)
        return job

    async def run_job(self, job: IndexingJob) -> IndexingJob:
        if is_timed_out(job.submitted_at):
            if job.pipeline_status != PipelineStatus.INDEXED.value:
                await self._fail(job, PipelineStatus.TIMEOUT, "Job exceeded the 14-day window")
            return job

        status = PipelineStatus(job.pipeline_status)
        if status == PipelineStatus.RECEIVED:
            await transition(self.session, job, PipelineStatus.VALIDATING, note="Starting URL validation")
            status = PipelineStatus.VALIDATING
        if status == PipelineStatus.VALIDATING:
            status = await self._validate(job)
        if status == PipelineStatus.VALIDATED:
            if job.target_url:
                await transition(self.session, job, PipelineStatus.BACKLINK_CHECK, note="Checking source page for target href")
                status = await self._backlink(job)
            else:
                await transition(
                    self.session,
                    job,
                    PipelineStatus.CRAWLABILITY_CHECK,
                    note="No target URL supplied — skipping backlink inspection",
                )
                status = await self._crawlability(job)
        if status == PipelineStatus.BACKLINK_VERIFIED:
            await transition(self.session, job, PipelineStatus.CRAWLABILITY_CHECK, note="Analysing crawlability")
            status = await self._crawlability(job)
        if status == PipelineStatus.CRAWLABILITY_CHECK:
            # _crawlability already advanced
            status = PipelineStatus(job.pipeline_status)
        if status == PipelineStatus.DISCOVERY_QUEUED:
            if not job.baseline_status:
                status = await self._baseline(job)
            if status == PipelineStatus.DISCOVERY_QUEUED:
                status = await self._discover(job)
        if status == PipelineStatus.DISCOVERY_SUBMITTED:
            await transition(
                self.session,
                job,
                PipelineStatus.WAITING_FOR_CRAWL,
                note=(
                    "Discovery accepted. Waiting for Google to crawl — we do not fabricate "
                    "bot visits. Hub listing ≠ TARGET_URL_DISCOVERED."
                ),
            )
            status = PipelineStatus.WAITING_FOR_CRAWL
        if status == PipelineStatus.WAITING_FOR_CRAWL:
            if job.experiment_started_at and (job.experiment_checkpoint or "T+0") == "T+0":
                nxt = experiment_verify_action(job)
                job.next_retry_at = nxt.next_at
                await transition(
                    self.session,
                    job,
                    PipelineStatus.RETRY_PENDING,
                    note=f"T+0 baseline recorded. Next verification {nxt.name}. Not indexed.",
                )
                job.workflow_stage = workflow_stage_for(job)
                await self.session.flush()
                return job
            await transition(
                self.session,
                job,
                PipelineStatus.VERIFICATION_PENDING,
                note="Running index verification (never inferred from HTTP 200)",
            )
            status = await self._verify(job)
        if status == PipelineStatus.VERIFICATION_PENDING:
            status = await self._verify(job)
        if status == PipelineStatus.RETRY_PENDING:
            return job
        job.workflow_stage = workflow_stage_for(job)
        await self.session.flush()
        return job

    async def run_due_retries(self, limit: int = 50) -> List[IndexingJob]:
        due = await self.jobs.due_retries(limit=limit)
        ran: List[IndexingJob] = []
        for job in due:
            if job.pipeline_status == PipelineStatus.BACKLINK_REMOVED.value:
                stopped = await self._revalidate_before_retry(job)
                if stopped:
                    ran.append(job)
                    continue
                await transition(
                    self.session,
                    job,
                    PipelineStatus.DISCOVERY_QUEUED,
                    note="Backlink present again — resuming discovery. Not indexed.",
                )
                ran.append(await self.run_job(job))
                continue
            action = retry_action_for_job(job)
            if action.action == "wait":
                job.next_retry_at = action.next_at
                ran.append(job)
                continue
            if action.action == "feed_refresh":
                stopped = await self._revalidate_before_retry(job)
                if stopped:
                    ran.append(job)
                    continue
                await self._feed_refresh(job, action)
                ran.append(job)
                continue
            if action.action in {"verify", "final", "retry_and_verify"}:
                stopped = await self._revalidate_before_retry(job)
                if stopped:
                    ran.append(job)
                    continue
                if action.action == "retry_and_verify":
                    await transition(
                        self.session,
                        job,
                        PipelineStatus.DISCOVERY_QUEUED,
                        note=f"{action.note}. Re-publishing discovery signals. Not indexed.",
                    )
                    await self._discover(job)
                    if job.pipeline_status == PipelineStatus.DISCOVERY_SUBMITTED.value:
                        await transition(
                            self.session,
                            job,
                            PipelineStatus.WAITING_FOR_CRAWL,
                            note="Discovery republished. Verification is not indexing.",
                        )
                if can_transition(
                    PipelineStatus(job.pipeline_status), PipelineStatus.VERIFICATION_PENDING
                ):
                    await transition(
                        self.session,
                        job,
                        PipelineStatus.VERIFICATION_PENDING,
                        note=f"{action.note}. Verification is not indexing.",
                    )
                await self._verify(job)
                job.experiment_checkpoint = action.name
                job.next_retry_at = action.next_at
                if action.action == "final" and job.pipeline_status in {
                    PipelineStatus.RETRY_PENDING.value,
                    PipelineStatus.VERIFICATION_PENDING.value,
                    PipelineStatus.WAITING_FOR_CRAWL.value,
                    PipelineStatus.DISCOVERY_SUBMITTED.value,
                }:
                    note = "14-day experiment window ended without verified INDEXED evidence"
                    if job.visibility_status != VisibilityStatus.INDEXED.value:
                        job.visibility_status = VisibilityStatus.UNKNOWN.value
                    await self._fail(job, PipelineStatus.TIMEOUT, note)
                job.workflow_stage = workflow_stage_for(job)
                ran.append(job)
                continue
            stopped = await self._revalidate_before_retry(job)
            if stopped:
                ran.append(job)
                continue
            await transition(
                self.session,
                job,
                PipelineStatus.DISCOVERY_QUEUED,
                note=f"{action.note}. Retry attempt {job.attempt_count + 1}",
            )
            ran.append(await self.run_job(job))
        return ran

    async def record_manual_verification(
        self,
        job: IndexingJob,
        *,
        status: str,
        evidence: str,
        confidence: float = 0.8,
        googlebot_visited: bool = False,
    ) -> VerificationResult:
        allowed = {s.value for s in VisibilityStatus}
        if status not in allowed:
            raise ValueError(f"status must be one of {sorted(allowed)}")
        if status == VisibilityStatus.INDEXED.value and confidence < 0.8:
            status = VisibilityStatus.UNKNOWN.value
            evidence = evidence + " (confidence too low to claim INDEXED)"
        if googlebot_visited and not evidence:
            raise ValueError("GOOGLEBOT_VISITED requires explicit evidence")
        result = VerificationResult(
            status=status,
            confidence=confidence,
            checked_at=datetime.now(timezone.utc),
            method="manual",
            evidence=evidence,
            googlebot_visited=googlebot_visited,
        )
        verifier = IndexVerificationService([ManualVerificationStrategy(result)])
        applied = await verifier.verify(
            job.source_url,
            property_type=PropertyType(job.property_type),
        )
        await self._apply_verification(job, applied)
        return applied

    async def job_detail(self, tenant_id: str, job_id: str) -> Optional[dict]:
        job = await self.jobs.get_for_tenant(job_id, tenant_id)
        if job is None:
            return None
        events = await timeline(self.session, job.id)
        bundles = await history_bundles(self.session, job.id)
        return {
            "job": job,
            "timeline": events,
            "bundles": bundles,
            "site_search_url": site_search_url(job.source_url),
        }

    # ------------------------------------------------------------------
    # Stages
    # ------------------------------------------------------------------
    async def _validate(self, job: IndexingJob) -> PipelineStatus:
        result = await validate_url(
            job.source_url,
            timeout=settings.engine_http_timeout_seconds,
            max_redirects=settings.engine_max_redirects,
            transport=self.transport,
        )
        if result.probe and result.probe.our_crawler_visited:
            job.our_crawler_visited = True
            await self._record_our_crawl(job, result.probe.http_status, result.final_url or job.source_url)
        job.http_status = result.http_status
        job.http_class = result.classification
        job.validated_at = datetime.now(timezone.utc)
        job.last_checked_at = job.validated_at
        await add_validation(
            self.session,
            UrlValidation(
                tenant_id=job.tenant_id,
                job_id=job.id,
                ok=result.ok,
                classification=result.classification,
                http_status=result.http_status,
                response_time_ms=result.response_time_ms,
                content_type=result.content_type,
                content_length=result.content_length,
                requested_url=result.requested_url,
                final_url=result.final_url,
                canonical_url=result.canonical_url,
                redirect_chain=list(result.redirect_chain),
                redirect_statuses=list(result.redirect_statuses),
                error=result.error,
                details={
                    "duplicate": result.duplicate,
                    "redirect_statuses": list(result.redirect_statuses),
                    "original_url": result.requested_url,
                    "final_url": result.final_url,
                    "canonical_url": result.canonical_url,
                },
            ),
        )
        if not result.ok:
            if result.classification in {"invalid_url", "duplicate", CLASS_SSRF}:
                await self._fail(job, PipelineStatus.INVALID_URL, result.error or "Invalid URL")
                return PipelineStatus.INVALID_URL
            if result.classification == "timeout":
                await self._retry_or_fail(job, PipelineStatus.TIMEOUT, result.error or "Timeout")
                return PipelineStatus(job.pipeline_status)
            await self._fail(
                job, PipelineStatus.URL_UNREACHABLE, result.error or "URL unreachable"
            )
            return PipelineStatus.URL_UNREACHABLE
        if result.final_url:
            job.source_url = result.final_url
        await transition(self.session, job, PipelineStatus.VALIDATED, note="URL reachable")
        return PipelineStatus.VALIDATED

    async def _backlink(self, job: IndexingJob) -> PipelineStatus:
        assert job.target_url
        page = await probe_url(
            job.source_url,
            timeout=settings.engine_http_timeout_seconds,
            transport=self.transport,
        )
        job.our_crawler_visited = True
        await self._record_our_crawl(job, page.http_status or job.http_status, job.source_url)
        check = inspect_html(
            page.body or "",
            source_url=page.final_url or job.source_url,
            target_url=job.target_url,
            target_final=page.final_url,
        )
        if check.backlink_found:
            check.match_type = (
                f"STATIC_BACKLINK_FOUND:{check.match_type}"
                if check.match_type and not str(check.match_type).startswith("STATIC_")
                else (check.match_type or "STATIC_BACKLINK_FOUND")
            )
        js_check = None
        if (
            not check.backlink_found
            and getattr(settings, "engine_js_backlink_scan", True)
            and page.body
        ):
            js_check = inspect_js_backlink(
                page.body, target_url=job.target_url, target_final=page.final_url
            )
            job.js_backlink_found = bool(js_check.backlink_found)
        else:
            job.js_backlink_found = False
        # Only a static HTML href qualifies the URL for public listing.
        job.backlink_found = check.backlink_found
        job._last_rel = check.rel_attributes
        job._last_surrounding = check.surrounding_text
        job.backlink_rel_type = rel_type_from_rel(check.rel_attributes) if check.backlink_found else None
        now = datetime.now(timezone.utc)
        match_type = check.match_type
        if not check.backlink_found and js_check and js_check.backlink_found:
            match_type = "JS_BACKLINK_FOUND"
        await add_inspection(
            self.session,
            BacklinkInspection(
                tenant_id=job.tenant_id,
                job_id=job.id,
                source_url=job.source_url,
                target_url=job.target_url,
                backlink_found=check.backlink_found,
                href=check.href or (js_check.href if js_check else None),
                anchor_text=check.anchor_text,
                surrounding_text=check.surrounding_text,
                rel_attributes=check.rel_attributes,
                match_type=match_type,
                first_seen=now if (check.backlink_found or job.js_backlink_found) else None,
                last_seen=now if (check.backlink_found or job.js_backlink_found) else None,
                details={
                    "error": check.error,
                    "static": check.backlink_found,
                    "js_backlink_found": job.js_backlink_found,
                    "js_error": js_check.error if js_check else None,
                },
            ),
        )
        if not check.backlink_found:
            note = check.error or "BACKLINK_NOT_FOUND — not sending discovery jobs"
            if job.js_backlink_found:
                note = (
                    "JS_BACKLINK_FOUND — candidate exists in script/JSON-LD but is not a "
                    "static HTML href. Not listed on the public hub."
                )
            await self._fail(job, PipelineStatus.BACKLINK_NOT_FOUND, note)
            return PipelineStatus.BACKLINK_NOT_FOUND
        job.backlink_verified_at = now
        await transition(
            self.session,
            job,
            PipelineStatus.BACKLINK_VERIFIED,
            note=f"Backlink found ({check.match_type}) href={check.href}",
        )
        return PipelineStatus.BACKLINK_VERIFIED

    async def _crawlability(self, job: IndexingJob) -> PipelineStatus:
        report = await analyse_crawlability(
            job.source_url,
            timeout=settings.engine_http_timeout_seconds,
            transport=self.transport,
        )
        job.our_crawler_visited = True
        await self._record_our_crawl(job, job.http_status, job.source_url)
        job.crawlability_score = report.score
        job.crawlability_band = report.band
        await add_crawlability(
            self.session,
            CrawlabilityReport(
                tenant_id=job.tenant_id,
                job_id=job.id,
                score=report.score,
                band=report.band,
                robots_allowed=report.robots_allowed,
                meta_robots=report.meta_robots,
                x_robots_tag=report.x_robots_tag,
                canonical=report.canonical,
                noindex=report.noindex,
                nofollow=report.nofollow,
                is_https=report.is_https,
                is_html=report.is_html,
                page_available=report.page_available,
                notes=report.notes,
            ),
        )
        job.canonical_status = report.canonical_status
        quality = self.quality.score(
            QualityInput(
                http_ok=job.http_status == 200,
                http_status=job.http_status,
                is_html=report.is_html,
                backlink_found=job.backlink_found,
                rel_attributes=getattr(job, "_last_rel", None),
                surrounding_text=getattr(job, "_last_surrounding", None),
                target_url=job.target_url,
                canonical_status=report.canonical_status,
                robots_allowed=report.robots_allowed,
                noindex=report.noindex,
                page_available=report.page_available,
                outbound_link_count=int(report.notes.get("outbound_link_count") or 0),
                content_length=int(report.notes.get("content_length") or 0),
                submitted_at=job.submitted_at,
                source_url=job.source_url,
                is_https=report.is_https,
            )
        )
        job.quality_score = quality.score
        job.quality_factors = quality.factors
        job.quality_warnings = quality.warnings
        job.quality_recommendation = quality.recommendation
        boost = await domain_boost(self.session, job.tenant_id, job.source_url)
        submitted = job.submitted_at
        if submitted and submitted.tzinfo is None:
            submitted = submitted.replace(tzinfo=timezone.utc)
        fresh = True
        if submitted:
            fresh = datetime.now(timezone.utc) - submitted <= timedelta(days=7)
        score, band = compute_priority(
            PriorityInput(
                crawlability_score=report.score,
                http_ok=job.http_status == 200,
                backlink_found=job.backlink_found,
                is_html=report.is_html,
                is_https=report.is_https,
                our_crawler_visited=job.our_crawler_visited,
                googlebot_visited=job.googlebot_visited,
                attempt_count=job.attempt_count,
                quality_score=quality.score,
                domain_success_boost=boost,
                fresh=fresh,
            )
        )
        job.priority_score = score
        job.priority_band = band.value
        if report.canonical_status == "CANONICAL_MISMATCH":
            job.last_error = (
                (job.last_error + " | " if job.last_error else "")
                + "CANONICAL_MISMATCH — source URL may not be the indexed URL"
            )
        blocked = report.blocked_for_discovery
        if blocked == "NOINDEX":
            job.public_listed = False
            await self._fail(job, PipelineStatus.NOINDEX, "Page has noindex — discovery skipped")
            return PipelineStatus.NOINDEX
        if blocked == "ROBOTS_BLOCKED":
            job.public_listed = False
            await self._fail(job, PipelineStatus.ROBOTS_BLOCKED, "robots.txt disallows crawling")
            return PipelineStatus.ROBOTS_BLOCKED
        if blocked == "URL_UNREACHABLE":
            job.public_listed = False
            await self._fail(
                job,
                PipelineStatus.URL_UNREACHABLE,
                "Empty or invalid HTML — discovery skipped",
            )
            return PipelineStatus.URL_UNREACHABLE
        job.experiment_group = job.experiment_group or assign_experiment_group(job.source_url_hash)
        job.experiment_assigned_at = job.experiment_assigned_at or datetime.now(timezone.utc)
        job.quality_band = quality_band(quality.score)
        job.page_freshness = "fresh" if fresh else "old"
        spam = looks_like_spam(job.source_url)
        
        # DISCOVERY ELIGIBILITY: Can this URL attempt discovery?
        # Should be liberal - allow discovery even for low-quality/unfound backlinks.
        # Quality is used only for UI ranking and internal prioritization, not pipeline blocking.
        discovery_eligible = (
            (_max_discovery_enabled() or job.experiment_group != "A")
            and not project_is_private(job.project)
            and spam is None  # Still block obvious spam
            # Removed backlink_found gate - discovery should attempt regardless
            # Removed quality >= 40 gate - quality affects UI, not discovery eligibility
        )
        
        # PUBLIC LISTING: Should this URL be promoted to public featured feed?
        # More restrictive - only promote high-quality, verified backlinks.
        # This affects UI ranking and feed inclusion priority, not discovery attempt.
        public_listing_eligible = (
            discovery_eligible
            and (not job.target_url or job.backlink_found is True)  # Only promote if backlink found
            and quality.score >= 40  # Only promote if high quality
            and not job.js_backlink_found  # Don't promote JS backlinks
        )
        
        job.discovery_eligible = discovery_eligible
        job.public_listed = public_listing_eligible
        scored = compute_discovery_score(
            http_ok=job.http_status == 200,
            backlink_found=job.backlink_found,
            robots_allowed=report.robots_allowed,
            noindex=report.noindex,
            canonical_status=report.canonical_status,
            feed_published=job.public_listed,
            submitted_at=job.submitted_at,
            googlebot_visited=job.googlebot_visited,
        )
        job.discovery_score = scored.score
        await self.session.flush()
        note = (
            f"Crawlability {report.score} ({report.band}); DiscoveryScore {scored.score} "
            f"(workflow readiness, not index probability); experiment {job.experiment_group}"
        )
        if report.canonical_status == "CANONICAL_MISMATCH":
            note += "; CANONICAL_MISMATCH"
        await transition(
            self.session,
            job,
            PipelineStatus.DISCOVERY_QUEUED,
            note=note,
        )
        return PipelineStatus.DISCOVERY_QUEUED

    async def _baseline(self, job: IndexingJob) -> PipelineStatus:
        """T+0 verification before discovery. Already-indexed URLs are not manipulated."""
        from app.modules.indexing.engine.verification import INDEXED_MIN_CONFIDENCE

        now = datetime.now(timezone.utc)
        result = await self.verifier.verify(
            job.source_url,
            property_type=PropertyType(job.property_type),
            http_ok=job.http_status == 200,
            our_crawler_visited=job.our_crawler_visited,
            discovery_submitted=False,
        )
        await add_verification(
            self.session,
            VerificationAttempt(
                tenant_id=job.tenant_id,
                job_id=job.id,
                method=result.method,
                status=result.status,
                confidence=result.confidence,
                evidence=f"T+0 baseline. {result.evidence}",
                checked_at=result.checked_at,
                details={**(result.details or {}), "checkpoint": "T+0", "baseline": True},
                crawler_user_agent=result.crawler_user_agent,
                requested_url=result.requested_url,
                verification_source=result.verification_source,
            ),
        )
        job.baseline_snapshot = {
            "source_url": job.source_url,
            "domain": job.source_domain,
            "http_status": job.http_status,
            "backlink_found": job.backlink_found,
            "backlink_rel_type": job.backlink_rel_type,
            "canonical_status": job.canonical_status,
            "quality_score": job.quality_score,
            "verification_status": result.status,
            "checked_at": result.checked_at.isoformat(),
        }
        job.experiment_checkpoint = "T+0"
        if result.status == VisibilityStatus.INDEXED.value and result.confidence >= INDEXED_MIN_CONFIDENCE:
            job.baseline_status = "BASELINE_ALREADY_INDEXED"
            job.experiment_eligible = False
            job.public_listed = False
            job.experiment_started_at = job.experiment_started_at or now
            await self._apply_verification(job, result)
            return PipelineStatus(job.pipeline_status)
        eligible = (
            job.http_status == 200
            and (not job.target_url or job.backlink_found is True)
            and job.pipeline_status
            not in {
                PipelineStatus.NOINDEX.value,
                PipelineStatus.ROBOTS_BLOCKED.value,
                PipelineStatus.BACKLINK_NOT_FOUND.value,
                PipelineStatus.BACKLINK_REMOVED.value,
            }
        )
        job.baseline_status = "ELIGIBLE" if eligible else "INELIGIBLE"
        job.experiment_eligible = bool(eligible)
        job.experiment_started_at = now
        return PipelineStatus.DISCOVERY_QUEUED

    async def _discover(self, job: IndexingJob) -> PipelineStatus:
        group = job.experiment_group or assign_experiment_group(job.source_url_hash)
        if group == "A" and self._channels is None and not _max_discovery_enabled():
            job.public_listed = False
            job.discovery_status = "CONTROL_MONITOR_ONLY"
            job.discovery_stage = DiscoveryStage.NONE.value
            job.channel_snapshot = {
                "control": {
                    "channel": "control",
                    "status": "MONITOR_ONLY",
                    "accepted": False,
                    "evidence": "Group A control — no discovery signal was sent.",
                }
            }
            job.discovery_completed_at = datetime.now(timezone.utc)
            job.last_checked_at = job.discovery_completed_at
            await add_discovery(
                self.session,
                DiscoveryAttempt(
                    tenant_id=job.tenant_id,
                    job_id=job.id,
                    channel="control",
                    status="MONITOR_ONLY",
                    accepted=False,
                    evidence="Control group: URL is monitored only. Not published. Not indexed.",
                    payload={"experiment_group": "A"},
                ),
            )
            await transition(
                self.session,
                job,
                PipelineStatus.WAITING_FOR_CRAWL,
                note="Group A control — no hub, feed, or WebSub signal. Monitoring only.",
            )
            return PipelineStatus.WAITING_FOR_CRAWL
        job.attempt_count += 1
        job.discovery_started_at = job.discovery_started_at or datetime.now(timezone.utc)
        channels = await self._channels_for(job)
        outcomes: List[ChannelOutcome] = []
        accepted = 0
        for channel in channels:
            outcome = await channel.submit(
                job.source_url, property_type=PropertyType(job.property_type)
            )
            outcomes.append(outcome)
            await add_discovery(
                self.session,
                DiscoveryAttempt(
                    tenant_id=job.tenant_id,
                    job_id=job.id,
                    channel=outcome.channel,
                    status=outcome.status.value,
                    accepted=outcome.accepted,
                    response_code=outcome.response_code,
                    error=outcome.error,
                    evidence=outcome.evidence,
                    payload=outcome.payload,
                ),
            )
            if outcome.accepted:
                accepted += 1
        snapshot = {o.channel: _channel_card(o) for o in outcomes}
        if job.public_listed:
            snapshot.update(_feed_inventory_cards(job))
        job.channel_snapshot = snapshot
        best_quality = max((o.quality_score for o in outcomes if o.accepted), default=0.0)
        job.discovery_quality = best_quality
        stages = [o.discovery_stage for o in outcomes if o.accepted]
        if DiscoveryStage.DISCOVERY_VERIFIED.value in stages:
            job.discovery_stage = DiscoveryStage.DISCOVERY_VERIFIED.value
        elif DiscoveryStage.DISCOVERY_PUBLISHED.value in stages:
            job.discovery_stage = DiscoveryStage.DISCOVERY_PUBLISHED.value
        elif DiscoveryStage.DISCOVERY_ACCEPTED.value in stages or accepted:
            job.discovery_stage = DiscoveryStage.DISCOVERY_ACCEPTED.value
        job.discovery_completed_at = datetime.now(timezone.utc)
        job.last_checked_at = job.discovery_completed_at
        if accepted:
            job.discovery_status = ChannelResultStatus.DISCOVERY_PUBLISHED.value
            # Visibility stays UNKNOWN until verification evidence. Hub listing
            # is not TARGET_URL_DISCOVERED.
            await transition(
                self.session,
                job,
                PipelineStatus.DISCOVERY_SUBMITTED,
                note=f"{accepted} channel(s) accepted the URL. Not indexed. Not Google-discovered.",
            )
            return PipelineStatus.DISCOVERY_SUBMITTED
        job.discovery_status = ChannelResultStatus.FAILED.value
        summary = "; ".join(
            f"{o.channel}:{o.status.value}" for o in outcomes
        ) or "no channels configured"
        await self._retry_or_fail(job, PipelineStatus.DISCOVERY_FAILED, summary)
        return PipelineStatus(job.pipeline_status)

    async def _verify(self, job: IndexingJob) -> PipelineStatus:
        job.verification_started_at = datetime.now(timezone.utc)
        result = await self.verifier.verify(
            job.source_url,
            property_type=PropertyType(job.property_type),
            http_ok=job.http_status == 200,
            our_crawler_visited=job.our_crawler_visited,
            discovery_submitted=job.pipeline_status
            in {
                PipelineStatus.DISCOVERY_SUBMITTED.value,
                PipelineStatus.WAITING_FOR_CRAWL.value,
                PipelineStatus.VERIFICATION_PENDING.value,
            },
        )
        await self._apply_verification(job, result)
        return PipelineStatus(job.pipeline_status)

    async def _apply_verification(self, job: IndexingJob, result: VerificationResult) -> None:
        await add_verification(
            self.session,
            VerificationAttempt(
                tenant_id=job.tenant_id,
                job_id=job.id,
                method=result.method,
                status=result.status,
                confidence=result.confidence,
                evidence=result.evidence,
                checked_at=result.checked_at,
                details=result.details,
                crawler_user_agent=result.crawler_user_agent,
                requested_url=result.requested_url,
                verification_source=result.verification_source,
            ),
        )
        job.verification_status = result.status
        job.verification_confidence = result.confidence
        job.verification_method = result.method
        job.last_checked_at = result.checked_at
        if result.googlebot_visited:
            job.googlebot_visited = True
            job.crawl_detected_at = job.crawl_detected_at or result.checked_at
            evidence_type = CrawlEvidenceType.SEARCH_CONSOLE.value
            crawler_identity = "googlebot"
            if result.method == "google_custom_search":
                evidence_type = CrawlEvidenceType.SEARCH_RESULT.value
            elif result.method == "manual":
                evidence_type = CrawlEvidenceType.MANUAL.value
            elif result.method == "crawler_evidence":
                evidence_type = CrawlEvidenceType.CRAWLER_EVIDENCE.value
                crawler_identity = "googlebot_verified"
            await add_crawl_evidence(
                self.session,
                CrawlEvidence(
                    tenant_id=job.tenant_id,
                    job_id=job.id,
                    url=job.source_url,
                    crawler_identity=crawler_identity
                    if result.method == "crawler_evidence"
                    else (
                        "googlebot"
                        if result.method == "google_search_console"
                        else result.method
                    ),
                    user_agent=result.crawler_user_agent,
                    source=result.method,
                    status_code=None,
                    observed_at=result.checked_at,
                    evidence_type=evidence_type,
                    confidence=result.confidence,
                    details={
                        "evidence": result.evidence,
                        **(result.details or {}),
                    },
                ),
            )
            if job.visibility_status in {
                VisibilityStatus.UNKNOWN.value,
                VisibilityStatus.DISCOVERED.value,
            }:
                job.visibility_status = VisibilityStatus.CRAWLED.value
        if result.status == VisibilityStatus.INDEXED.value:
            if job.indexed_at is None:
                job.indexed_before_retry = (job.attempt_count or 0) <= 1
            job.visibility_status = VisibilityStatus.INDEXED.value
            job.indexed_at = job.indexed_at or result.checked_at
            await record_verified_index(self.session, job)
            await transition(
                self.session,
                job,
                PipelineStatus.INDEXED,
                note=f"{result.method} confidence={result.confidence}: {result.evidence}",
            )
            if job.backlink_id:
                backlink = await self.dispatch.get_backlink(job.tenant_id, job.backlink_id)
                if backlink is not None:
                    backlink.index_status = "indexed"
            return
        if result.status == VisibilityStatus.DISCOVERED.value:
            job.visibility_status = VisibilityStatus.DISCOVERED.value
            await self._retry_or_fail(
                job, PipelineStatus.NOT_INDEXED, result.evidence, prefer_retry=True
            )
            return
        if result.status == VisibilityStatus.NOT_INDEXED.value:
            strong = result.method == "google_search_console" and result.confidence >= 0.8
            if job.visibility_status == VisibilityStatus.INDEXED.value or not strong:
                job.visibility_status = (
                    VisibilityStatus.INDEXED.value
                    if job.visibility_status == VisibilityStatus.INDEXED.value
                    else VisibilityStatus.UNKNOWN.value
                )
                await self._retry_or_fail(
                    job,
                    PipelineStatus.NOT_INDEXED,
                    result.evidence + " (inconclusive — not NOT_INDEXED without reliable evidence)",
                    prefer_retry=True,
                )
                return
            job.visibility_status = VisibilityStatus.NOT_INDEXED.value
            await self._retry_or_fail(
                job, PipelineStatus.NOT_INDEXED, result.evidence, prefer_retry=True
            )
            return
        if result.status == VisibilityStatus.CRAWLED.value:
            job.visibility_status = VisibilityStatus.CRAWLED.value
            if result.method == "crawler_evidence":
                # Crawled ≠ indexed: keep retrying the verification checkpoints.
                await self._retry_or_fail(
                    job, PipelineStatus.NOT_INDEXED, result.evidence, prefer_retry=True
                )
                return
        await self._retry_or_fail(
            job,
            PipelineStatus.VERIFICATION_FAILED
            if result.method not in {"none", "manual"}
            else PipelineStatus.NOT_INDEXED,
            result.evidence,
            prefer_retry=True,
        )

    async def _channels_for(self, job: IndexingJob) -> List:
        if self._channels is not None:
            return list(self._channels)
        providers = self.dispatch.providers or build_providers()
        hub_url = settings.public_hub_url or "https://pintdown.site/featured"
        feed_url = settings.websub_feed_url or "https://pintdown.site/feed.xml"
        items = await list_feed_items(self.session, limit=200)
        
        # Check if URL is already in the feed inventory (from any job)
        in_inventory = inventory_contains(items, job.source_url)
        
        # Generate RSS document regardless of public_listed status.
        # Channels need this for their own decision-making.
        # Previously, document was only generated if listed=True, which blocked
        # low-quality URLs from discovery attempts. Now discovery can proceed.
        document = render_rss(
            items,
            home_url=hub_url,
            feed_url=feed_url,
            hub_url=(settings.websub_hub_urls[0] if settings.websub_hub_urls else "https://pubsubhubbub.appspot.com"),
        )
        
        gsc_channel = None
        if getattr(settings, "gsc_submit_feed", False):
            gsc_channel = GscFeedSitemapChannel(
                access_token=settings.gsc_access_token,
                site_url=settings.gsc_site_url,
                feed_url=feed_url,
                enabled=True,
            )
        
        # Pass both flags to channels:
        # - listed_on_hub: URL is marked for public promotion (high quality)
        # - hub_document: The full feed (for channels to check their own logic)
        channels = build_free_channels(
            providers,
            listed_on_hub=bool(job.public_listed),  # For PublicHubChannel.accept_if_published
            hub_url=hub_url,
            feed_url=feed_url,
            sitemap_url=settings.owned_sitemap_url,
            hub_document=document,  # Always pass document; channels decide usage
            gsc_feed_channel=gsc_channel,
        )
        wrapped = wrap_channels(channels)
        if _max_discovery_enabled():
            # All legitimate third-party channels. wrap_channels records N/A for
            # owner-only tools instead of executing them against third-party hosts.
            if (
                job.property_type == PropertyType.OWNED_PROPERTY.value
                and is_owned(job.source_url)
            ):
                for method in settings.indexer_provider_order:
                    provider = providers.get(method)
                    if provider is not None:
                        wrapped.append(ProviderBackedChannel(method, provider))
            return wrapped
        group = job.experiment_group or assign_experiment_group(job.source_url_hash or "")
        allowed = set(experiment_channel_names(group))
        if group == "A":
            wrapped = []
        else:
            wrapped = [p for p in wrapped if p.name in allowed]
        # Owner-only IndexNow/sitemap/GSC stay off for third-party experiment URLs.
        if job.property_type == PropertyType.OWNED_PROPERTY.value and group == "D":
            for method in settings.indexer_provider_order:
                provider = providers.get(method)
                if provider is not None:
                    wrapped.append(ProviderBackedChannel(method, provider))
        return wrapped

    async def _fail(self, job: IndexingJob, status: PipelineStatus, message: str) -> None:
        job.last_error = message
        job.next_retry_at = None
        await transition(self.session, job, status, note=message)

    async def _retry_or_fail(
        self,
        job: IndexingJob,
        fail_status: PipelineStatus,
        message: str,
        *,
        prefer_retry: bool = False,
    ) -> None:
        job.last_error = message
        if should_retry(fail_status, job.attempt_count):
            if fail_status in {
                PipelineStatus.NOT_INDEXED,
                PipelineStatus.VERIFICATION_FAILED,
            }:
                job.next_retry_at = next_after_success(job.submitted_at, jitter_ratio=0.1)
            else:
                job.next_retry_at = next_retry_at(job.attempt_count + 1, jitter_ratio=0.1)
            await transition(
                self.session,
                job,
                PipelineStatus.RETRY_PENDING,
                note=(
                    f"{message}. Retry {job.attempt_count + 1}/{MAX_DISCOVERY_ATTEMPTS} "
                    f"scheduled at {job.next_retry_at.isoformat()}"
                ),
            )
            return
        if prefer_retry and fail_status == PipelineStatus.NOT_INDEXED:
            await transition(self.session, job, PipelineStatus.NOT_INDEXED, note=message)
            return
        await transition(self.session, job, fail_status, note=message)

    async def _feed_refresh(self, job: IndexingJob, action) -> None:
        """Re-include a still-valid URL in the public inventory. Does not fake pubDate."""
        from app.modules.indexing.engine.quality import job_is_feed_eligible

        still = job_is_feed_eligible(job)
        job.public_listed = bool(still)
        job.last_checked_at = datetime.now(timezone.utc)
        job.next_retry_at = action.next_at
        job.workflow_stage = workflow_stage_for(job)
        await add_discovery(
            self.session,
            DiscoveryAttempt(
                tenant_id=job.tenant_id,
                job_id=job.id,
                channel="feed_refresh",
                status="DISCOVERY_PUBLISHED" if still else "SKIPPED",
                accepted=still,
                evidence=(
                    "Feed refresh: URL remains in the quality-gated inventory. "
                    "pubDate was not changed. Not indexed."
                    if still
                    else "Feed refresh skipped — URL no longer quality-eligible"
                ),
                payload={"phase": action.name, "listed": still},
            ),
        )
        job.last_error = action.note

    async def submit_existing_backlinks(
        self,
        tenant_id: str,
        *,
        target_url: Optional[str] = None,
        run: bool = True,
        limit: int = 40,
    ) -> tuple[List[IndexingJob], int]:
        """Process already-stored backlink rows. Does not create new backlinks."""
        rows, total = await self.dispatch.list_backlinks(tenant_id, limit=limit, offset=0)
        jobs: List[IndexingJob] = []
        home = target_url or _owned_target_url()
        for row in rows:
            existing = await self.jobs.get_by_hash(tenant_id, row.url_hash)
            job = await self.submit(
                tenant_id,
                row.url,
                target_url=home,
                project="max-discovery",
                backlink_id=row.id,
                run=False,
            )
            if run:
                if existing is None or job.pipeline_status == PipelineStatus.RECEIVED.value:
                    job = await self.run_job(job)
            jobs.append(job)
        return jobs, total

    async def _revalidate_before_retry(self, job: IndexingJob) -> bool:
        """Re-check HTTP, backlink, canonical, robots, and content before retry.

        Returns True when discovery must stop for now.
        """
        page = await probe_url(
            job.source_url,
            timeout=settings.engine_http_timeout_seconds,
            transport=self.transport,
        )
        job.http_status = page.http_status
        job.http_class = page.classification
        job.our_crawler_visited = True
        await self._record_our_crawl(job, page.http_status, job.source_url)
        report = await analyse_crawlability(
            job.source_url,
            probe=page,
            timeout=settings.engine_http_timeout_seconds,
            transport=self.transport,
        )
        job.canonical_status = report.canonical_status
        if report.canonical_status == "CANONICAL_MISMATCH":
            job.last_error = (
                "CANONICAL_MISMATCH — source URL may not be the indexed URL"
            )
        blocked = report.blocked_for_discovery
        if blocked in {"NOINDEX", "ROBOTS_BLOCKED", "URL_UNREACHABLE"}:
            job.public_listed = False
            status = {
                "NOINDEX": PipelineStatus.NOINDEX,
                "ROBOTS_BLOCKED": PipelineStatus.ROBOTS_BLOCKED,
                "URL_UNREACHABLE": PipelineStatus.URL_UNREACHABLE,
            }[blocked]
            if can_transition(PipelineStatus(job.pipeline_status), status):
                await self._fail(job, status, f"Revalidation: {blocked}")
            return True
        if job.target_url:
            check = inspect_html(
                page.body or "",
                source_url=page.final_url or job.source_url,
                target_url=job.target_url,
                target_final=page.final_url,
            )
            if not check.backlink_found:
                job.backlink_found = False
                job.public_listed = False
                job.last_error = "BACKLINK_REMOVED — outbound target href is gone"
                job.next_retry_at = next_retry_at(job.attempt_count + 1, jitter_ratio=0.1)
                await add_discovery(
                    self.session,
                    DiscoveryAttempt(
                        tenant_id=job.tenant_id,
                        job_id=job.id,
                        channel="revalidate",
                        status="BACKLINK_REMOVED",
                        accepted=False,
                        evidence="BACKLINK_REMOVED — discovery stopped until the href returns",
                        payload={"next_retry_at": job.next_retry_at.isoformat() if job.next_retry_at else None},
                    ),
                )
                if can_transition(
                    PipelineStatus(job.pipeline_status), PipelineStatus.BACKLINK_REMOVED
                ):
                    await transition(
                        self.session,
                        job,
                        PipelineStatus.BACKLINK_REMOVED,
                        note="BACKLINK_REMOVED — discovery stopped. Will re-check; not indexed.",
                    )
                job.workflow_stage = workflow_stage_for(job)
                await self.session.flush()
                return True
            job.backlink_found = True
        return False

    async def _record_our_crawl(
        self, job: IndexingJob, status_code: Optional[int], url: str
    ) -> None:
        await add_crawl_evidence(
            self.session,
            CrawlEvidence(
                tenant_id=job.tenant_id,
                job_id=job.id,
                url=url,
                crawler_identity="PintDownFreeIndexer",
                user_agent=OUR_CRAWLER_UA,
                source="engine",
                status_code=status_code,
                observed_at=datetime.now(timezone.utc),
                evidence_type=CrawlEvidenceType.OUR_CRAWLER.value,
                confidence=1.0,
                details={"note": "OUR_CRAWLER is never Googlebot"},
            ),
        )


def _channel_card(outcome: ChannelOutcome) -> dict:
    return {
        "channel": outcome.channel,
        "status": outcome.status.value,
        "accepted": outcome.accepted,
        "response_code": outcome.response_code,
        "error": outcome.error,
        "evidence": outcome.evidence,
        "signal_quality": outcome.quality_score,
        "discovery_stage": outcome.discovery_stage,
        "payload": outcome.payload,
    }


def _max_discovery_enabled() -> bool:
    return bool(getattr(settings, "max_discovery_mode", False))


def _owned_target_url() -> str:
    domains = getattr(settings, "owned_domains", None) or []
    if domains:
        return f"https://{domains[0]}/"
    return "https://pintdown.site/"


def _feed_inventory_cards(job: IndexingJob) -> dict:
    evidence = (
        f"Listed on {settings.api_v1_prefix}/public/featured, "
        f"{settings.api_v1_prefix}/public/index, "
        f"{settings.api_v1_prefix}/public/url/{job.source_url_hash}, "
        "feed.xml, feed.atom, feed.json. Not indexed."
    )
    card = {
        "status": "DISCOVERY_PUBLISHED",
        "accepted": True,
        "evidence": evidence,
        "discovery_stage": DiscoveryStage.DISCOVERY_PUBLISHED.value,
    }
    return {
        "rss": {**card, "channel": "rss"},
        "atom": {**card, "channel": "atom"},
        "json_feed": {**card, "channel": "json_feed"},
        "html_discovery": {
            **card,
            "channel": "html_discovery",
            "evidence": f"{settings.api_v1_prefix}/public/url/{job.source_url_hash}",
        },
    }


def default_verifier() -> IndexVerificationService:
    strategies = []
    if settings.gsc_access_token and settings.gsc_site_url:
        strategies.append(
            SearchConsoleStrategy(
                access_token=settings.gsc_access_token, site_url=settings.gsc_site_url
            )
        )
    strategies.append(CrawlerEvidenceStrategy())
    if settings.google_cse_api_key and settings.google_cse_cx:
        strategies.append(
            CustomSearchStrategy(
                api_key=settings.google_cse_api_key,
                cx=settings.google_cse_cx,
                daily_quota=settings.google_cse_daily_quota,
            )
        )
    return IndexVerificationService(strategies)

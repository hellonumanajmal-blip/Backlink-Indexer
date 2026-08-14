"""Quality scoring, priority queue, calendar scheduler, and category pages."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from app.modules.indexing.engine.backlink_quality import (
    BacklinkQualityEngine,
    QualityInput,
)
from app.modules.indexing.engine.feeds import FeedItem, render_rss
from app.modules.indexing.engine.models import IndexingJob
from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.modules.indexing.engine.priority import PriorityInput, compute_priority
from app.modules.indexing.engine.quality import job_is_feed_eligible
from app.modules.indexing.engine.repository import list_categories, list_category_items, list_feed_items
from app.modules.indexing.engine.scheduler import calendar_action, retry_action_for_job
from app.modules.indexing.engine.states import PipelineStatus, PriorityBand, WorkflowStage, workflow_stage_for

from tests.test_indexing_engine import TENANT


def _good_input(**overrides) -> QualityInput:
    base = QualityInput(
        http_ok=True,
        http_status=200,
        is_html=True,
        backlink_found=True,
        rel_attributes="noopener",
        surrounding_text="ours example site",
        target_url="https://ours.example/",
        canonical_status="self",
        robots_allowed=True,
        noindex=False,
        page_available=True,
        outbound_link_count=8,
        content_length=400,
        submitted_at=datetime.now(timezone.utc),
        source_url="https://src.example/post",
        is_https=True,
    )
    for key, value in overrides.items():
        setattr(base, key, value)
    return base


def test_quality_good_backlink_scores_high():
    result = BacklinkQualityEngine().score(_good_input())
    assert result.score >= 70
    assert "http_200" in result.factors
    assert "Do not publish" not in result.recommendation


def test_quality_bad_backlink_is_weak():
    result = BacklinkQualityEngine().score(
        _good_input(
            backlink_found=False,
            content_length=10,
            outbound_link_count=250,
            http_ok=False,
            http_status=404,
            page_available=False,
        )
    )
    assert result.score < 40
    assert "dead page" in result.warnings
    assert "backlink not found" in result.warnings
    assert "empty content" in result.warnings
    assert "excessive outbound links" in result.warnings


def test_quality_noindex_is_not_publishable():
    result = BacklinkQualityEngine().score(_good_input(noindex=True))
    assert "noindex" in result.warnings
    assert "Do not publish" in result.recommendation


def test_quality_robots_blocked_is_not_publishable():
    result = BacklinkQualityEngine().score(_good_input(robots_allowed=False))
    assert "robots blocked" in result.warnings
    assert "Do not publish" in result.recommendation


def test_priority_bands_from_quality():
    high, high_band = compute_priority(
        PriorityInput(quality_score=90, http_ok=True, backlink_found=True, is_html=True, is_https=True)
    )
    low, low_band = compute_priority(
        PriorityInput(quality_score=10, http_ok=False, backlink_found=False)
    )
    assert high_band == PriorityBand.HIGH
    assert low_band == PriorityBand.LOW
    assert high > low


def test_scheduler_calendar_windows():
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    day0 = calendar_action(start, now=start + timedelta(hours=1), jitter_ratio=0)
    assert day0.name == "DAY_1"
    assert day0.action == "feed_refresh"
    day1 = calendar_action(start, now=start + timedelta(hours=22), jitter_ratio=0)
    assert day1.action == "feed_refresh"
    day3 = calendar_action(start, now=start + timedelta(days=3), jitter_ratio=0)
    assert day3.name == "DAY_3"
    assert day3.action == "retry_discovery"
    day7 = calendar_action(start, now=start + timedelta(days=7), jitter_ratio=0)
    assert day7.name == "DAY_7"
    assert day7.action == "verify"
    day14 = calendar_action(start, now=start + timedelta(days=14), jitter_ratio=0)
    assert day14.name == "DAY_14"
    assert day14.action == "final"


def test_failed_discovery_uses_backoff_not_calendar():
    job = type("J", (), {})()
    job.discovery_status = "FAILED"
    job.pipeline_status = PipelineStatus.DISCOVERY_FAILED.value
    job.attempt_count = 1
    job.submitted_at = datetime(2026, 1, 1, tzinfo=timezone.utc)
    action = retry_action_for_job(job, now=datetime(2026, 1, 1, 1, tzinfo=timezone.utc))
    assert action.name == "BACKOFF"
    assert action.action == "retry_discovery"


def test_feed_refresh_does_not_change_pubdate():
    ts = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    items = [FeedItem(url="https://ex.example/a", title="a", updated=ts, id="https://ex.example/a")]
    xml = render_rss(items)
    assert "Fri, 02 Jan 2026" in xml
    later = render_rss(items)
    assert xml == later


def test_low_quality_score_is_not_feed_eligible():
    job = type("J", (), {})()
    job.project = "public"
    job.public_listed = True
    job.pipeline_status = "DISCOVERY_SUBMITTED"
    job.http_status = 200
    job.target_url = None
    job.source_url = "https://ok.example/page"
    job.backlink_found = None
    job.quality_score = 12
    assert job_is_feed_eligible(job) is False
    job.quality_score = 55
    assert job_is_feed_eligible(job) is True


def test_workflow_stage_keeps_discovery_separate_from_index():
    job = type("J", (), {})()
    job.visibility_status = "UNKNOWN"
    job.pipeline_status = PipelineStatus.WAITING_FOR_CRAWL.value
    job.googlebot_visited = False
    job.discovery_stage = "DISCOVERY_PUBLISHED"
    assert workflow_stage_for(job) == WorkflowStage.WAITING.value
    job.visibility_status = "INDEXED"
    job.pipeline_status = PipelineStatus.INDEXED.value
    assert workflow_stage_for(job) == WorkflowStage.INDEXED.value


@pytest.mark.anyio
async def test_due_retries_process_high_priority_first(session):
    now = datetime.now(timezone.utc)
    low = IndexingJob(
        tenant_id=TENANT,
        source_url="https://low.example/a",
        source_url_hash="low-hash",
        pipeline_status=PipelineStatus.RETRY_PENDING.value,
        next_retry_at=now - timedelta(minutes=1),
        priority_score=10,
        priority_band="LOW",
        public_listed=False,
        channel_snapshot={},
        submitted_at=now - timedelta(days=3),
    )
    high = IndexingJob(
        tenant_id=TENANT,
        source_url="https://high.example/a",
        source_url_hash="high-hash",
        pipeline_status=PipelineStatus.RETRY_PENDING.value,
        next_retry_at=now - timedelta(minutes=1),
        priority_score=90,
        priority_band="HIGH",
        public_listed=False,
        channel_snapshot={},
        submitted_at=now - timedelta(days=3),
    )
    session.add_all([low, high])
    await session.flush()
    due = await IndexingEngine(session).jobs.due_retries(now=now, limit=10)
    assert [row.source_url for row in due] == ["https://high.example/a", "https://low.example/a"]


@pytest.mark.anyio
async def test_feed_items_keep_original_submitted_timestamp(session):
    submitted = datetime(2026, 3, 4, 5, 6, 7, tzinfo=timezone.utc)
    job = IndexingJob(
        tenant_id=TENANT,
        source_url="https://ok.example/listed",
        source_url_hash="listed-hash",
        pipeline_status=PipelineStatus.DISCOVERY_SUBMITTED.value,
        http_status=200,
        public_listed=True,
        quality_score=80,
        submitted_at=submitted,
        channel_snapshot={},
        project="public",
    )
    session.add(job)
    await session.flush()
    items = await list_feed_items(session, limit=10)
    assert items[0].updated == submitted


@pytest.mark.anyio
async def test_category_pages_require_three_urls(session, client):
    now = datetime.now(timezone.utc)
    for i in range(2):
        session.add(
            IndexingJob(
                tenant_id=TENANT,
                source_url=f"https://thin.example/page-{i}",
                source_url_hash=f"thin-{i}",
                pipeline_status=PipelineStatus.DISCOVERY_SUBMITTED.value,
                http_status=200,
                public_listed=True,
                quality_score=70,
                submitted_at=now,
                channel_snapshot={},
            )
        )
    await session.flush()
    cats = await list_categories(session, min_count=3)
    assert all(row["domain"] != "thin.example" for row in cats)
    items = await list_category_items(session, "thin.example")
    assert len(items) == 2

    session.add(
        IndexingJob(
            tenant_id=TENANT,
            source_url="https://thin.example/page-2",
            source_url_hash="thin-2",
            pipeline_status=PipelineStatus.DISCOVERY_SUBMITTED.value,
            http_status=200,
            public_listed=True,
            quality_score=70,
            submitted_at=now,
            channel_snapshot={},
        )
    )
    await session.flush()
    cats = await list_categories(session, min_count=3)
    assert any(row["domain"] == "thin.example" and row["count"] == 3 for row in cats)
    empty = await client.get("/api/public/categories/missing.example")
    assert empty.status_code == 404

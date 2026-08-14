"""MAX_DISCOVERY_MODE uses every legitimate third-party channel.

Does not create backlinks, spoof Googlebot, or treat WEBSUB_ACCEPTED as INDEXED.
"""
from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.core.config import settings
from app.modules.indexing.engine.channels import ChannelOutcome
from app.modules.indexing.engine.models import IndexingJob
from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.modules.indexing.engine.retry_schedule import (
    DISCOVERY_BACKOFF_SECONDS,
    MAX_DISCOVERY_ATTEMPTS,
)
from app.modules.indexing.engine.scheduler import retry_action_for_job
from app.modules.indexing.engine.states import (
    ChannelResultStatus,
    PipelineStatus,
    VisibilityStatus,
    final_status_for,
)
from app.modules.indexing.engine.verification import (
    IndexVerificationService,
    ManualVerificationStrategy,
    VerificationResult,
)
from app.modules.indexing.indexer_dispatch import normalise_url, url_fingerprint

from tests.test_indexing_engine import TENANT, FakeChannel, live_pages
from tests.test_indexing_experiment import _url_for_group


def _unknown_engine(session, monkeypatch, *, max_mode: bool):
    monkeypatch.setattr(settings, "max_discovery_mode", max_mode)
    unknown = VerificationResult(
        status=VisibilityStatus.UNKNOWN.value,
        confidence=0.0,
        checked_at=datetime.now(timezone.utc),
        method="none",
        evidence="no evidence",
    )
    return IndexingEngine(
        session,
        channels=[
            FakeChannel(
                "public_hub",
                ChannelOutcome(
                    channel="public_hub",
                    status=ChannelResultStatus.DISCOVERY_PUBLISHED,
                    accepted=True,
                    evidence="listed on hub",
                ),
            ),
            FakeChannel(
                "websub",
                ChannelOutcome(
                    channel="websub",
                    status=ChannelResultStatus.WEBSUB_ACCEPTED,
                    accepted=True,
                    evidence="WEBSUB_ACCEPTED is not INDEXED",
                ),
            ),
        ],
        verifier=IndexVerificationService([ManualVerificationStrategy(unknown)]),
        transport=live_pages(),
    )


def test_backoff_includes_seven_and_fourteen_day_attempts():
    assert DISCOVERY_BACKOFF_SECONDS[0] == 0
    assert DISCOVERY_BACKOFF_SECONDS[1] == 6 * 3600
    assert DISCOVERY_BACKOFF_SECONDS[-2] == 7 * 86400
    assert DISCOVERY_BACKOFF_SECONDS[-1] == 14 * 86400
    assert MAX_DISCOVERY_ATTEMPTS == 7


def test_final_status_does_not_collapse_layers():
    job = type("J", (), {})()
    job.visibility_status = VisibilityStatus.UNKNOWN.value
    job.pipeline_status = PipelineStatus.DISCOVERY_SUBMITTED.value
    job.discovery_stage = "DISCOVERY_PUBLISHED"
    assert final_status_for(job) == "DISCOVERY_SUBMITTED"
    job.visibility_status = VisibilityStatus.DISCOVERED.value
    assert final_status_for(job) == "TARGET_DISCOVERED"
    job.visibility_status = VisibilityStatus.CRAWLED.value
    assert final_status_for(job) == "TARGET_CRAWLED"
    job.visibility_status = VisibilityStatus.INDEXED.value
    job.pipeline_status = PipelineStatus.INDEXED.value
    assert final_status_for(job) == "INDEXED"


def test_max_mode_retry_republishes_then_verifies(monkeypatch):
    monkeypatch.setattr(settings, "max_discovery_mode", True)
    job = type("J", (), {})()
    job.discovery_status = "DISCOVERY_PUBLISHED"
    job.pipeline_status = PipelineStatus.RETRY_PENDING.value
    job.attempt_count = 1
    job.submitted_at = datetime.now(timezone.utc)
    job.experiment_started_at = datetime.now(timezone.utc)
    job.experiment_checkpoint = "T+0"
    action = retry_action_for_job(job, now=datetime.now(timezone.utc))
    assert action.action in {"wait", "retry_and_verify"}


@pytest.mark.anyio
async def test_group_a_still_control_when_max_mode_off(session, monkeypatch):
    engine = _unknown_engine(session, monkeypatch, max_mode=False)
    # FakeChannel injects _channels, which already bypasses the control skip.
    # Prove the skip with real channel selection:
    engine._channels = None
    url = _url_for_group("A")
    job = await engine.submit(TENANT, url, target_url="https://ours.example/")
    assert job.experiment_group == "A"
    assert job.public_listed is False
    assert job.discovery_status == "CONTROL_MONITOR_ONLY"
    assert job.visibility_status != VisibilityStatus.INDEXED.value


@pytest.mark.anyio
async def test_max_discovery_publishes_group_a(session, monkeypatch):
    engine = _unknown_engine(session, monkeypatch, max_mode=True)
    url = _url_for_group("A")
    job = await engine.submit(TENANT, url, target_url="https://ours.example/")
    assert job.experiment_group == "A"
    assert job.public_listed is True
    assert job.discovery_status != "CONTROL_MONITOR_ONLY"
    assert job.channel_snapshot["public_hub"]["accepted"] is True
    assert job.channel_snapshot["websub"]["accepted"] is True
    assert job.channel_snapshot["rss"]["accepted"] is True
    assert job.channel_snapshot["atom"]["accepted"] is True
    assert job.channel_snapshot["json_feed"]["accepted"] is True
    assert job.visibility_status != VisibilityStatus.INDEXED.value
    assert "WEBSUB_ACCEPTED" not in (job.visibility_status or "")


@pytest.mark.anyio
async def test_revalidate_stops_when_backlink_removed(session, monkeypatch):
    engine = _unknown_engine(session, monkeypatch, max_mode=True)
    job = await engine.submit(
        TENANT, "https://src.example/post", target_url="https://ours.example/"
    )
    assert job.backlink_found is True
    import httpx

    from tests.test_indexing_engine import mock_transport

    engine.transport = mock_transport(
        {
            "https://src.example/post": httpx.Response(
                200,
                text="<html><body>no link anymore</body></html>",
                headers={"content-type": "text/html"},
            ),
            "https://src.example/robots.txt": httpx.Response(
                200, text="User-agent: *\nAllow: /\n"
            ),
        }
    )
    job.pipeline_status = PipelineStatus.RETRY_PENDING.value
    stopped = await engine._revalidate_before_retry(job)
    assert stopped is True
    assert job.pipeline_status == PipelineStatus.BACKLINK_REMOVED.value
    assert job.public_listed is False
    assert job.visibility_status != VisibilityStatus.INDEXED.value


@pytest.mark.anyio
async def test_discover_html_is_crawlable_and_has_no_tenant(session):
    now = datetime.now(timezone.utc)
    url = "https://src.example/listed-page"
    job = IndexingJob(
        tenant_id=TENANT,
        source_url=url,
        source_url_hash=url_fingerprint(normalise_url(url) or url),
        pipeline_status=PipelineStatus.DISCOVERY_SUBMITTED.value,
        http_status=200,
        public_listed=True,
        quality_score=80,
        submitted_at=now,
        channel_snapshot={},
        project="public",
        backlink_found=True,
        canonical_status="self",
    )
    session.add(job)
    await session.flush()
    from app.modules.indexing.engine.public_router import public_url_html

    html = await public_url_html(job.source_url_hash, db=session)
    assert html.status_code == 200
    body = html.body.decode("utf-8")
    assert "index,follow" in body
    assert url in body
    assert "/featured" in body
    assert "/discover" in body
    assert TENANT not in body
    assert "Public mention on" in body
    assert "dev-tenant" not in body.lower()
    from app.modules.indexing.engine.public_router import public_url_detail

    payload = await public_url_detail(job.source_url_hash, db=session)
    assert "tenant_id" not in payload
    assert payload["url"] == url


@pytest.mark.anyio
async def test_dashboard_exposes_max_discovery_flag(client, auth_headers, monkeypatch):
    monkeypatch.setattr(settings, "max_discovery_mode", True)
    res = await client.get("/api/indexing/engine/dashboard", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["engine"].startswith("FREE")
    assert "INDEX VERIFICATION" in body["engine"]
    assert body["max_discovery_mode"] is True
    assert body["indexed"] == 0

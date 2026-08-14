"""Production-readiness audit tests for the free discovery engine."""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import httpx
import pytest

from app.modules.indexing.constants import ATTEMPT_FAILED, ATTEMPT_SKIPPED, ATTEMPT_SUCCESS
from app.modules.indexing.engine.backlink_checker import inspect_html
from app.modules.indexing.engine.channels import (
    ChannelOutcome,
    IndexNowChannel,
    PublicHubChannel,
    SitemapChannel,
    WebSubChannel,
)
from app.modules.indexing.engine.feeds import render_rss, url_in_document, FeedItem
from app.modules.indexing.engine.http_probe import CLASS_410, CLASS_EMPTY, OUR_CRAWLER_UA
from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.modules.indexing.engine.states import (
    ChannelResultStatus,
    CrawlEvidenceType,
    PipelineStatus,
    PropertyType,
    VisibilityStatus,
    can_transition,
)
from app.modules.indexing.engine.url_validator import validate_url
from app.modules.indexing.engine.verification import (
    CustomSearchStrategy,
    IndexVerificationService,
    ManualVerificationStrategy,
    SearchConsoleStrategy,
    VerificationResult,
)
from app.modules.indexing.providers import IndexerProvider, ProviderResult

from tests.test_indexing_engine import TENANT, FakeChannel, FakeProvider, live_pages, mock_transport


def test_relative_and_trailing_slash_backlink():
    html = '<a href="/dest/">relative</a>'
    result = inspect_html(
        html, source_url="https://src.example/page", target_url="https://src.example/dest"
    )
    assert result.backlink_found
    assert result.match_type in {"normalized", "exact"}


def test_query_and_fragment_backlink():
    html = '<a href="https://ours.example/x?utm_source=dir#section">x</a>'
    result = inspect_html(
        html, source_url="https://src.example/a", target_url="https://ours.example/x"
    )
    assert result.backlink_found


def test_www_and_apex_backlink():
    html = '<a href="https://www.example.com/" rel="nofollow">example</a>'
    result = inspect_html(
        html, source_url="https://src.example/a", target_url="https://example.com/"
    )
    assert result.backlink_found
    assert "nofollow" in (result.rel_attributes or "")


def test_http_to_https_backlink():
    html = '<a href="http://ours.example/page">x</a>'
    result = inspect_html(
        html, source_url="https://src.example/a", target_url="https://ours.example/page"
    )
    assert result.backlink_found


def test_javascript_generated_backlink_is_not_found():
    html = "<script>document.write('<a href=\"https://ours.example/\">x</a>');</script><p>no static link</p>"
    result = inspect_html(html, source_url="https://src.example/a", target_url="https://ours.example/")
    assert result.backlink_found is False


def test_removed_backlink():
    html = "<html><body><p>the link was removed</p></body></html>"
    result = inspect_html(html, source_url="https://src.example/a", target_url="https://ours.example/")
    assert result.backlink_found is False


def test_multiple_backlinks_recorded():
    html = (
        '<a href="https://ours.example/">one</a>'
        '<a href="https://ours.example/" rel="ugc">two</a>'
    )
    result = inspect_html(html, source_url="https://src.example/a", target_url="https://ours.example/")
    assert result.backlink_found
    assert len(result.links) == 2


@pytest.mark.anyio
async def test_410_and_empty_are_dead():
    transport = mock_transport(
        {
            "gone": httpx.Response(410, text="gone"),
            "empty": httpx.Response(200, text="   ", headers={"content-type": "text/html"}),
        }
    )
    gone = await validate_url("https://gone.example/x", transport=transport)
    assert gone.ok is False
    assert gone.classification == CLASS_410
    empty = await validate_url("https://empty.example/x", transport=transport)
    assert empty.ok is False
    assert empty.classification == CLASS_EMPTY


@pytest.mark.anyio
async def test_websub_accepted_is_not_indexed():
    provider = FakeProvider(
        ProviderResult(
            method="websub",
            status=ATTEMPT_SUCCESS,
            endpoint="https://pubsubhubbub.appspot.com",
            response_code=202,
            request_payload={"hub.mode": "publish", "hub.url": "https://pintdown.site/feed.xml"},
        )
    )
    provider.method = "websub"
    channel = WebSubChannel(provider, feed_contains_url=True)
    result = await channel.submit("https://ex.com/a", property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert result.status == ChannelResultStatus.WEBSUB_ACCEPTED
    assert result.accepted is True
    assert result.status != ChannelResultStatus.SUCCESS or result.payload.get("note")
    assert result.status.value != "INDEXED"
    assert "never INDEXED" in (result.evidence or "")


@pytest.mark.anyio
async def test_websub_unavailable_and_failed():
    skipped = FakeProvider(
        ProviderResult(method="websub", status=ATTEMPT_SKIPPED, endpoint="", error="no feed")
    )
    skipped.method = "websub"
    unavailable = await WebSubChannel(skipped).submit(
        "https://ex.com/a", property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert unavailable.status == ChannelResultStatus.WEBSUB_UNAVAILABLE

    failed = FakeProvider(
        ProviderResult(method="websub", status=ATTEMPT_FAILED, endpoint="h", response_code=500, error="boom")
    )
    failed.method = "websub"
    bad = await WebSubChannel(failed).submit(
        "https://ex.com/a", property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert bad.status == ChannelResultStatus.WEBSUB_FAILED


@pytest.mark.anyio
async def test_gsc_auth_errors_are_unknown():
    async def inspect401(_url, payload):
        return 401, "", "unauthorized"

    expired = SearchConsoleStrategy(
        access_token="tok", site_url="https://ours.example/", inspect=inspect401
    )
    result = await expired.verify(
        "https://ours.example/page", property_type=PropertyType.OWNED_PROPERTY
    )
    assert result is not None
    assert result.status == VisibilityStatus.UNKNOWN.value
    assert result.details.get("reason") == "expired_or_invalid_token"

    async def inspect403(_url, payload):
        return 403, "", "forbidden"

    forbidden = SearchConsoleStrategy(
        access_token="tok", site_url="https://ours.example/", inspect=inspect403
    )
    result = await forbidden.verify(
        "https://ours.example/page", property_type=PropertyType.OWNED_PROPERTY
    )
    assert result.status == VisibilityStatus.UNKNOWN.value
    assert result.details.get("reason") == "unauthorized_property"


@pytest.mark.anyio
async def test_gsc_wrong_property_and_invalid_url():
    strategy = SearchConsoleStrategy(access_token="tok", site_url="https://ours.example/")
    wrong = await strategy.verify(
        "https://other-owned.example/x", property_type=PropertyType.OWNED_PROPERTY
    )
    assert wrong is not None
    assert wrong.status == VisibilityStatus.UNKNOWN.value
    assert wrong.details.get("reason") == "wrong_property"


@pytest.mark.anyio
async def test_indexnow_never_called_for_unowned_host():
    class Exploding(FakeProvider):
        async def submit(self, urls):
            raise AssertionError("IndexNow must not be attempted for third-party hosts")

    channel = IndexNowChannel(
        Exploding(ProviderResult(method="indexnow", status=ATTEMPT_SUCCESS, endpoint="x", response_code=200))
    )
    result = await channel.submit(
        "https://en.wikipedia.org/wiki/Example.com",
        property_type=PropertyType.THIRD_PARTY_BACKLINK,
    )
    assert result.status == ChannelResultStatus.INDEXNOW_NOT_AVAILABLE


def test_feed_contains_submitted_url():
    items = [FeedItem(url="https://en.wikipedia.org/wiki/Example.com", title="wiki")]
    rss = render_rss(items, feed_url="https://pintdown.site/feed.xml")
    assert url_in_document(rss, "https://en.wikipedia.org/wiki/Example.com")
    assert "rel=\"hub\"" in rss or "rel='hub'" in rss or 'rel="hub"' in rss
    assert "pubsubhubbub.appspot.com" in rss


def test_websub_cannot_transition_to_indexed():
    assert can_transition(PipelineStatus.DISCOVERY_SUBMITTED, PipelineStatus.INDEXED) is False
    assert can_transition(PipelineStatus.WAITING_FOR_CRAWL, PipelineStatus.INDEXED) is False


def test_anti_fake_indexed_assignments():
    """INDEXED must only be assigned from verification evidence paths."""
    root = Path(__file__).resolve().parents[1] / "app" / "modules" / "indexing" / "engine"
    offenders = []
    allowed_files = {
        "states.py",  # enum definitions
        "models.py",  # column names
        "dtos.py",
        "reports.py",
        "repository.py",
    }
    for path in root.glob("*.py"):
        text = path.read_text(encoding="utf-8")
        if path.name in allowed_files:
            continue
        if "googlebot" in text.lower() and "OUR_CRAWLER_UA" in text:
            assert "not-Googlebot" in text or path.name in {"crawlability.py", "orchestrator.py"}
        if "pipeline_status = PipelineStatus.INDEXED" in text or 'pipeline_status = "INDEXED"' in text:
            offenders.append(str(path))
    # orchestrator may set INDEXED only inside _apply_verification
    orch = (root / "orchestrator.py").read_text(encoding="utf-8")
    assert "HTTP 200" in orch
    assert orch.count("PipelineStatus.INDEXED") >= 1
    assert "visibility_status = VisibilityStatus.INDEXED" in orch
    # The assignment must be gated on verification result status
    assert "if result.status == VisibilityStatus.INDEXED.value:" in orch
    assert offenders == []


@pytest.mark.anyio
async def test_integration_third_party_ends_at_discovery_not_indexed(session):
    unknown = VerificationResult(
        status=VisibilityStatus.UNKNOWN.value,
        confidence=0.0,
        checked_at=datetime.now(timezone.utc),
        method="none",
        evidence="no evidence",
    )
    engine = IndexingEngine(
        session,
        channels=[
            FakeChannel(
                "public_hub",
                ChannelOutcome(
                    channel="public_hub",
                    status=ChannelResultStatus.DISCOVERY_PUBLISHED,
                    accepted=True,
                    evidence="listed on hub",
                    quality_score=0.35,
                    discovery_stage="DISCOVERY_PUBLISHED",
                    payload={
                        "channel": "PUBLIC_HUB",
                        "submitted_url": "https://src.example/post",
                        "accepted": True,
                        "response_status": 200,
                        "evidence_url": "https://pintdown.site/feed.xml",
                    },
                ),
            ),
            FakeChannel(
                "websub",
                ChannelOutcome(
                    channel="websub",
                    status=ChannelResultStatus.WEBSUB_ACCEPTED,
                    accepted=True,
                    response_code=202,
                    evidence="WEBSUB_ACCEPTED",
                    quality_score=0.45,
                    discovery_stage="DISCOVERY_ACCEPTED",
                ),
            ),
            FakeChannel(
                "indexnow",
                ChannelOutcome(
                    channel="indexnow",
                    status=ChannelResultStatus.INDEXNOW_NOT_AVAILABLE,
                    accepted=False,
                ),
            ),
            FakeChannel(
                "sitemap",
                ChannelOutcome(
                    channel="sitemap",
                    status=ChannelResultStatus.SITEMAP_NOT_AVAILABLE,
                    accepted=False,
                ),
            ),
        ],
        verifier=IndexVerificationService([ManualVerificationStrategy(unknown)]),
        transport=live_pages(),
    )
    job = await engine.submit(
        TENANT,
        "https://src.example/post",
        target_url="https://ours.example/",
        project="integration",
    )
    assert job.pipeline_status != PipelineStatus.INDEXED.value
    assert job.visibility_status != VisibilityStatus.INDEXED.value
    assert job.googlebot_visited is False
    assert job.our_crawler_visited is True
    assert job.channel_snapshot["indexnow"]["status"] == "INDEXNOW_NOT_AVAILABLE"
    assert job.channel_snapshot["sitemap"]["status"] == "SITEMAP_NOT_AVAILABLE"
    assert job.channel_snapshot["websub"]["status"] == "WEBSUB_ACCEPTED"
    detail = await engine.job_detail(TENANT, job.id)
    evidence_types = {row.evidence_type for row in detail["bundles"]["crawl_evidence"]}
    assert CrawlEvidenceType.OUR_CRAWLER.value in evidence_types
    assert all(row.crawler_identity != "Googlebot" for row in detail["bundles"]["crawl_evidence"])

    await engine.record_manual_verification(
        job,
        status="INDEXED",
        evidence="Operator confirmed via Google site: search showing the URL",
        confidence=0.8,
    )
    assert job.pipeline_status == PipelineStatus.INDEXED.value
    assert job.visibility_status == VisibilityStatus.INDEXED.value


@pytest.mark.anyio
async def test_duplicate_url_reuses_job(session):
    engine = IndexingEngine(session, channels=[], transport=live_pages())
    first = await engine.submit(TENANT, "https://src.example/post", target_url="https://ours.example/", run=False)
    second = await engine.submit(TENANT, "https://src.example/post", target_url="https://ours.example/", run=False)
    assert first.id == second.id


@pytest.mark.anyio
async def test_public_feed_and_metrics_endpoints(client, auth_headers, session):
    feed = await client.get("/api/public/feed.xml")
    assert feed.status_code == 200
    assert "application/rss+xml" in feed.headers.get("content-type", "")
    assert "Cache-Control" in feed.headers
    assert 'rel="hub"' in feed.headers.get("link", "")
    missing = await client.get("/api/public/urls/does-not-exist")
    assert missing.status_code == 404
    atom = await client.get("/api/public/atom.xml")
    assert atom.status_code == 200
    hub = await client.get("/api/public/hub")
    assert hub.status_code == 200
    assert "text/html" in hub.headers.get("content-type", "")
    featured = await client.get("/api/public/featured")
    assert featured.status_code == 200
    metrics = await client.get("/api/indexing/engine/metrics", headers=auth_headers)
    assert metrics.status_code == 200
    body = metrics.json()
    assert body["urls_verified_indexed"] == 0
    assert "Verified Index Rate" in body["verified_index_rate_note"]
    assert "DISCOVERY ENGINE" in body["engine_class"]


@pytest.mark.anyio
async def test_cse_miss_stays_unknown():
    async def fetch(_url: str):
        return 200, '{"items": []}', None

    strategy = CustomSearchStrategy(api_key="k", cx="cx", fetch=fetch)
    result = await strategy.verify("https://ex.com/x", property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert result.status == VisibilityStatus.UNKNOWN.value
    assert result.status != VisibilityStatus.NOT_INDEXED.value


@pytest.mark.anyio
async def test_live_third_party_example_com_probe():
    """Real HTTP against IANA example.com. Does not modify the target or spoof Googlebot."""
    from app.modules.indexing.engine.http_probe import probe_url

    result = await probe_url("https://example.com/", timeout=20.0)
    if not result.ok:
        pytest.skip(f"example.com unreachable: {result.error or result.http_status}")
    assert result.http_status == 200
    assert result.our_crawler_visited is True
    assert "not-Googlebot" in OUR_CRAWLER_UA
    assert "Googlebot" not in (result.headers.get("user-agent") or "")

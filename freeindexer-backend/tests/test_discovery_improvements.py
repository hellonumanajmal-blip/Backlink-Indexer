"""Discovery improvements: SSRF, quality gates, feeds, providers, experiments."""
from __future__ import annotations

from datetime import datetime, timezone

import httpx
import pytest

from app.modules.indexing.engine.backlink_checker import inspect_html
from app.modules.indexing.engine.channels import (
    ChannelOutcome,
    GscFeedSitemapChannel,
    SitemapChannel,
)
from app.modules.indexing.engine.crawlability import analyse_crawlability
from app.modules.indexing.engine.discovery_providers import (
    DEPRECATED,
    INDIRECT,
    OWNER_ONLY,
    PROVIDER_CATALOG,
    THIRD_PARTY_SUPPORTED,
    DiscoveryProvider,
    wrap_channels,
)
from app.modules.indexing.engine.experiments import summarize_experiments
from app.modules.indexing.engine.feeds import FeedItem, render_rss
from app.modules.indexing.engine.http_probe import CLASS_SSRF, classify_canonical, probe_url
from app.modules.indexing.engine.js_backlink import inspect_js_backlink
from app.modules.indexing.engine.models import IndexingJob
from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.modules.indexing.engine.quality import (
    assign_experiment_group,
    compute_discovery_score,
    job_is_feed_eligible,
    looks_like_spam,
)
from app.modules.indexing.engine.repository import list_feed_items
from app.modules.indexing.engine.ssrf import inspect_redirect_target, inspect_url
from app.modules.indexing.engine.states import (
    ChannelResultStatus,
    PipelineStatus,
    PropertyType,
    VisibilityStatus,
)
from app.modules.indexing.engine.url_validator import validate_url
from app.modules.indexing.engine.verification import (
    IndexVerificationService,
    ManualVerificationStrategy,
    VerificationResult,
)

from tests.test_indexing_engine import TENANT, FakeChannel, live_pages, mock_transport


def test_ssrf_blocks_localhost_and_metadata():
    assert inspect_url("http://localhost/admin").ok is False
    assert inspect_url("http://127.0.0.1/").ok is False
    assert inspect_url("http://0.0.0.0/").ok is False
    assert inspect_url("http://[::1]/").ok is False
    assert inspect_url("http://169.254.169.254/latest/meta-data/").ok is False
    assert inspect_url("http://10.0.0.5/").ok is False
    assert inspect_url("http://192.168.1.1/").ok is False
    assert inspect_url("http://metadata.google.internal/").ok is False
    assert inspect_url("https://example.com/ok").ok is True


def test_ssrf_rechecks_redirect_target():
    hop = inspect_redirect_target("https://example.com/", "http://127.0.0.1/secret")
    assert hop.ok is False
    hop_ok = inspect_redirect_target("https://example.com/", "https://example.com/next")
    assert hop_ok.ok is True


@pytest.mark.anyio
async def test_probe_blocks_ssrf_and_redirect_to_private():
    blocked = await probe_url("http://127.0.0.1/", transport=mock_transport({}))
    assert blocked.classification == CLASS_SSRF
    assert blocked.ok is False

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "ok.example":
            return httpx.Response(302, headers={"location": "http://127.0.0.1/internal"})
        return httpx.Response(200, text="nope")

    redirected = await probe_url(
        "https://ok.example/from", transport=httpx.MockTransport(handler)
    )
    assert redirected.classification == CLASS_SSRF
    assert "127.0.0.1" in (redirected.error or "")


@pytest.mark.anyio
async def test_validate_ssrf_is_invalid_not_retryable():
    result = await validate_url("http://169.254.169.254/", transport=mock_transport({}))
    assert result.ok is False
    assert result.classification == CLASS_SSRF
    assert result.is_dead


@pytest.mark.anyio
async def test_redirect_301_302_307_308_recorded():
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path == "/a":
            return httpx.Response(301, headers={"location": "https://ok.example/b"})
        if path == "/b":
            return httpx.Response(302, headers={"location": "https://ok.example/c"})
        if path == "/c":
            return httpx.Response(307, headers={"location": "https://ok.example/d"})
        if path == "/d":
            return httpx.Response(308, headers={"location": "https://ok.example/end"})
        return httpx.Response(
            200, text="<html>end</html>", headers={"content-type": "text/html"}
        )

    result = await validate_url("https://ok.example/a", transport=httpx.MockTransport(handler))
    assert result.ok
    assert result.final_url.endswith("/end")
    assert result.redirect_statuses == [301, 302, 307, 308]
    assert len(result.redirect_chain) == 4


@pytest.mark.anyio
async def test_canonical_mismatch_and_multiple():
    html = """<html><head>
      <link rel="canonical" href="https://other.example/canonical">
      <link rel="canonical" href="https://third.example/also">
    </head><body>x</body></html>"""
    transport = mock_transport(
        {
            "https://src.example/page": httpx.Response(
                200, text=html, headers={"content-type": "text/html"}
            ),
            "https://src.example/robots.txt": httpx.Response(404, text=""),
            "https://other.example/canonical": httpx.Response(404, text="gone"),
            "https://third.example/also": httpx.Response(404, text="gone"),
        }
    )
    result = await analyse_crawlability("https://src.example/page", transport=transport)
    assert result.canonical_status in {"multiple", "CANONICAL_MISMATCH"}
    assert result.notes.get("canonical_differs") or result.notes.get("multiple_canonical")


def test_classify_canonical_self_and_mismatch():
    assert classify_canonical("https://a.example/x", ["https://a.example/x"]) == "self"
    assert (
        classify_canonical("https://a.example/x", ["https://b.example/y"])
        == "CANONICAL_MISMATCH"
    )
    assert classify_canonical("https://a.example/x", []) == "missing"


def test_js_backlink_is_separate_from_static():
    html = "<script>document.write('<a href=\"https://ours.example/\">x</a>');</script><p>no static</p>"
    static = inspect_html(html, source_url="https://src.example/a", target_url="https://ours.example/")
    js = inspect_js_backlink(html, target_url="https://ours.example/")
    assert static.backlink_found is False
    assert js.backlink_found is True
    assert js.match_type == "JS_BACKLINK_FOUND"


def test_json_ld_backlink():
    html = """<script type="application/ld+json">{"url":"https://ours.example/page"}</script>"""
    js = inspect_js_backlink(html, target_url="https://ours.example/page")
    assert js.backlink_found


def test_discovery_score_is_not_index_probability():
    score = compute_discovery_score(
        http_ok=True,
        backlink_found=True,
        robots_allowed=True,
        noindex=False,
        canonical_status="self",
        feed_published=True,
        submitted_at=datetime.now(timezone.utc),
    )
    assert "not an indexing probability" in score.as_dict()["meaning"].lower()
    assert 0 <= score.score <= 100


def test_spam_and_feed_eligibility():
    assert looks_like_spam("http://1.2.3.4/x")
    job = type("J", (), {})()
    job.project = "private-client"
    job.public_listed = True
    job.pipeline_status = "DISCOVERY_SUBMITTED"
    job.http_status = 200
    job.target_url = None
    job.source_url = "https://ok.example/page"
    job.backlink_found = None
    assert job_is_feed_eligible(job) is False
    job.project = "public"
    assert job_is_feed_eligible(job) is True


def test_experiment_groups_are_stable():
    h = "abcdef12" + "0" * 56
    assert assign_experiment_group(h) == assign_experiment_group(h)
    assert assign_experiment_group(h) in {"A", "B", "C", "D"}


def test_feed_does_not_fake_freshness():
    ts = datetime(2026, 1, 2, 3, 4, 5, tzinfo=timezone.utc)
    items = [FeedItem(url="https://ex.example/a", title="a", updated=ts, id="https://ex.example/a")]
    first = render_rss(items)
    second = render_rss(items)
    assert first == second
    assert "Fri, 02 Jan 2026" in first
    assert '<guid isPermaLink="true">https://ex.example/a</guid>' in first


def test_provider_catalog_classifies_ownership():
    assert PROVIDER_CATALOG["public_hub"].availability == THIRD_PARTY_SUPPORTED
    assert PROVIDER_CATALOG["public_hub"].signal == INDIRECT
    assert PROVIDER_CATALOG["indexnow"].availability == OWNER_ONLY
    assert PROVIDER_CATALOG["sitemap"].availability == OWNER_ONLY
    assert PROVIDER_CATALOG["google_sitemap_ping"].availability == DEPRECATED
    assert PROVIDER_CATALOG["google_blog_search_ping"].availability == DEPRECATED
    assert PROVIDER_CATALOG["pingomatic"].availability == "UNAVAILABLE"


@pytest.mark.anyio
async def test_deprecated_ping_provider_is_never_called():
    class Boom:
        name = "google_sitemap_ping"

        async def submit(self, url, *, property_type):
            raise AssertionError("deprecated ping must not be called")

    wrapped = DiscoveryProvider(Boom())
    out = await wrapped.submit("https://ex.example/", property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert out.status == ChannelResultStatus.SKIPPED
    assert "DEPRECATED" in (out.error or "")


@pytest.mark.anyio
async def test_indexnow_wrapper_blocks_third_party():
    class Fake:
        name = "indexnow"

        async def submit(self, url, *, property_type):
            raise AssertionError("must not submit third-party to IndexNow")

    out = await DiscoveryProvider(Fake()).submit(
        "https://other.com/x", property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert out.status == ChannelResultStatus.INDEXNOW_NOT_AVAILABLE


@pytest.mark.anyio
async def test_gsc_feed_sitemap_submits_our_feed_not_item():
    channel = GscFeedSitemapChannel(
        access_token="tok",
        site_url="https://pintdown.site/",
        feed_url="https://pintdown.site/feed.xml",
        enabled=True,
        transport=httpx.MockTransport(lambda request: httpx.Response(200, text="{}")),
    )
    GscFeedSitemapChannel._last_submit_monotonic = 0.0
    out = await channel.submit(
        "https://third.example/post", property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert out.accepted
    assert out.payload["submitted_url"] == "https://pintdown.site/feed.xml"
    assert out.payload["item_url"] == "https://third.example/post"


def test_no_deprecated_google_ping_in_engine_source():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "app" / "modules" / "indexing" / "engine"
    blob = ""
    for path in root.glob("*.py"):
        blob += path.read_text(encoding="utf-8")
    assert "webmasters/tools/ping" not in blob
    assert "rpc.pingomatic.com" not in blob
    assert "blogsearch.google.com" not in blob


@pytest.mark.anyio
async def test_quality_gate_keeps_failures_off_public_feed(session):
    engine = IndexingEngine(session, channels=[], transport=live_pages())
    job = await engine.submit(
        TENANT,
        "https://noindex.example/x",
        project="demo",
    )
    assert job.pipeline_status == PipelineStatus.NOINDEX.value
    assert job.public_listed is False
    items = await list_feed_items(session, limit=50)
    assert all(item.url != job.source_url for item in items)


@pytest.mark.anyio
async def test_public_hash_page_hides_private_jobs(session):
    from app.modules.indexing.engine.repository import get_public_by_hash

    job = IndexingJob(
        tenant_id=TENANT,
        source_url="https://ok.example/listed",
        source_url_hash="abc123public",
        pipeline_status=PipelineStatus.DISCOVERY_SUBMITTED.value,
        http_status=200,
        public_listed=True,
        backlink_found=True,
        submitted_at=datetime.now(timezone.utc),
        channel_snapshot={},
        project="public",
    )
    session.add(job)
    private = IndexingJob(
        tenant_id=TENANT,
        source_url="https://ok.example/secret",
        source_url_hash="secret999",
        pipeline_status=PipelineStatus.DISCOVERY_SUBMITTED.value,
        http_status=200,
        public_listed=False,
        project="private-client",
        channel_snapshot={},
        submitted_at=datetime.now(timezone.utc),
    )
    session.add(private)
    await session.flush()
    found = await get_public_by_hash(session, "abc123public")
    assert found is not None
    assert found.source_url == "https://ok.example/listed"
    hidden = await get_public_by_hash(session, "secret999")
    assert hidden is None
    items = await list_feed_items(session, limit=50)
    urls = {item.url for item in items}
    assert "https://ok.example/listed" in urls
    assert "https://ok.example/secret" not in urls


@pytest.mark.anyio
async def test_pipeline_sets_experiment_and_discovery_score(session):
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
                ),
            )
        ],
        verifier=IndexVerificationService([ManualVerificationStrategy(unknown)]),
        transport=live_pages(),
    )
    job = await engine.submit(
        TENANT,
        "https://src.example/post",
        target_url="https://ours.example/",
        project="demo",
    )
    assert job.experiment_group in {"A", "B", "C", "D"}
    assert job.discovery_score is not None
    assert job.canonical_status in {"self", "missing", "CANONICAL_MISMATCH", "multiple"}
    assert job.backlink_found is True
    assert job.quality_score is not None
    assert job.workflow_stage
    summary = summarize_experiments([job])
    assert "note" in summary
    assert summary["groups"][job.experiment_group]["n"] == 1


@pytest.mark.anyio
async def test_sitemap_still_owner_only():
    result = await SitemapChannel("https://ours.example/sitemap.xml").submit(
        "https://other.com/x", property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert result.status.value == "SITEMAP_NOT_AVAILABLE"


def test_wrap_channels_preserves_names():
    wrapped = wrap_channels([SitemapChannel("https://ours.example/sitemap.xml")])
    assert wrapped[0].name == "sitemap"
    assert wrapped[0].requires_ownership is True

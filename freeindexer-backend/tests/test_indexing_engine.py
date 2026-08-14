"""Tests for the free self-hosted indexing engine.

These tests prove INDEXED is never inferred from HTTP 200, our crawler, a
discovery POST, or a sitemap listing.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.modules.indexing.engine.backlink_checker import inspect_html
from app.modules.indexing.engine.channels import (
    ChannelOutcome,
    DiscoveryChannel,
    IndexNowChannel,
    PublicHubChannel,
    SitemapChannel,
)
from app.modules.indexing.engine.crawlability import analyse_crawlability, parse_robots_txt
from app.modules.indexing.engine.http_probe import OUR_CRAWLER_UA, CLASS_OK, probe_url
from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.modules.indexing.engine.retry_schedule import (
    DISCOVERY_BACKOFF_SECONDS,
    MAX_DISCOVERY_ATTEMPTS,
    next_retry_at,
    should_retry,
)
from app.modules.indexing.engine.states import (
    InvalidTransition,
    PipelineStatus,
    PropertyType,
    VisibilityStatus,
    assert_transition,
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


TENANT = "tenant-1"


def mock_transport(pages: dict[str, httpx.Response]):
    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        for fragment, response in pages.items():
            if fragment in url:
                return response
        return httpx.Response(404, text="not found")

    return httpx.MockTransport(handler)


class FakeChannel(DiscoveryChannel):
    def __init__(self, name: str, outcome: ChannelOutcome) -> None:
        self.name = name
        self.outcome = outcome

    async def submit(self, url: str, *, property_type: PropertyType) -> ChannelOutcome:
        return self.outcome


class FakeProvider(IndexerProvider):
    method = "indexnow"

    def __init__(self, result: ProviderResult) -> None:
        self._result = result

    @property
    def endpoint(self) -> str:
        return "https://api.indexnow.org/indexnow"

    @property
    def enabled(self) -> bool:
        return True

    @property
    def configured(self) -> bool:
        return True

    async def submit(self, urls):
        return self._result


# ---------------------------------------------------------------------------
# State machine
# ---------------------------------------------------------------------------
def test_happy_path_transitions_are_legal():
    path = [
        PipelineStatus.RECEIVED,
        PipelineStatus.VALIDATING,
        PipelineStatus.VALIDATED,
        PipelineStatus.BACKLINK_CHECK,
        PipelineStatus.BACKLINK_VERIFIED,
        PipelineStatus.CRAWLABILITY_CHECK,
        PipelineStatus.DISCOVERY_QUEUED,
        PipelineStatus.DISCOVERY_SUBMITTED,
        PipelineStatus.WAITING_FOR_CRAWL,
        PipelineStatus.VERIFICATION_PENDING,
        PipelineStatus.INDEXED,
    ]
    for current, nxt in zip(path, path[1:]):
        assert_transition(current, nxt)


def test_invalid_transition_is_rejected():
    assert can_transition(PipelineStatus.RECEIVED, PipelineStatus.INDEXED) is False
    with pytest.raises(InvalidTransition):
        assert_transition(PipelineStatus.VALIDATING, PipelineStatus.INDEXED)
    with pytest.raises(InvalidTransition):
        assert_transition(PipelineStatus.DISCOVERY_SUBMITTED, PipelineStatus.INDEXED)


def test_terminal_failures_have_no_outbound_edges():
    for state in (
        PipelineStatus.INVALID_URL,
        PipelineStatus.URL_UNREACHABLE,
        PipelineStatus.BACKLINK_NOT_FOUND,
        PipelineStatus.ROBOTS_BLOCKED,
        PipelineStatus.NOINDEX,
        PipelineStatus.INDEXED,
    ):
        assert list(__import__("app.modules.indexing.engine.states", fromlist=["ALLOWED_TRANSITIONS"]).ALLOWED_TRANSITIONS[state]) == []


# ---------------------------------------------------------------------------
# URL validation
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_validate_valid_url():
    transport = mock_transport(
        {"https://ok.example/page": httpx.Response(200, text="<html>ok</html>", headers={"content-type": "text/html"})}
    )
    result = await validate_url("https://ok.example/page", transport=transport)
    assert result.ok
    assert result.http_status == 200
    assert result.classification == CLASS_OK
    assert result.probe and result.probe.our_crawler_visited


@pytest.mark.anyio
async def test_validate_invalid_url():
    result = await validate_url("not-a-url")
    assert result.ok is False
    assert result.classification == "invalid_url"


@pytest.mark.anyio
async def test_validate_404():
    transport = mock_transport({"dead": httpx.Response(404, text="gone")})
    result = await validate_url("https://dead.example/x", transport=transport)
    assert result.ok is False
    assert result.http_status == 404
    assert result.is_dead


@pytest.mark.anyio
async def test_validate_500():
    transport = mock_transport({"oops": httpx.Response(500, text="err")})
    result = await validate_url("https://oops.example/x", transport=transport)
    assert result.ok is False
    assert result.http_status == 500


@pytest.mark.anyio
async def test_validate_redirect():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/from":
            return httpx.Response(302, headers={"location": "https://ok.example/to"})
        return httpx.Response(200, text="<html>landed</html>", headers={"content-type": "text/html"})

    result = await validate_url("https://ok.example/from", transport=httpx.MockTransport(handler))
    assert result.ok
    assert result.final_url.endswith("/to")
    assert result.redirect_chain


@pytest.mark.anyio
async def test_probe_timeout_classification(monkeypatch):
    class Boom:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        def build_request(self, *a, **k):
            return object()

        async def send(self, *a, **k):
            raise httpx.TimeoutException("timed out")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kwargs: Boom())
    result = await probe_url("https://slow.example/")
    assert result.ok is False
    assert result.classification == "timeout"
    assert result.our_crawler_visited is False


@pytest.mark.anyio
async def test_our_crawler_user_agent_is_not_googlebot():
    assert "Googlebot" not in OUR_CRAWLER_UA or "not-Googlebot" in OUR_CRAWLER_UA
    assert "not-Googlebot" in OUR_CRAWLER_UA


# ---------------------------------------------------------------------------
# Backlink detection
# ---------------------------------------------------------------------------
def test_exact_backlink():
    html = '<html><body><p>See <a href="https://ours.example/">Home</a> here</p></body></html>'
    result = inspect_html(html, source_url="https://src.example/a", target_url="https://ours.example/")
    assert result.backlink_found
    assert result.match_type == "exact"
    assert result.anchor_text == "Home"


def test_normalized_backlink():
    html = '<a href="HTTPS://Ours.Example/Path">x</a>'
    result = inspect_html(
        html, source_url="https://src.example/a", target_url="https://ours.example/Path"
    )
    assert result.backlink_found
    assert result.match_type in {"normalized", "exact"}


def test_redirect_backlink_matches_final_target():
    html = '<a href="https://ours.example/old">x</a>'
    result = inspect_html(
        html,
        source_url="https://src.example/a",
        target_url="https://ours.example/new",
        target_final="https://ours.example/old",
    )
    assert result.backlink_found
    assert result.match_type == "redirect"


def test_no_backlink():
    html = '<a href="https://other.example/">nope</a>'
    result = inspect_html(html, source_url="https://src.example/a", target_url="https://ours.example/")
    assert result.backlink_found is False
    assert result.status == "BACKLINK_NOT_FOUND"


def test_nofollow_sponsored_ugc_rel():
    html = (
        '<a href="https://ours.example/" rel="nofollow sponsored ugc">paid</a>'
    )
    result = inspect_html(html, source_url="https://src.example/a", target_url="https://ours.example/")
    assert result.backlink_found
    rel = (result.rel_attributes or "").split()
    assert "nofollow" in rel
    assert "sponsored" in rel
    assert "ugc" in rel


# ---------------------------------------------------------------------------
# Robots / crawlability
# ---------------------------------------------------------------------------
def test_robots_allowed_and_disallowed():
    body = "User-agent: *\nDisallow: /secret\nAllow: /public\n"
    assert parse_robots_txt(body, "https://ex.com/public") is True
    assert parse_robots_txt(body, "https://ex.com/secret") is False


@pytest.mark.anyio
async def test_noindex_meta_and_x_robots():
    html = '<html><head><meta name="robots" content="noindex, nofollow"></head><body>x</body></html>'
    page = httpx.Response(
        200,
        text=html,
        headers={"content-type": "text/html", "x-robots-tag": "noindex"},
    )
    robots = httpx.Response(404, text="missing")
    transport = mock_transport(
        {
            "https://ex.example/page": page,
            "https://ex.example/robots.txt": robots,
        }
    )
    result = await analyse_crawlability("https://ex.example/page", transport=transport)
    assert result.noindex is True
    assert result.blocked_for_discovery == "NOINDEX"
    assert result.x_robots_tag and "noindex" in result.x_robots_tag.lower()


@pytest.mark.anyio
async def test_crawlability_score_bands():
    html = """<html><head><link rel="canonical" href="https://ex.example/ok">
    <meta name="robots" content="index,follow"></head><body>hello</body></html>"""
    transport = mock_transport(
        {
            "https://ex.example/ok": httpx.Response(
                200, text=html, headers={"content-type": "text/html"}
            ),
            "robots.txt": httpx.Response(200, text="User-agent: *\nAllow: /\n"),
        }
    )
    result = await analyse_crawlability("https://ex.example/ok", transport=transport)
    assert 0 <= result.score <= 100
    assert result.band in {"Very Poor", "Poor", "Moderate", "Good", "Strong"}
    assert result.noindex is False


# ---------------------------------------------------------------------------
# Discovery channels
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_channel_success_requires_acceptance():
    channel = PublicHubChannel(listed=True, hub_url="https://pintdown.site/featured")
    ok = await channel.submit("https://ex.com/a", property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert ok.status.value == "DISCOVERY_PUBLISHED"
    assert ok.accepted is True

    failed = await PublicHubChannel(listed=False).submit(
        "https://ex.com/a", property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert failed.status.value == "FAILED"
    assert failed.accepted is False


@pytest.mark.anyio
async def test_indexnow_not_available_for_third_party():
    provider = FakeProvider(
        ProviderResult(method="indexnow", status="success", endpoint="x", response_code=200)
    )
    channel = IndexNowChannel(provider)
    result = await channel.submit(
        "https://reddit.com/r/x", property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert result.status.value == "INDEXNOW_NOT_AVAILABLE"
    assert result.accepted is False


@pytest.mark.anyio
async def test_channel_rate_limited_and_unavailable():
    limited = FakeChannel(
        "websub",
        ChannelOutcome(channel="websub", status=__import__("app.modules.indexing.engine.states", fromlist=["ChannelResultStatus"]).ChannelResultStatus.RATE_LIMITED, accepted=False),
    )
    unavailable = FakeChannel(
        "websub",
        ChannelOutcome(channel="websub", status=__import__("app.modules.indexing.engine.states", fromlist=["ChannelResultStatus"]).ChannelResultStatus.UNAVAILABLE, accepted=False),
    )
    assert (await limited.submit("https://a.com", property_type=PropertyType.OWNED_PROPERTY)).status.value == "RATE_LIMITED"
    assert (await unavailable.submit("https://a.com", property_type=PropertyType.OWNED_PROPERTY)).status.value == "UNAVAILABLE"


@pytest.mark.anyio
async def test_sitemap_skips_third_party():
    result = await SitemapChannel("https://ours.example/sitemap.xml").submit(
        "https://other.com/x", property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert result.status.value == "SITEMAP_NOT_AVAILABLE"
    assert result.accepted is False


# ---------------------------------------------------------------------------
# Retry
# ---------------------------------------------------------------------------
def test_exponential_backoff_schedule():
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    first = next_retry_at(1, now=t0)
    second = next_retry_at(2, now=t0)
    third = next_retry_at(3, now=t0)
    assert first == t0
    assert second == t0 + timedelta(seconds=DISCOVERY_BACKOFF_SECONDS[1])
    assert third == t0 + timedelta(seconds=DISCOVERY_BACKOFF_SECONDS[2])
    assert DISCOVERY_BACKOFF_SECONDS[1] < DISCOVERY_BACKOFF_SECONDS[2]


def test_max_attempts_and_terminal_no_retry():
    assert should_retry(PipelineStatus.DISCOVERY_FAILED, 1) is True
    assert should_retry(PipelineStatus.DISCOVERY_FAILED, MAX_DISCOVERY_ATTEMPTS) is False
    assert should_retry(PipelineStatus.INVALID_URL, 1) is False
    assert should_retry(PipelineStatus.NOINDEX, 1) is False
    assert should_retry(PipelineStatus.BACKLINK_NOT_FOUND, 1) is False


# ---------------------------------------------------------------------------
# Verification — anti-fake
# ---------------------------------------------------------------------------
@pytest.mark.anyio
async def test_http_200_is_not_indexed():
    verifier = IndexVerificationService([])
    result = await verifier.verify(
        "https://ex.com/ok",
        property_type=PropertyType.THIRD_PARTY_BACKLINK,
        http_ok=True,
        our_crawler_visited=True,
        discovery_submitted=True,
    )
    assert result.status == VisibilityStatus.UNKNOWN.value
    assert result.confidence == 0.0
    assert "HTTP 200" in result.evidence
    assert "OUR_CRAWLER_VISITED" in result.evidence


@pytest.mark.anyio
async def test_cse_miss_is_unknown_not_not_indexed():
    async def fetch(_url: str):
        return 200, '{"items": []}', None

    strategy = CustomSearchStrategy(api_key="k", cx="cx", fetch=fetch)
    result = await strategy.verify("https://ex.com/x", property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert result is not None
    assert result.status == VisibilityStatus.UNKNOWN.value


@pytest.mark.anyio
async def test_cse_hit_is_indexed_with_moderate_confidence():
    async def fetch(_url: str):
        return 200, '{"items": [{"link": "https://ex.com/x"}]}', None

    strategy = CustomSearchStrategy(api_key="k", cx="cx", fetch=fetch)
    result = await strategy.verify("https://ex.com/x", property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert result is not None
    assert result.status == VisibilityStatus.INDEXED.value
    assert result.confidence < 0.9


@pytest.mark.anyio
async def test_gsc_owned_indexed():
    async def inspect(_url, payload):
        body = '{"inspectionResult": {"indexStatusResult": {"coverageState": "Submitted and indexed", "verdict": "PASS", "lastCrawlTime": "2026-01-01T00:00:00Z"}}}'
        return 200, body, None

    strategy = SearchConsoleStrategy(access_token="tok", site_url="https://ours.example/", inspect=inspect)
    result = await strategy.verify(
        "https://ours.example/page", property_type=PropertyType.OWNED_PROPERTY
    )
    assert result is not None
    assert result.status == VisibilityStatus.INDEXED.value
    assert result.googlebot_visited is True
    assert result.confidence >= 0.9


@pytest.mark.anyio
async def test_gsc_skipped_for_third_party():
    strategy = SearchConsoleStrategy(access_token="tok", site_url="https://ours.example/")
    result = await strategy.verify(
        "https://other.com/x", property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert result is None


@pytest.mark.anyio
async def test_low_confidence_cannot_claim_indexed():
    weak = VerificationResult(
        status=VisibilityStatus.INDEXED.value,
        confidence=0.2,
        checked_at=datetime.now(timezone.utc),
        method="guess",
        evidence="weak",
    )
    verifier = IndexVerificationService([ManualVerificationStrategy(weak)])
    result = await verifier.verify("https://x.com", property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert result.status == VisibilityStatus.UNKNOWN.value


# ---------------------------------------------------------------------------
# Full pipeline
# ---------------------------------------------------------------------------
HTML_WITH_LINK = """
<html><head><link rel="canonical" href="https://src.example/post">
<meta name="robots" content="index,follow"></head>
<body>Read more at <a href="https://ours.example/">Ours</a></body></html>
"""


def live_pages():
    return mock_transport(
        {
            "https://src.example/post": httpx.Response(
                200, text=HTML_WITH_LINK, headers={"content-type": "text/html"}
            ),
            "https://src.example/robots.txt": httpx.Response(
                200, text="User-agent: *\nAllow: /\n"
            ),
            "https://src.example/missing": httpx.Response(200, text="<html><body>no link</body></html>", headers={"content-type": "text/html"}),
            "https://dead.example/x": httpx.Response(404, text="nope"),
            "https://dead.example/robots.txt": httpx.Response(404, text=""),
            "https://noindex.example/x": httpx.Response(
                200,
                text='<html><head><meta name="robots" content="noindex"></head><body>x</body></html>',
                headers={"content-type": "text/html"},
            ),
            "https://noindex.example/robots.txt": httpx.Response(404, text=""),
        }
    )


@pytest.mark.anyio
async def test_pipeline_does_not_mark_indexed_without_verification(session):
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
                    status=__import__(
                        "app.modules.indexing.engine.states", fromlist=["ChannelResultStatus"]
                    ).ChannelResultStatus.SUCCESS,
                    accepted=True,
                    evidence="listed",
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
    assert job.http_status == 200
    assert job.our_crawler_visited is True
    assert job.googlebot_visited is False
    assert job.visibility_status != VisibilityStatus.INDEXED.value
    assert job.pipeline_status != PipelineStatus.INDEXED.value
    assert job.backlink_found is True
    assert job.discovery_status in {
        "DISCOVERY_PUBLISHED",
        "SUCCESS",
        "DISCOVERY_ACCEPTED",
        "DISCOVERY_VERIFIED",
    }
    assert job.visibility_status in {
        VisibilityStatus.UNKNOWN.value,
        VisibilityStatus.NOT_INDEXED.value,
        VisibilityStatus.CRAWLED.value,
    }
    from app.modules.indexing.engine.repository import timeline

    events = await timeline(session, job.id)
    assert any(e.to_status == PipelineStatus.DISCOVERY_SUBMITTED.value for e in events)


@pytest.mark.anyio
async def test_pipeline_backlink_not_found_skips_discovery(session):
    engine = IndexingEngine(
        session,
        channels=[
            FakeChannel(
                "public_hub",
                ChannelOutcome(
                    channel="public_hub",
                    status=__import__(
                        "app.modules.indexing.engine.states", fromlist=["ChannelResultStatus"]
                    ).ChannelResultStatus.SUCCESS,
                    accepted=True,
                ),
            )
        ],
        transport=live_pages(),
    )
    job = await engine.submit(
        TENANT, "https://src.example/missing", target_url="https://ours.example/"
    )
    assert job.pipeline_status == PipelineStatus.BACKLINK_NOT_FOUND.value
    assert job.discovery_status is None


@pytest.mark.anyio
async def test_pipeline_404_is_unreachable(session):
    engine = IndexingEngine(session, channels=[], transport=live_pages())
    job = await engine.submit(TENANT, "https://dead.example/x")
    assert job.pipeline_status == PipelineStatus.URL_UNREACHABLE.value


@pytest.mark.anyio
async def test_pipeline_noindex_stops(session):
    engine = IndexingEngine(session, channels=[], transport=live_pages())
    job = await engine.submit(TENANT, "https://noindex.example/x")
    assert job.pipeline_status == PipelineStatus.NOINDEX.value


@pytest.mark.anyio
async def test_manual_indexed_requires_evidence(session):
    unknown = VerificationResult(
        status=VisibilityStatus.UNKNOWN.value,
        confidence=0.0,
        checked_at=datetime.now(timezone.utc),
        method="none",
        evidence="none",
    )
    engine = IndexingEngine(
        session,
        channels=[
            FakeChannel(
                "public_hub",
                ChannelOutcome(
                    channel="public_hub",
                    status=__import__(
                        "app.modules.indexing.engine.states", fromlist=["ChannelResultStatus"]
                    ).ChannelResultStatus.SUCCESS,
                    accepted=True,
                ),
            )
        ],
        verifier=IndexVerificationService([ManualVerificationStrategy(unknown)]),
        transport=live_pages(),
    )
    job = await engine.submit(TENANT, "https://src.example/post", target_url="https://ours.example/")
    with pytest.raises(ValueError):
        await engine.record_manual_verification(
            job, status="INDEXED", evidence="", googlebot_visited=True
        )
    await engine.record_manual_verification(
        job,
        status="INDEXED",
        evidence="Operator confirmed via Google site: search showing the URL",
        confidence=0.8,
    )
    assert job.pipeline_status == PipelineStatus.INDEXED.value
    assert job.visibility_status == VisibilityStatus.INDEXED.value


@pytest.mark.anyio
async def test_engine_api_dashboard(client, auth_headers, session):
    # The API client uses a different session than `session`; just hit the
    # dashboard which must not claim indexed URLs on an empty DB.
    res = await client.get("/api/indexing/engine/dashboard", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()
    assert body["engine"].startswith("FREE")
    assert "INDEX VERIFICATION" in body["engine"]
    assert body["indexed"] == 0
    assert "cannot force" in body["disclaimer"].lower()

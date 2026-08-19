"""Crawler evidence: UA classification, Googlebot DNS verification,
access-log middleware, sitemap/robots, canonical URLs, and the
crawler_evidence verification strategy."""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.config import settings
from app.database import get_db
from app.modules.indexing.engine.models import CrawlEvidence, DiscoveryAccessLog, IndexingJob
from app.modules.indexing.engine.states import CrawlEvidenceType, PipelineStatus, PropertyType
from app.modules.indexing.engine.verification import (
    CrawlerEvidenceStrategy,
    IndexVerificationService,
)
from app.modules.indexing.indexer_dispatch import normalise_url, url_fingerprint

TENANT = "tenant-1"
GOOGLEBOT_UA = (
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
)


def _fingerprint(url: str) -> str:
    return url_fingerprint(normalise_url(url) or url)


async def _settled_rows(factory, predicate=None, timeout=0.5):
    """Read access-log rows once the request's transaction has committed.

    The row is persisted by the ``persist_crawler_evidence`` dependency inside
    the request's own session, so it is committed by the time the client
    receives the response; a short settle keeps the read deterministic.
    """
    await asyncio.sleep(timeout)
    async with factory() as session:
        rows = list((await session.execute(select(DiscoveryAccessLog))).scalars().all())
    return [r for r in rows if predicate(r)] if predicate else rows


def _listed_job(url: str, url_hash: str) -> IndexingJob:
    return IndexingJob(
        tenant_id=TENANT,
        source_url=url,
        source_url_hash=url_hash,
        pipeline_status=PipelineStatus.DISCOVERY_SUBMITTED.value,
        http_status=200,
        backlink_found=True,
        public_listed=True,
        submitted_at=datetime.now(timezone.utc),
        channel_snapshot={},
        project="public",
        quality_score=70,
    )


# --------------------------------------------------------------------------- #
# UA classification
# --------------------------------------------------------------------------- #


def test_classify_user_agent():
    from app.middleware.crawler_evidence import classify_user_agent

    assert classify_user_agent(GOOGLEBOT_UA) == "googlebot"
    assert classify_user_agent("Googlebot-Image/1.0") == "googlebot"
    assert classify_user_agent("Mozilla/5.0 (compatible; bingbot/2.0)") == "bingbot"
    assert classify_user_agent("Mozilla/5.0 (compatible; AhrefsBot/7.0)") == "other_crawler"
    assert classify_user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120") == "browser"
    assert classify_user_agent("") == "unknown_bot"
    assert classify_user_agent(None) == "unknown_bot"


def test_hash_ip_is_salted_and_stable():
    from app.middleware.crawler_evidence import hash_ip

    first = hash_ip("66.249.66.1", salt="salt")
    second = hash_ip("66.249.66.1", salt="salt")
    assert first == second
    assert hash_ip("66.249.66.1", salt="other") != first
    assert hash_ip(None, salt="salt") is None
    assert first != "66.249.66.1"


def test_url_hash_from_path():
    from app.middleware.crawler_evidence import url_hash_from_path

    assert url_hash_from_path(f"{settings.api_v1_prefix}/public/url/abc123") == "abc123"
    assert url_hash_from_path(f"{settings.api_v1_prefix}/public/urls/abc123") == "abc123"
    assert url_hash_from_path(f"{settings.api_v1_prefix}/public/hub") is None
    assert url_hash_from_path("/robots.txt") is None


# --------------------------------------------------------------------------- #
# Googlebot DNS verification (mocked sockets)
# --------------------------------------------------------------------------- #


def test_googlebot_dns_verify_passes(monkeypatch):
    from app.middleware.crawler_evidence import _verify_googlebot_dns_sync

    monkeypatch.setattr(
        "app.middleware.crawler_evidence.socket.gethostbyaddr",
        lambda ip: ("crawl-66-249-66-1.googlebot.com", [], ["66.249.66.1"]),
    )
    monkeypatch.setattr(
        "app.middleware.crawler_evidence.socket.getaddrinfo",
        lambda host, port: [(None, None, None, None, ("66.249.66.1", 0))],
    )
    ok, hostname = _verify_googlebot_dns_sync("66.249.66.1")
    assert ok is True
    assert hostname == "crawl-66-249-66-1.googlebot.com"


def test_googlebot_dns_verify_rejects_wrong_ptr_suffix(monkeypatch):
    from app.middleware.crawler_evidence import _verify_googlebot_dns_sync

    monkeypatch.setattr(
        "app.middleware.crawler_evidence.socket.gethostbyaddr",
        lambda ip: ("66.249.66.1.bc.googleusercontent.com", [], ["66.249.66.1"]),
    )
    ok, hostname = _verify_googlebot_dns_sync("66.249.66.1")
    assert ok is False
    assert hostname == "66.249.66.1.bc.googleusercontent.com"


def test_googlebot_dns_verify_rejects_forward_mismatch(monkeypatch):
    from app.middleware.crawler_evidence import _verify_googlebot_dns_sync

    monkeypatch.setattr(
        "app.middleware.crawler_evidence.socket.gethostbyaddr",
        lambda ip: ("crawl-66-249-66-1.googlebot.com", [], ["66.249.66.1"]),
    )
    monkeypatch.setattr(
        "app.middleware.crawler_evidence.socket.getaddrinfo",
        lambda host, port: [(None, None, None, None, ("8.8.8.8", 0))],
    )
    ok, _hostname = _verify_googlebot_dns_sync("66.249.66.1")
    assert ok is False


def test_googlebot_dns_verify_handles_dns_failure(monkeypatch):
    from app.middleware.crawler_evidence import _verify_googlebot_dns_sync

    def boom(*_args):
        raise OSError("no PTR")

    monkeypatch.setattr("app.middleware.crawler_evidence.socket.gethostbyaddr", boom)
    ok, hostname = _verify_googlebot_dns_sync("66.249.66.1")
    assert ok is False
    assert hostname is None


# --------------------------------------------------------------------------- #
# Strategy
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_crawler_evidence_strategy_returns_crawled(engine, monkeypatch):
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    url = "https://ok.example/post"
    url_hash = _fingerprint(url)
    async with factory() as session:
        session.add(_listed_job(url, url_hash))
        session.add(
            DiscoveryAccessLog(
                url_hash=url_hash,
                requested_url=f"http://test/api/public/url/{url_hash}",
                requested_path=f"/api/public/url/{url_hash}",
                user_agent=GOOGLEBOT_UA,
                ua_class="googlebot",
                ip_hash="x",
                status_code=200,
                verified_googlebot=True,
                googlebot_hostname="crawl-66-249-66-1.googlebot.com",
                verification_source="reverse_forward_dns",
            )
        )
        await session.commit()

    monkeypatch.setattr(settings, "crawler_evidence_enabled", True)
    strategy = CrawlerEvidenceStrategy(session_factory=factory)
    result = await strategy.verify(url, property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert result is not None
    assert result.status == "CRAWLED"
    assert result.confidence == 0.85
    assert result.googlebot_visited is True
    assert result.method == "crawler_evidence"
    assert result.crawler_user_agent == GOOGLEBOT_UA
    assert result.verification_source == "reverse_forward_dns"
    assert "googlebot.com" in result.evidence

    service = IndexVerificationService([strategy])
    classified = await service.verify(
        url, property_type=PropertyType.THIRD_PARTY_BACKLINK
    )
    assert classified.status == "CRAWLED"


@pytest.mark.anyio
async def test_crawler_evidence_strategy_no_evidence_or_disabled(engine, monkeypatch):
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    url = "https://ok.example/never-visited"
    strategy = CrawlerEvidenceStrategy(session_factory=factory)

    monkeypatch.setattr(settings, "crawler_evidence_enabled", True)
    result = await strategy.verify(url, property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert result is None

    monkeypatch.setattr(settings, "crawler_evidence_enabled", False)
    async with factory() as session:
        session.add(
            DiscoveryAccessLog(
                url_hash=_fingerprint(url),
                requested_url=f"http://test/api/public/url/{_fingerprint(url)}",
                requested_path=f"/api/public/url/{_fingerprint(url)}",
                user_agent=GOOGLEBOT_UA,
                ua_class="googlebot",
                ip_hash="x",
                status_code=200,
                verified_googlebot=True,
                googlebot_hostname="crawl-1.googlebot.com",
                verification_source="reverse_forward_dns",
            )
        )
        await session.commit()
    result = await strategy.verify(url, property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert result is None


@pytest.mark.anyio
async def test_unverified_googlebot_ua_is_not_evidence(engine, monkeypatch):
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    url = "https://ok.example/spoofed"
    url_hash = _fingerprint(url)
    async with factory() as session:
        session.add(_listed_job(url, url_hash))
        session.add(
            DiscoveryAccessLog(
                url_hash=url_hash,
                requested_url=f"http://test/api/public/url/{url_hash}",
                requested_path=f"/api/public/url/{url_hash}",
                user_agent=GOOGLEBOT_UA,
                ua_class="googlebot_unverified",
                ip_hash="x",
                status_code=200,
                verified_googlebot=False,
            )
        )
        await session.commit()

    monkeypatch.setattr(settings, "crawler_evidence_enabled", True)
    strategy = CrawlerEvidenceStrategy(session_factory=factory)
    result = await strategy.verify(url, property_type=PropertyType.THIRD_PARTY_BACKLINK)
    assert result is None


# --------------------------------------------------------------------------- #
# Middleware end-to-end
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_middleware_records_googlebot_and_writes_crawl_evidence(
    engine, monkeypatch
):
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with factory() as s:
            try:
                yield s
                await s.commit()
            except Exception:
                await s.rollback()
                raise

    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db

    url = "https://ok.example/middleware-target"
    url_hash = _fingerprint(url)
    async with factory() as session:
        session.add(_listed_job(url, url_hash))
        await session.commit()

    monkeypatch.setattr(settings, "crawler_evidence_enabled", True)

    async def fake_verify(ip):
        return True, "crawl-66-249-66-1.googlebot.com"

    from app.middleware import crawler_evidence as ce_module

    monkeypatch.setattr(ce_module, "verify_googlebot_ip", fake_verify)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(
            f"{settings.api_v1_prefix}/public/url/{url_hash}",
            headers={"user-agent": GOOGLEBOT_UA, "x-forwarded-for": "66.249.66.1"},
        )
        assert response.status_code == 200

    rows = await _settled_rows(factory, lambda r: r.url_hash == url_hash)
    assert len(rows) == 1
    row = rows[0]
    assert row.ua_class == "googlebot"
    assert row.verified_googlebot is True
    assert row.googlebot_hostname == "crawl-66-249-66-1.googlebot.com"
    assert row.verification_source == "reverse_forward_dns"
    assert row.status_code == 200

    async with factory() as session:
        evidence = (
            await session.execute(select(CrawlEvidence))
        ).scalars().all()
    assert len(evidence) == 1
    assert evidence[0].crawler_identity == "googlebot_verified"
    assert evidence[0].evidence_type == CrawlEvidenceType.CRAWLER_EVIDENCE.value
    assert evidence[0].user_agent == GOOGLEBOT_UA


@pytest.mark.anyio
async def test_middleware_records_browser_but_no_evidence(engine, monkeypatch):
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with factory() as s:
            try:
                yield s
                await s.commit()
            except Exception:
                await s.rollback()
                raise

    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_db] = override_get_db
    monkeypatch.setattr(settings, "crawler_evidence_enabled", True)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        response = await ac.get(
            f"{settings.api_v1_prefix}/public/hub",
            headers={"user-agent": "Mozilla/5.0 (Windows NT 10.0) Chrome/120"},
        )
        assert response.status_code == 200

    rows = await _settled_rows(factory)
    assert len(rows) == 1
    row = rows[0]
    assert row.ua_class == "browser"
    assert row.verified_googlebot is False


# --------------------------------------------------------------------------- #
# Sitemap / robots / canonical / JSON feed URLs
# --------------------------------------------------------------------------- #


@pytest.mark.anyio
async def test_robots_and_sitemap_use_public_base(client, session, monkeypatch):
    monkeypatch.setattr(settings, "public_base_url", "https://discovery.example")
    url = "https://ok.example/sitemap-target"
    url_hash = "sitemaphash123"
    session.add(_listed_job(url, url_hash))
    await session.commit()

    robots = await client.get(f"{settings.api_v1_prefix}/public/robots.txt")
    assert robots.status_code == 200
    body = robots.text
    assert f"Allow: {settings.api_v1_prefix}/public/" in body
    assert f"Sitemap: https://discovery.example{settings.api_v1_prefix}/public/sitemap.xml" in body

    sitemap = await client.get(f"{settings.api_v1_prefix}/public/sitemap.xml")
    assert sitemap.status_code == 200
    assert "<urlset" in sitemap.text
    assert (
        f"<loc>https://discovery.example{settings.api_v1_prefix}/public/url/{url_hash}</loc>"
        in sitemap.text
    )
    # Target URLs are never listed — only our detail pages.
    assert "ok.example" not in sitemap.text

    root = await client.get("/robots.txt")
    assert root.status_code == 200
    assert "Sitemap:" in root.text
    root_map = await client.get("/sitemap.xml")
    assert root_map.status_code == 200
    assert "<urlset" in root_map.text


@pytest.mark.anyio
async def test_detail_page_canonical_and_links_are_real(client, session, monkeypatch):
    monkeypatch.setattr(settings, "public_base_url", "https://discovery.example")
    url = "https://ok.example/canonical-target"
    url_hash = "canonicalhash"
    session.add(_listed_job(url, url_hash))
    await session.commit()

    response = await client.get(f"{settings.api_v1_prefix}/public/url/{url_hash}")
    assert response.status_code == 200
    html = response.text
    expected = (
        f'<link rel="canonical" href="https://discovery.example'
        f'{settings.api_v1_prefix}/public/url/{url_hash}"/>'
    )
    assert expected in html
    assert "pintdown.site" not in html
    assert 'href="index"' in html
    assert 'href="feed.xml"' in html
    assert 'href="feed.atom"' in html
    assert 'href="feed.json"' in html


@pytest.mark.anyio
async def test_hub_page_uses_relative_links(client, session, monkeypatch):
    monkeypatch.setattr(settings, "public_base_url", "https://discovery.example")
    url = "https://ok.example/hub-target"
    url_hash = "hubhash123"
    session.add(_listed_job(url, url_hash))
    await session.commit()

    response = await client.get(f"{settings.api_v1_prefix}/public/hub")
    assert response.status_code == 200
    html = response.text
    assert f'href="url/{url_hash}"' in html
    assert 'href="index"' in html
    assert "/discover/" not in html


@pytest.mark.anyio
async def test_json_feed_feed_url_derived_from_production_feed(
    client, session, monkeypatch
):
    monkeypatch.setattr(
        settings,
        "public_base_url",
        "https://discovery.example",
    )
    url = "https://ok.example/json-target"
    url_hash = "jsonhash123"
    session.add(_listed_job(url, url_hash))
    await session.commit()

    response = await client.get(f"{settings.api_v1_prefix}/public/feed.json")
    assert response.status_code == 200
    payload = response.json()
    assert payload["feed_url"] == "https://discovery.example/feed.json"
    assert any(item["url"] == url for item in payload["items"])


@pytest.mark.anyio
async def test_public_index_page_lists_all(client, session, monkeypatch):
    monkeypatch.setattr(settings, "public_base_url", "https://discovery.example")
    url = "https://ok.example/index-target"
    url_hash = "indexhash123"
    session.add(_listed_job(url, url_hash))
    await session.commit()

    response = await client.get(f"{settings.api_v1_prefix}/public/index")
    assert response.status_code == 200
    assert f'href="url/{url_hash}"' in response.text
    assert "pintdown.site" not in response.text


@pytest.mark.anyio
async def test_feed_cards_evidence_points_at_real_paths():
    from app.modules.indexing.engine.orchestrator import _feed_inventory_cards

    job = IndexingJob(
        tenant_id=TENANT,
        source_url="https://ok.example/cards",
        source_url_hash="cardshash",
        pipeline_status=PipelineStatus.DISCOVERY_SUBMITTED.value,
        http_status=200,
        backlink_found=True,
        public_listed=True,
        submitted_at=datetime.now(timezone.utc),
        channel_snapshot={},
        project="public",
    )
    cards = _feed_inventory_cards(job)
    rss = cards["rss"]["evidence"]
    assert f"{settings.api_v1_prefix}/public/url/cardshash" in rss
    assert f"{settings.api_v1_prefix}/public/index" in rss
    assert "/discover/" not in rss
    assert cards["html_discovery"]["evidence"] == (
        f"{settings.api_v1_prefix}/public/url/cardshash"
    )
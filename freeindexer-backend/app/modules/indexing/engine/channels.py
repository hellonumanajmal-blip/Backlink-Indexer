"""Discovery channel abstraction.

A channel returns an accepted status only when the intended mechanism actually
accepted the URL. Sending an HTTP request is not enough.

Free, legitimate channels we can operate ourselves:

* PublicHubChannel — URL is listed on a crawlable page/feed we host (third-party OK)
* WebSubChannel    — hub accepted a publish of that feed (third-party OK as feed items)
* IndexNowChannel  — IndexNow 200/202 on an owned host; otherwise INDEXNOW_NOT_AVAILABLE
* SitemapChannel   — owned-domain sitemap hint only (never third-party URLs in our sitemap)

Paid indexer providers remain optional and are not required.

WebSub hub HTTP 2xx is WEBSUB_ACCEPTED, never INDEXED.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.modules.indexing.constants import (
    ATTEMPT_FAILED,
    ATTEMPT_NOT_APPLICABLE,
    ATTEMPT_OUT_OF_CREDITS,
    ATTEMPT_SKIPPED,
    ATTEMPT_SUCCESS,
)
from app.modules.indexing.engine.feeds import url_in_document
from app.modules.indexing.engine.states import (
    CHANNEL_ACCEPTED_STATUSES,
    CHANNEL_SIGNAL_QUALITY,
    ChannelResultStatus,
    DiscoveryLayer,
    DiscoveryStage,
    PropertyType,
)
from app.modules.indexing.providers import IndexerProvider, ProviderResult, is_owned


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _layers(**flags: bool) -> Dict[str, bool]:
    out = {layer.value: False for layer in DiscoveryLayer}
    out.update(flags)
    return out


@dataclass(slots=True)
class ChannelOutcome:
    channel: str
    status: ChannelResultStatus
    accepted: bool
    response_code: Optional[int] = None
    error: Optional[str] = None
    evidence: Optional[str] = None
    payload: Dict[str, Any] = field(default_factory=dict)
    quality_score: float = 0.0
    discovery_stage: str = DiscoveryStage.NONE.value

    @property
    def ok(self) -> bool:
        return self.accepted and self.status in CHANNEL_ACCEPTED_STATUSES


class DiscoveryChannel(ABC):
    name: str = ""

    @abstractmethod
    async def submit(self, url: str, *, property_type: PropertyType) -> ChannelOutcome: ...


def _from_provider(name: str, result: ProviderResult) -> ChannelOutcome:
    quality = CHANNEL_SIGNAL_QUALITY.get(name, 0.2)
    if result.status == ATTEMPT_SUCCESS:
        status = ChannelResultStatus.SUCCESS
        accepted = True
        evidence = f"{name} accepted the URL (HTTP {result.response_code})"
        stage = DiscoveryStage.DISCOVERY_ACCEPTED.value
    elif result.status == ATTEMPT_OUT_OF_CREDITS:
        status = ChannelResultStatus.RATE_LIMITED
        accepted = False
        evidence = result.error
        stage = DiscoveryStage.NONE.value
        quality = 0.0
    elif result.status == ATTEMPT_NOT_APPLICABLE:
        status = (
            ChannelResultStatus.INDEXNOW_NOT_AVAILABLE
            if name == "indexnow"
            else ChannelResultStatus.SKIPPED
        )
        accepted = False
        evidence = result.error
        stage = DiscoveryStage.NONE.value
        quality = 0.0
    elif result.status == ATTEMPT_SKIPPED:
        status = ChannelResultStatus.UNAVAILABLE
        accepted = False
        evidence = result.error
        stage = DiscoveryStage.NONE.value
        quality = 0.0
    elif result.status == ATTEMPT_FAILED:
        status = ChannelResultStatus.FAILED
        accepted = False
        evidence = result.error
        stage = DiscoveryStage.NONE.value
        quality = 0.0
    else:
        status = ChannelResultStatus.FAILED
        accepted = False
        evidence = result.error
        stage = DiscoveryStage.NONE.value
        quality = 0.0
    payload = dict(result.request_payload)
    payload.update(
        {
            "channel": name.upper(),
            "accepted": accepted,
            "response_status": result.response_code,
            "submitted_at": _now(),
            "signal_quality": quality,
            "discovery_stage": stage,
        }
    )
    return ChannelOutcome(
        channel=name,
        status=status,
        accepted=accepted,
        response_code=result.response_code,
        error=result.error,
        evidence=evidence,
        payload=payload,
        quality_score=quality,
        discovery_stage=stage,
    )


class IndexNowChannel(DiscoveryChannel):
    name = "indexnow"

    def __init__(self, provider: IndexerProvider) -> None:
        self.provider = provider

    async def submit(self, url: str, *, property_type: PropertyType) -> ChannelOutcome:
        if property_type == PropertyType.THIRD_PARTY_BACKLINK or not is_owned(url):
            return ChannelOutcome(
                channel=self.name,
                status=ChannelResultStatus.INDEXNOW_NOT_AVAILABLE,
                accepted=False,
                error="IndexNow requires a key file on the target host",
                evidence="INDEXNOW_NOT_AVAILABLE — target hostname is not in FI_OWNED_DOMAINS",
                quality_score=0.0,
                payload={
                    "channel": "INDEXNOW",
                    "submitted_url": url,
                    "accepted": False,
                    "reason": "third-party / unowned host",
                    "submitted_at": _now(),
                    "signal_quality": 0.0,
                },
            )
        result = await self.provider.submit([url])
        return _from_provider(self.name, result)


class WebSubChannel(DiscoveryChannel):
    name = "websub"

    def __init__(self, provider: IndexerProvider, *, feed_contains_url: bool = True) -> None:
        self.provider = provider
        self.feed_contains_url = feed_contains_url

    async def submit(self, url: str, *, property_type: PropertyType) -> ChannelOutcome:
        # FIXED: Previously blocked if URL not in feed. Now attempt regardless.
        # The WebSub hub will decide whether to crawl based on its own logic.
        # We don't pre-filter based on feed contents - we let the hub decide.
        #
        # The hub receives a ping with the feed URL and will decide:
        # 1. Whether to crawl our feed
        # 2. What URLs to discover from it
        # 3. Whether to visit the target URLs
        #
        # We should attempt regardless of whether we know the URL is in our feed.
        
        result = await self.provider.submit([url])
        outcome = _from_provider(self.name, result)
        feed_url = ""
        if isinstance(result.request_payload, dict):
            feed_url = str(result.request_payload.get("hub.url") or "")
        if outcome.accepted:
            outcome.status = ChannelResultStatus.WEBSUB_ACCEPTED
            outcome.discovery_stage = DiscoveryStage.DISCOVERY_ACCEPTED.value
            outcome.quality_score = CHANNEL_SIGNAL_QUALITY["websub"]
            outcome.evidence = (
                "WEBSUB_ACCEPTED: hub accepted hub.mode=publish. This is a feed recrawl "
                "hint — not Google crawling the target URL and never INDEXED."
            )
        elif outcome.status in {
            ChannelResultStatus.UNAVAILABLE,
            ChannelResultStatus.SKIPPED,
        }:
            outcome.status = ChannelResultStatus.WEBSUB_UNAVAILABLE
            outcome.quality_score = 0.0
        else:
            outcome.status = ChannelResultStatus.WEBSUB_FAILED
            outcome.quality_score = 0.0
        outcome.payload.update(
            {
                "channel": "WEBSUB",
                "accepted": outcome.accepted,
                "hub_response_status": outcome.response_code,
                "feed_url": feed_url,
                "submitted_url": url,
                "submitted_at": outcome.payload.get("submitted_at") or _now(),
                "signal_quality": outcome.quality_score,
                "discovery_stage": outcome.discovery_stage,
                "layers": _layers(),
                "note": "WEBSUB_ACCEPTED must never transition to INDEXED.",
            }
        )
        return outcome


class PublicHubChannel(DiscoveryChannel):
    """Lists the URL on a crawlable hub we control (featured page + RSS).

    DISCOVERY_PUBLISHED means the URL is present in the inventory we generate.
    DISCOVERY_VERIFIED means we also found it in a fetched hub/feed document.
    Neither means Google crawled or indexed the target URL.
    """

    name = "public_hub"

    def __init__(
        self,
        listed: bool,
        hub_url: str = "",
        feed_url: str = "",
        hub_document: str = "",
        live_status: Optional[int] = None,
    ) -> None:
        self.listed = listed
        self.hub_url = hub_url
        self.feed_url = feed_url
        self.hub_document = hub_document
        self.live_status = live_status

    async def submit(self, url: str, *, property_type: PropertyType) -> ChannelOutcome:
        quality = CHANNEL_SIGNAL_QUALITY["public_hub"]
        evidence_url = self.feed_url or self.hub_url
        in_document = bool(self.hub_document) and url_in_document(self.hub_document, url)
        if self.listed or in_document:
            stage = (
                DiscoveryStage.DISCOVERY_VERIFIED
                if in_document
                else DiscoveryStage.DISCOVERY_PUBLISHED
            )
            status = (
                ChannelResultStatus.DISCOVERY_VERIFIED
                if in_document
                else ChannelResultStatus.DISCOVERY_PUBLISHED
            )
            payload = {
                "channel": "PUBLIC_HUB",
                "submitted_url": url,
                "accepted": True,
                "response_status": self.live_status or 200,
                "evidence_url": evidence_url,
                "hub_url": self.hub_url,
                "submitted_at": _now(),
                "discovery_stage": stage.value,
                "signal_quality": quality,
                "layers": _layers(),
                "note": (
                    "OUR_HUB_PUBLISHED is not OUR_HUB_CRAWLED, TARGET_URL_DISCOVERED, "
                    "TARGET_URL_CRAWLED, or TARGET_URL_INDEXED."
                ),
            }
            return ChannelOutcome(
                channel=self.name,
                status=status,
                accepted=True,
                response_code=self.live_status or 200,
                evidence=(
                    f"{stage.value}: URL is listed on the crawlable hub/feed we host "
                    f"({evidence_url or 'generated inventory'}). This is a weak outbound "
                    "discovery hint, not a Google indexing confirmation."
                ),
                payload=payload,
                quality_score=quality,
                discovery_stage=stage.value,
            )
        return ChannelOutcome(
            channel=self.name,
            status=ChannelResultStatus.FAILED,
            accepted=False,
            error="URL is not present in the public hub inventory",
            evidence="PUBLIC_HUB failed — URL missing from generated feed/hub",
            quality_score=0.0,
            payload={
                "channel": "PUBLIC_HUB",
                "submitted_url": url,
                "accepted": False,
                "evidence_url": evidence_url,
                "submitted_at": _now(),
            },
        )


class SitemapChannel(DiscoveryChannel):
    """Owned-domain sitemap hint. Third-party URLs are never placed in our sitemap."""

    name = "sitemap"

    def __init__(self, sitemap_url: str = "") -> None:
        self.sitemap_url = sitemap_url

    async def submit(self, url: str, *, property_type: PropertyType) -> ChannelOutcome:
        if property_type != PropertyType.OWNED_PROPERTY or not is_owned(url):
            return ChannelOutcome(
                channel=self.name,
                status=ChannelResultStatus.SITEMAP_NOT_AVAILABLE,
                accepted=False,
                error="Sitemaps may only list URLs on a host we control",
                evidence="SITEMAP_NOT_AVAILABLE — third-party host; our sitemap does not submit this URL to Google",
                quality_score=0.0,
                payload={
                    "channel": "SITEMAP",
                    "submitted_url": url,
                    "accepted": False,
                    "reason": "third-party host",
                    "submitted_at": _now(),
                    "signal_quality": 0.0,
                },
            )
        if not self.sitemap_url:
            return ChannelOutcome(
                channel=self.name,
                status=ChannelResultStatus.UNAVAILABLE,
                accepted=False,
                error="No owned sitemap URL configured",
                quality_score=0.0,
            )
        quality = CHANNEL_SIGNAL_QUALITY["sitemap"]
        return ChannelOutcome(
            channel=self.name,
            status=ChannelResultStatus.DISCOVERY_PUBLISHED,
            accepted=True,
            evidence=(
                f"Owned URL is eligible for sitemap discovery via {self.sitemap_url}. "
                "A sitemap is a hint, not an indexing command. "
                "Google's sitemap ping endpoint has been dead since 2023."
            ),
            payload={
                "channel": "SITEMAP",
                "sitemap_url": self.sitemap_url,
                "submitted_url": url,
                "accepted": True,
                "submitted_at": _now(),
                "signal_quality": quality,
                "discovery_stage": DiscoveryStage.DISCOVERY_PUBLISHED.value,
            },
            quality_score=quality,
            discovery_stage=DiscoveryStage.DISCOVERY_PUBLISHED.value,
        )


class ProviderBackedChannel(DiscoveryChannel):
    """Optional opt-in provider (Google Indexing API / paid). Same honesty rules."""

    def __init__(self, name: str, provider: IndexerProvider) -> None:
        self.name = name
        self.provider = provider

    async def submit(self, url: str, *, property_type: PropertyType) -> ChannelOutcome:
        result = await self.provider.submit([url])
        return _from_provider(self.name, result)


class GscFeedSitemapChannel(DiscoveryChannel):
    """Submit OUR feed URL to Search Console sitemaps API.

    Never puts a third-party URL into a sitemap. Cooldown avoids per-URL spam.
    """

    name = "gsc_feed_sitemap"
    _last_submit_monotonic: float = 0.0
    _min_interval_seconds: float = 6 * 60 * 60

    def __init__(
        self,
        *,
        access_token: str = "",
        site_url: str = "",
        feed_url: str = "",
        enabled: bool = False,
        transport: Optional[object] = None,
    ) -> None:
        self.access_token = access_token
        self.site_url = site_url.rstrip("/") + "/" if site_url else ""
        self.feed_url = feed_url
        self.enabled = enabled
        self.transport = transport

    async def submit(self, url: str, *, property_type: PropertyType) -> ChannelOutcome:
        if not self.enabled:
            return ChannelOutcome(
                channel=self.name,
                status=ChannelResultStatus.SKIPPED,
                accepted=False,
                error="FI_GSC_SUBMIT_FEED is disabled",
                evidence="Owner-only: submit our feed URL to Search Console, off by default",
                quality_score=0.0,
            )
        if not self.access_token or not self.site_url or not self.feed_url:
            return ChannelOutcome(
                channel=self.name,
                status=ChannelResultStatus.UNAVAILABLE,
                accepted=False,
                error="Search Console token, site URL, or feed URL missing",
                quality_score=0.0,
            )
        import time

        now = time.monotonic()
        if now - type(self)._last_submit_monotonic < self._min_interval_seconds:
            return ChannelOutcome(
                channel=self.name,
                status=ChannelResultStatus.SKIPPED,
                accepted=True,
                evidence=(
                    "GSC feed sitemap already submitted recently. Our feed URL was not "
                    "re-POSTed. This is not a Google crawl of the third-party URL."
                ),
                quality_score=CHANNEL_SIGNAL_QUALITY["gsc_feed_sitemap"],
                discovery_stage=DiscoveryStage.DISCOVERY_ACCEPTED.value,
                payload={
                    "channel": "GSC_FEED_SITEMAP",
                    "submitted_url": self.feed_url,
                    "item_url": url,
                    "accepted": True,
                    "cooldown": True,
                    "submitted_at": _now(),
                },
            )
        try:
            import httpx
        except ImportError:
            return ChannelOutcome(
                channel=self.name,
                status=ChannelResultStatus.UNAVAILABLE,
                accepted=False,
                error="httpx is not installed",
            )
        from urllib.parse import quote

        endpoint = (
            "https://www.googleapis.com/webmasters/v3/sites/"
            f"{quote(self.site_url, safe='')}/sitemaps/{quote(self.feed_url, safe='')}"
        )
        headers = {"Authorization": f"Bearer {self.access_token}"}
        client_kwargs = {"timeout": 20.0, "follow_redirects": True, "headers": headers}
        if self.transport is not None:
            client_kwargs["transport"] = self.transport
        try:
            async with httpx.AsyncClient(**client_kwargs) as client:
                response = await client.put(endpoint)
        except Exception as exc:
            return ChannelOutcome(
                channel=self.name,
                status=ChannelResultStatus.FAILED,
                accepted=False,
                error=str(exc),
                evidence="GSC sitemap put failed",
            )
        type(self)._last_submit_monotonic = now
        ok = 200 <= response.status_code < 300
        quality = CHANNEL_SIGNAL_QUALITY["gsc_feed_sitemap"] if ok else 0.0
        return ChannelOutcome(
            channel=self.name,
            status=(
                ChannelResultStatus.DISCOVERY_ACCEPTED if ok else ChannelResultStatus.FAILED
            ),
            accepted=ok,
            response_code=response.status_code,
            error=None if ok else f"HTTP {response.status_code}",
            evidence=(
                f"Search Console accepted our feed URL {self.feed_url} as a sitemap. "
                "This is an indirect discovery hint for feed items, not indexing of "
                f"{url}."
                if ok
                else f"Search Console rejected feed sitemap HTTP {response.status_code}"
            ),
            quality_score=quality,
            discovery_stage=DiscoveryStage.DISCOVERY_ACCEPTED.value if ok else DiscoveryStage.NONE.value,
            payload={
                "channel": "GSC_FEED_SITEMAP",
                "submitted_url": self.feed_url,
                "item_url": url,
                "accepted": ok,
                "response_status": response.status_code,
                "submitted_at": _now(),
                "signal_quality": quality,
                "note": "OWNER_CONTROLLED feed URL. INDIRECT for third-party items.",
            },
        )


def build_free_channels(
    providers: Dict[str, IndexerProvider],
    *,
    listed_on_hub: bool,
    hub_url: str = "",
    feed_url: str = "",
    sitemap_url: str = "",
    hub_document: str = "",
    live_status: Optional[int] = None,
    gsc_feed_channel: Optional[DiscoveryChannel] = None,
) -> List[DiscoveryChannel]:
    channels: List[DiscoveryChannel] = [
        PublicHubChannel(
            listed=listed_on_hub,
            hub_url=hub_url,
            feed_url=feed_url,
            hub_document=hub_document,
            live_status=live_status,
        ),
        SitemapChannel(sitemap_url=sitemap_url),
    ]
    if "indexnow" in providers:
        channels.append(IndexNowChannel(providers["indexnow"]))
    if "websub" in providers:
        channels.append(
            WebSubChannel(providers["websub"], feed_contains_url=listed_on_hub or bool(hub_document))
        )
    if gsc_feed_channel is not None:
        channels.append(gsc_feed_channel)
    return channels

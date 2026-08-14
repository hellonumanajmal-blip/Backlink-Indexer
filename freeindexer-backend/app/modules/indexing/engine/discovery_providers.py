"""Plugin metadata for discovery channels.

Existing DiscoveryChannel classes remain the runtime implementation. This
module classifies them so owner-only tools cannot be used on third-party URLs
by accident, and so deprecated ping endpoints are never wired in.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional, Sequence

from app.modules.indexing.engine.channels import ChannelOutcome, DiscoveryChannel
from app.modules.indexing.engine.states import ChannelResultStatus, PropertyType

THIRD_PARTY_SUPPORTED = "THIRD_PARTY_SUPPORTED"
OWNER_ONLY = "OWNER_ONLY"
INDIRECT = "INDIRECT"
DEPRECATED = "DEPRECATED"
UNAVAILABLE = "UNAVAILABLE"


@dataclass(frozen=True, slots=True)
class ProviderSpec:
    name: str
    availability: str
    supports_third_party: bool
    requires_ownership: bool
    signal: str
    notes: str


PROVIDER_CATALOG: Dict[str, ProviderSpec] = {
    "public_hub": ProviderSpec(
        name="public_hub",
        availability=THIRD_PARTY_SUPPORTED,
        supports_third_party=True,
        requires_ownership=False,
        signal=INDIRECT,
        notes="Outbound link on a crawlable page/feed we host. Google may discover it by crawling us.",
    ),
    "websub": ProviderSpec(
        name="websub",
        availability=THIRD_PARTY_SUPPORTED,
        supports_third_party=True,
        requires_ownership=False,
        signal=INDIRECT,
        notes="Google-documented feed push. Hub 2xx is not a Googlebot visit and never INDEXED.",
    ),
    "indexnow": ProviderSpec(
        name="indexnow",
        availability=OWNER_ONLY,
        supports_third_party=False,
        requires_ownership=True,
        signal="OWNER_CONTROLLED",
        notes="Requires a key file on the target host. Google does not participate.",
    ),
    "sitemap": ProviderSpec(
        name="sitemap",
        availability=OWNER_ONLY,
        supports_third_party=False,
        requires_ownership=True,
        signal="OWNER_CONTROLLED",
        notes="Our XML sitemap lists owned pages only. Third-party URLs are SITEMAP_NOT_AVAILABLE.",
    ),
    "gsc_feed_sitemap": ProviderSpec(
        name="gsc_feed_sitemap",
        availability=OWNER_ONLY,
        supports_third_party=True,
        requires_ownership=True,
        signal=INDIRECT,
        notes=(
            "Search Console sitemap submit of OUR RSS feed URL (owned hub). "
            "Never submits the third-party URL itself. Indirect for feed items."
        ),
    ),
    "google_indexing": ProviderSpec(
        name="google_indexing",
        availability=OWNER_ONLY,
        supports_third_party=False,
        requires_ownership=True,
        signal="OWNER_CONTROLLED",
        notes="Officially JobPosting/BroadcastEvent. Never used for arbitrary third-party URLs.",
    ),
    "google_sitemap_ping": ProviderSpec(
        name="google_sitemap_ping",
        availability=DEPRECATED,
        supports_third_party=False,
        requires_ownership=True,
        signal=DEPRECATED,
        notes="Removed 2023-06; endpoint 404s. Not implemented.",
    ),
    "google_blog_search_ping": ProviderSpec(
        name="google_blog_search_ping",
        availability=DEPRECATED,
        supports_third_party=False,
        requires_ownership=False,
        signal=DEPRECATED,
        notes="Google Blog Search is gone. Not implemented.",
    ),
    "pingomatic": ProviderSpec(
        name="pingomatic",
        availability=UNAVAILABLE,
        supports_third_party=False,
        requires_ownership=False,
        signal=DEPRECATED,
        notes="Does not notify Google in 2026 in a documented way. Not implemented.",
    ),
}


class DiscoveryProvider:
    """Adapter around a DiscoveryChannel with explicit capability flags."""

    def __init__(self, channel: DiscoveryChannel, spec: Optional[ProviderSpec] = None) -> None:
        self.channel = channel
        self.spec = spec or PROVIDER_CATALOG.get(
            channel.name,
            ProviderSpec(
                name=channel.name,
                availability=UNAVAILABLE,
                supports_third_party=False,
                requires_ownership=True,
                signal=UNAVAILABLE,
                notes="Unclassified provider — treated as unavailable until catalogued.",
            ),
        )

    @property
    def name(self) -> str:
        return self.channel.name

    @property
    def availability(self) -> str:
        return self.spec.availability

    @property
    def supports_third_party(self) -> bool:
        return self.spec.supports_third_party

    @property
    def requires_ownership(self) -> bool:
        return self.spec.requires_ownership

    async def submit(self, url: str, *, property_type: PropertyType) -> ChannelOutcome:
        if self.spec.availability == DEPRECATED:
            return ChannelOutcome(
                channel=self.name,
                status=ChannelResultStatus.SKIPPED,
                accepted=False,
                error="DEPRECATED — not called",
                evidence=self.spec.notes,
            )
        if property_type == PropertyType.THIRD_PARTY_BACKLINK and not self.spec.supports_third_party:
            status = (
                ChannelResultStatus.INDEXNOW_NOT_AVAILABLE
                if self.name == "indexnow"
                else ChannelResultStatus.SITEMAP_NOT_AVAILABLE
                if self.name == "sitemap"
                else ChannelResultStatus.SKIPPED
            )
            return ChannelOutcome(
                channel=self.name,
                status=status,
                accepted=False,
                error=f"{self.spec.availability} — not used for third-party URLs",
                evidence=self.spec.notes,
            )
        return await self.channel.submit(url, property_type=property_type)

    async def verify_submission(self, url: str, *, property_type: PropertyType) -> ChannelOutcome:
        return await self.submit(url, property_type=property_type)

    def get_evidence(self) -> ProviderSpec:
        return self.spec


def wrap_channels(channels: Sequence[DiscoveryChannel]) -> List[DiscoveryProvider]:
    return [DiscoveryProvider(ch) for ch in channels]


__all__ = [
    "DEPRECATED",
    "DiscoveryProvider",
    "INDIRECT",
    "OWNER_ONLY",
    "PROVIDER_CATALOG",
    "ProviderSpec",
    "THIRD_PARTY_SUPPORTED",
    "UNAVAILABLE",
    "wrap_channels",
]

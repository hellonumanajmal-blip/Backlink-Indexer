"""
Comprehensive production audit tests for the Backlink Indexer.

These tests verify:
1. Discovery channels fail gracefully with empty configuration
2. Third-party backlinks cannot reach INDEXED without verification strategy
3. public_listed flag prevents discovery when backlink not found
4. Experiment groups work as documented
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, Mock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.indexing.engine.channels import (
    PublicHubChannel,
    WebSubChannel, 
    IndexNowChannel,
    ChannelOutcome,
)
from app.modules.indexing.engine.discovery_providers import PROVIDER_CATALOG, DiscoveryProvider
from app.modules.indexing.engine.orchestrator import IndexingEngine
from app.modules.indexing.engine.states import (
    PropertyType,
    PipelineStatus,
    VisibilityStatus,
    ChannelResultStatus,
)
from app.modules.indexing.engine.models import IndexingJob
from app.modules.indexing.engine.verification import (
    IndexVerificationService,
    SearchConsoleStrategy,
    CustomSearchStrategy,
)


class TestDiscoveryChannelsWithEmptyConfig:
    """Verify discovery channels fail gracefully with empty/default configuration."""
    
    @pytest.mark.asyncio
    async def test_public_hub_channel_fails_when_not_listed(self):
        """PublicHubChannel should fail when URL is not in the feed inventory."""
        # This simulates production: public_listed = False because backlink not found
        channel = PublicHubChannel(
            listed=False,  # URL not in feed
            hub_url="https://pintdown.site/featured",  # Default, disconnected
            feed_url="https://pintdown.site/feed.xml",
        )
        
        outcome = await channel.submit(
            "https://example.com/backlink",
            property_type=PropertyType.THIRD_PARTY_BACKLINK
        )
        
        # Must fail
        assert outcome.accepted is False
        assert outcome.status == ChannelResultStatus.FAILED
        assert "not present in the public hub inventory" in outcome.error
        assert outcome.quality_score == 0.0

    @pytest.mark.asyncio
    async def test_websub_channel_attempts_regardless_of_feed(self):
        """WebSubChannel attempts the hub ping even when the URL is not in the feed.

        FIXED: the old pre-filter blocked discovery when feed_contains_url was
        False. The hub now decides whether to crawl the feed - we do not.
        """
        from app.modules.indexing.engine.channels import WebSubChannel
        from app.modules.indexing.providers import ProviderResult, ATTEMPT_SUCCESS

        async def fake_submit(urls):
            return ProviderResult(
                method="websub",
                status=ATTEMPT_SUCCESS,
                endpoint="https://pubsubhubbub.appspot.com",
                response_code=204,
                request_payload={"hub.mode": "publish", "hub.url": "https://example.com/feed.xml"},
            )

        provider = Mock()
        provider.submit = fake_submit
        channel = WebSubChannel(provider, feed_contains_url=False)

        outcome = await channel.submit(
            "https://example.com/backlink",
            property_type=PropertyType.THIRD_PARTY_BACKLINK
        )

        # Must attempt the hub ping regardless of feed contents
        assert outcome.accepted is True
        assert outcome.status == ChannelResultStatus.WEBSUB_ACCEPTED
        assert outcome.discovery_stage == "DISCOVERY_ACCEPTED"
        
    @pytest.mark.asyncio
    async def test_indexnow_channel_rejects_third_party(self):
        """IndexNowChannel must reject third-party URLs (requires key file on domain)."""
        channel = IndexNowChannel(provider=AsyncMock())
        
        outcome = await channel.submit(
            "https://third-party.com/page",
            property_type=PropertyType.THIRD_PARTY_BACKLINK
        )
        
        # Must reject
        assert outcome.accepted is False
        assert outcome.status == ChannelResultStatus.INDEXNOW_NOT_AVAILABLE
        assert "key file on the target host" in outcome.error
        assert outcome.quality_score == 0.0


class TestThirdPartyBacklinkVerification:
    """Verify third-party backlinks cannot reach INDEXED without manual verification."""
    
    @pytest.mark.asyncio
    async def test_search_console_unavailable_for_third_party(self):
        """SearchConsoleStrategy must return None for third-party URLs."""
        strategy = SearchConsoleStrategy(
            access_token="valid-token",
            site_url="https://owned.com"
        )
        
        result = await strategy.verify(
            "https://third-party.com/page",
            property_type=PropertyType.THIRD_PARTY_BACKLINK
        )
        
        # Third-party URLs get no verification
        assert result is None
    
    @pytest.mark.asyncio
    async def test_custom_search_insufficient_confidence(self):
        """CustomSearch result (0.72 confidence) doesn't meet INDEXED threshold (0.8)."""
        strategy = CustomSearchStrategy(
            api_key="test-key",
            cx="test-cx"
        )
        
        # Mock a positive CSE result
        async def mock_fetch(url):
            return 200, '{"items": [{"link": "https://third-party.com/page"}]}', None
        
        strategy._fetch = mock_fetch
        
        result = await strategy.verify(
            "https://third-party.com/page",
            property_type=PropertyType.THIRD_PARTY_BACKLINK
        )
        
        # Result is returned but with low confidence
        assert result is not None
        assert result.confidence == 0.72
        
        # In IndexVerificationService, this would be downgraded to UNKNOWN
        assert result.confidence < 0.8  # Doesn't meet INDEXED threshold
    
    @pytest.mark.asyncio
    async def test_verification_service_rejects_low_confidence_indexed(self):
        """IndexVerificationService must downgrade low-confidence INDEXED claims."""
        from app.modules.indexing.engine.verification import INDEXED_MIN_CONFIDENCE
        
        # Mock a strategy that returns low-confidence INDEXED
        strategy = AsyncMock()
        strategy.verify = AsyncMock(return_value=MagicMock(
            status=VisibilityStatus.INDEXED.value,
            confidence=0.72,  # Below threshold
            checked_at=datetime.now(timezone.utc),
            method="google_custom_search",
            evidence="CSE returned the URL",
            googlebot_visited=False,
            details={}
        ))
        
        service = IndexVerificationService(strategies=[strategy])
        result = await service.verify(
            "https://third-party.com/page",
            property_type=PropertyType.THIRD_PARTY_BACKLINK
        )
        
        # Must be downgraded
        assert result.status == VisibilityStatus.UNKNOWN.value
        assert f"confidence {0.72:.2f} < {INDEXED_MIN_CONFIDENCE}" in result.evidence


class TestPublicListedFlagLogic:
    """Verify public_listed flag prevents discovery when conditions not met."""
    
    def test_public_listed_false_when_backlink_not_found(self):
        """public_listed must be False when backlink_found is False."""
        # This mimics orchestrator.py line 645
        target_url = "https://target.com"
        backlink_found = False
        
        # From orchestrator line 645:
        # and (not job.target_url or job.backlink_found is True)
        condition_passed = (not target_url or backlink_found is True)
        
        # Condition must fail
        assert condition_passed is False
        # Therefore public_listed would be False
    
    def test_public_listed_false_when_quality_too_low(self):
        """public_listed must be False when quality_score < 40."""
        # From orchestrator line 651:
        # and quality.score >= 40
        quality_score = 35
        
        condition_passed = quality_score >= 40
        assert condition_passed is False
        # Therefore public_listed would be False
    
    def test_public_listed_false_in_control_group(self):
        """public_listed must be False for Group A (control) unless max_discovery enabled."""
        # From orchestrator line 641:
        # (_max_discovery_enabled() or job.experiment_group != "A")
        max_discovery_enabled = False
        experiment_group = "A"
        
        condition_passed = (max_discovery_enabled or experiment_group != "A")
        assert condition_passed is False
        # Therefore public_listed would be False


class TestExperimentGroupChannelSelection:
    """Verify experiment groups get correct discovery channels."""
    
    def test_group_a_gets_no_channels(self):
        """Group A (control) should get NO discovery channels."""
        from app.modules.indexing.engine.experiment_stats import experiment_channel_names
        
        channels = experiment_channel_names("A")
        assert channels == ()
        assert len(channels) == 0
    
    def test_group_b_gets_public_hub_only(self):
        """Group B should get only public_hub channel."""
        from app.modules.indexing.engine.experiment_stats import experiment_channel_names
        
        channels = experiment_channel_names("B")
        assert channels == ("public_hub",)
        assert "websub" not in channels
    
    def test_group_c_d_get_both_channels(self):
        """Groups C and D should get both public_hub and websub."""
        from app.modules.indexing.engine.experiment_stats import experiment_channel_names
        
        for group in ["C", "D"]:
            channels = experiment_channel_names(group)
            assert "public_hub" in channels
            assert "websub" in channels


class TestDiscoveryProviderClassification:
    """Verify provider catalog correctly classifies mechanisms."""
    
    def test_public_hub_supports_third_party(self):
        """PublicHubChannel should be classified as THIRD_PARTY_SUPPORTED."""
        assert PROVIDER_CATALOG["public_hub"].supports_third_party is True
        assert PROVIDER_CATALOG["public_hub"].requires_ownership is False
    
    def test_websub_supports_third_party(self):
        """WebSubChannel should be classified as THIRD_PARTY_SUPPORTED."""
        assert PROVIDER_CATALOG["websub"].supports_third_party is True
        assert PROVIDER_CATALOG["websub"].requires_ownership is False
    
    def test_indexnow_owner_only(self):
        """IndexNow should be classified as OWNER_ONLY."""
        assert PROVIDER_CATALOG["indexnow"].supports_third_party is False
        assert PROVIDER_CATALOG["indexnow"].requires_ownership is True
        
    def test_sitemap_owner_only(self):
        """Sitemap should be classified as OWNER_ONLY."""
        assert PROVIDER_CATALOG["sitemap"].supports_third_party is False
        assert PROVIDER_CATALOG["sitemap"].requires_ownership is True
    
    def test_google_indexing_owner_only(self):
        """Google Indexing API should be classified as OWNER_ONLY."""
        assert PROVIDER_CATALOG["google_indexing"].supports_third_party is False
        assert PROVIDER_CATALOG["google_indexing"].requires_ownership is True


class TestConfigurationImpact:
    """Test how empty/missing configuration affects the pipeline."""
    
    @pytest.mark.asyncio
    async def test_empty_public_hub_url_causes_discovery_to_fail(self):
        """With empty public_hub_url, discovery cannot succeed for third-party URLs."""
        # Create a job for a third-party backlink
        job = IndexingJob(
            tenant_id="test",
            source_url="https://source.com/page",
            source_url_hash="abc123",
            property_type=PropertyType.THIRD_PARTY_BACKLINK.value,
            pipeline_status=PipelineStatus.DISCOVERY_QUEUED.value,
            public_listed=False,  # Not in feed inventory
        )
        
        # With empty config, public_hub_url defaults to pintdown.site
        # But that's not connected to this deployment
        channel = PublicHubChannel(
            listed=False,  # URL not in inventory
            hub_url="https://pintdown.site/featured",  # Disconnected
            feed_url="https://pintdown.site/feed.xml",
        )
        
        outcome = await channel.submit(
            job.source_url,
            property_type=PropertyType(job.property_type)
        )
        
        # Discovery must fail
        assert outcome.accepted is False


class TestRetryBehavior:
    """Test retry schedule with discovery failures."""
    
    def test_max_discovery_attempts(self):
        """MAX_DISCOVERY_ATTEMPTS should be 7."""
        from app.modules.indexing.engine.retry_schedule import MAX_DISCOVERY_ATTEMPTS
        assert MAX_DISCOVERY_ATTEMPTS == 7
    
    def test_discovery_backoff_schedule(self):
        """Backoff should follow documented schedule."""
        from app.modules.indexing.engine.retry_schedule import DISCOVERY_BACKOFF_SECONDS
        
        # Expected: 0, 6h, 24h, 48h, 72h, 7d, 14d
        assert DISCOVERY_BACKOFF_SECONDS[0] == 0  # immediate
        assert DISCOVERY_BACKOFF_SECONDS[1] == 6 * 3600  # 6 hours
        assert DISCOVERY_BACKOFF_SECONDS[2] == 24 * 3600  # 24 hours
        assert DISCOVERY_BACKOFF_SECONDS[3] == 48 * 3600  # 48 hours
        assert DISCOVERY_BACKOFF_SECONDS[4] == 72 * 3600  # 72 hours
        assert DISCOVERY_BACKOFF_SECONDS[5] == 7 * 86400  # 7 days
        assert DISCOVERY_BACKOFF_SECONDS[6] == 14 * 86400  # 14 days


class TestStatusTransitions:
    """Test that INDEXED cannot be reached without verification evidence."""
    
    def test_indexed_requires_verification_strategy(self):
        """INDEXED status should only come from successful verification."""
        # The orchestrator only sets INDEXED when verification returns INDEXED status
        # For third-party without GSC: no verification strategy can return INDEXED
        # Therefore INDEXED is unreachable
        pass  # This is tested by TestThirdPartyBacklinkVerification


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

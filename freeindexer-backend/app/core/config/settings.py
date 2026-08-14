"""Application settings for the FreeIndexer backend.

Lean, production-oriented configuration used by the foundation layer and the
Enterprise Integrations Hub (Phase 29). Values are sourced from environment
variables with sensible local-development defaults.
"""
from __future__ import annotations

from functools import lru_cache
from typing import List

from pydantic import AliasChoices, Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _csv(value: str) -> List[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseSettings):
    """Central application configuration."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="FI_", extra="ignore")

    # Core
    app_name: str = "FreeIndexer Backend"
    environment: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api"

    # Database
    database_url: str = "sqlite+aiosqlite:///./freeindexer.db"
    db_echo: bool = False

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_async_database_url(cls, value: object) -> object:
        """Accept Render's postgres:// URL while keeping the async SQLAlchemy driver."""
        if not isinstance(value, str) or not value:
            return value
        url = value
        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]
        if url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]
        return url

    @model_validator(mode="after")
    def _derive_celery_urls(self) -> "Settings":
        """If Redis is production but Celery URLs were left on localhost, derive them."""
        redis_is_remote = self.redis_url and "localhost" not in self.redis_url
        if redis_is_remote and "localhost" in self.celery_broker_url:
            base = self.redis_url.rsplit("/", 1)[0]
            self.celery_broker_url = f"{base}/1"
            self.celery_result_backend = f"{base}/2"
        return self

    # Security
    secret_key: str = "change-me-in-production-0123456789abcdef"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Credential vault encryption key (Fernet, urlsafe base64 32 bytes).
    # If empty, a key is derived from secret_key.
    credential_encryption_key: str = ""

    # CORS
    cors_origins: List[str] = ["*"]

    # ------------------------------------------------------------------
    # Public, unauthenticated read API
    # ------------------------------------------------------------------
    #: Fixed-window abuse guard for the public read endpoints (per client IP).
    #: These endpoints carry no secrets, so the limit only needs to stop a
    #: scraper from hammering the backend, not to enforce quotas.
    public_api_rate_limit: int = 60
    public_api_rate_window_seconds: int = 60
    #: Scope the public "featured on" list to a single tenant. Leave empty on a
    #: single-tenant deployment (returns every tenant's rows); set it on a
    #: multi-tenant deployment so only the public-facing tenant is exposed.
    public_featured_tenant_id: str = ""

    # Integrations
    webhook_signature_tolerance_seconds: int = 300
    webhook_max_retries: int = 5
    sync_default_batch_size: int = 200

    # ------------------------------------------------------------------
    # Backlink indexing dispatch
    # ------------------------------------------------------------------
    indexer_http_timeout_seconds: float = 15.0
    indexer_batch_size: int = 50

    # Free indexing engine (validation / crawlability / discovery / verification)
    engine_http_timeout_seconds: float = 15.0
    engine_max_redirects: int = 8
    engine_per_domain_rate_per_minute: int = 12
    engine_global_rate_per_minute: int = 60
    engine_per_domain_concurrency: int = 2
    engine_global_concurrency: int = 8
    #: Lightweight JSON-LD / script-string scan after a static backlink miss.
    engine_js_backlink_scan: bool = True
    #: Submit OUR RSS feed URL to Search Console sitemaps (owned hub only).
    gsc_submit_feed: bool = Field(default=False, validation_alias="FI_GSC_SUBMIT_FEED")
    #: Crawlable hub that lists submitted URLs (featured page or RSS).
    public_hub_url: str = Field(default="", validation_alias="FI_PUBLIC_HUB_URL")
    #: Owned-domain sitemap URL. Third-party backlinks are never placed here.
    owned_sitemap_url: str = Field(default="", validation_alias="FI_OWNED_SITEMAP_URL")
    #: Google Search Console URL Inspection (owned properties only).
    gsc_access_token: str = Field(default="", validation_alias="FI_GSC_ACCESS_TOKEN")
    gsc_site_url: str = Field(default="", validation_alias="FI_GSC_SITE_URL")
    #: Optional Programmable Search JSON API. Misses stay UNKNOWN (CSE is incomplete).
    google_cse_api_key: str = Field(default="", validation_alias="FI_GOOGLE_CSE_API_KEY")
    google_cse_cx: str = Field(default="", validation_alias="FI_GOOGLE_CSE_CX")
    google_cse_daily_quota: int = 100
    #: When true, every eligible URL uses all legitimate third-party discovery
    #: channels (hub + feeds + WebSub). Owner-only channels stay owner-only.
    max_discovery_mode: bool = Field(
        default=False,
        validation_alias=AliasChoices("FI_MAX_DISCOVERY_MODE", "MAX_DISCOVERY_MODE"),
    )

    #: Optional opt-in providers tried in order until one accepts the URL. Empty
    #: by default so the pipeline is free-only (IndexNow + WebSub). Add a method
    #: here to opt in — paid indexers, or ``google_indexing`` after reading the
    #: ToS caveat in .env.example. Comma-separated so it can be edited by hand.
    indexer_provider_order_csv: str = Field(
        default="",
        validation_alias="FI_INDEXER_PROVIDER_ORDER",
    )

    # IndexNow. Only usable for domains we control, because the protocol
    # requires serving {key}.txt on the target host. Google does not
    # participate in IndexNow; this reaches Bing, Yandex, Seznam and Naver.
    indexnow_enabled: bool = True
    #: Shared with the Next.js frontend, which serves this value at
    #: /<key>.txt. Both processes must agree or IndexNow rejects the
    #: submission, so the unprefixed INDEXNOW_KEY is the canonical name and
    #: FI_INDEXNOW_KEY is accepted as an override for prefix-consistent setups.
    indexnow_key: str = Field(
        default="",
        validation_alias=AliasChoices("FI_INDEXNOW_KEY", "INDEXNOW_KEY"),
    )
    indexnow_endpoint: str = "https://api.indexnow.org/indexnow"
    #: Comma-separated apex domains we own. Subdomains are matched implicitly.
    #: Shared by every owner-only channel (IndexNow, Google Indexing API).
    owned_domains_csv: str = Field(default="", validation_alias="FI_OWNED_DOMAINS")

    # WebSub (PubSubHubbub). The one free channel that reaches Google for URLs we
    # do NOT own: we publish the URLs in a feed on a domain we control and ping a
    # hub so Google's Feedfetcher re-crawls it. A discovery hint, not indexing.
    websub_enabled: bool = True
    #: A feed on a domain we control that lists the URLs to be discovered.
    websub_feed_url: str = Field(default="", validation_alias="FI_WEBSUB_FEED_URL")
    #: Comma-separated hub URLs. Google runs the default hub; add relays as needed.
    websub_hub_urls_csv: str = Field(
        default="https://pubsubhubbub.appspot.com",
        validation_alias="FI_WEBSUB_HUB_URLS",
    )

    # Google Indexing API (owner-only, free, opt-in). Directly notifies Google's
    # crawl queue for domains whose Search Console property lists the service
    # account as an Owner. It CANNOT be used for third-party backlinks. Officially
    # JobPosting/BroadcastEvent only — listed in FI_INDEXER_PROVIDER_ORDER, not
    # FREE_METHODS, so the operator sees that ToS nuance before it fires.
    # Success means Google accepted the notification, never that it indexed.
    google_indexing_enabled: bool = True
    #: Service account email, e.g. name@project.iam.gserviceaccount.com.
    google_indexing_client_email: str = Field(
        default="", validation_alias="FI_GOOGLE_INDEXING_CLIENT_EMAIL"
    )
    #: Service account private key (PEM). Literal "\n" sequences are accepted so
    #: the multi-line key can live on a single .env line.
    google_indexing_private_key: str = Field(
        default="", validation_alias="FI_GOOGLE_INDEXING_PRIVATE_KEY"
    )
    google_indexing_endpoint: str = (
        "https://indexing.googleapis.com/v3/urlNotifications:publish"
    )
    google_indexing_token_uri: str = "https://oauth2.googleapis.com/token"

    # IndexBolt (optional paid indexer; disabled by default — free-only pipeline).
    indexbolt_enabled: bool = False
    indexbolt_api_key: str = ""
    indexbolt_base_url: str = "https://www.indexbolt.com/api/v1"
    #: "normal" (1 credit/URL) or "instant" (10 credits/URL).
    indexbolt_indexing_type: str = "normal"
    indexbolt_project_id: str = ""

    # Rapid URL Indexer (optional paid fallback; disabled by default).
    rapidurlindexer_enabled: bool = False
    rapidurlindexer_api_key: str = ""
    rapidurlindexer_base_url: str = "https://rapidurlindexer.com/wp-json/api/v1"
    #: Apex Mode costs 3 credits/URL for a ~5 minute crawl instead of hours.
    rapidurlindexer_apex_mode: bool = False

    @property
    def owned_domains(self) -> List[str]:
        return [d.lower().lstrip(".") for d in _csv(self.owned_domains_csv)]

    @property
    def websub_hub_urls(self) -> List[str]:
        return _csv(self.websub_hub_urls_csv)

    @property
    def indexer_provider_order(self) -> List[str]:
        return _csv(self.indexer_provider_order_csv)


@lru_cache
def get_settings() -> Settings:
    """Return a cached Settings instance."""
    return Settings()


settings = get_settings()

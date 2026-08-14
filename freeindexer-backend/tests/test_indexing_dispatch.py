"""Tests for the backlink indexing dispatch pipeline."""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import settings
from app.modules.indexing import providers as providers_module
from app.modules.indexing.constants import (
    ATTEMPT_FAILED,
    ATTEMPT_NOT_APPLICABLE,
    ATTEMPT_OUT_OF_CREDITS,
    ATTEMPT_SKIPPED,
    ATTEMPT_SUCCESS,
    DISPATCH_FAILED,
    DISPATCH_SKIPPED,
    DISPATCH_SUBMITTED,
    INDEX_PENDING,
    INDEX_PINGED,
    METHOD_GOOGLE_INDEXING,
    METHOD_INDEXBOLT,
    METHOD_INDEXNOW,
    METHOD_RAPID_URL_INDEXER,
    METHOD_WEBSUB,
)
from app.modules.indexing.indexer_dispatch import (
    IndexerDispatchService,
    normalise_url,
    split_urls,
)

TENANT = "tenant-1"

# A throwaway RSA keypair so the Google Indexing tests exercise the *real*
# service-account JWT signing path (RS256), not a mock. Generated once per run.
_GOOGLE_TEST_RSA_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
GOOGLE_TEST_PRIVATE_KEY = _GOOGLE_TEST_RSA_KEY.private_bytes(
    encoding=serialization.Encoding.PEM,
    format=serialization.PrivateFormat.PKCS8,
    encryption_algorithm=serialization.NoEncryption(),
).decode("utf-8")
GOOGLE_TEST_PUBLIC_KEY = (
    _GOOGLE_TEST_RSA_KEY.public_key().public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")
)
GOOGLE_TEST_CLIENT_EMAIL = "indexer@proj.iam.gserviceaccount.com"
GOOGLE_TOKEN_OK = (
    '{"access_token":"ya29.test-token","expires_in":3600,"token_type":"Bearer"}'
)


# ---------------------------------------------------------------------------
# Fake transport
# ---------------------------------------------------------------------------
class FakeTransport:
    """Stands in for ``providers.post_json`` and records every outbound call."""

    def __init__(self, responses: Dict[str, Tuple[Optional[int], str, Optional[str]]]) -> None:
        self.responses = responses
        self.calls: List[Dict[str, Any]] = []

    async def __call__(
        self,
        url: str,
        *,
        payload: Dict[str, Any],
        headers: Dict[str, str],
        timeout: float,
    ) -> Tuple[Optional[int], str, Optional[str]]:
        self.calls.append(
            {"url": url, "payload": payload, "headers": headers, "timeout": timeout}
        )
        for fragment, response in self.responses.items():
            if fragment in url:
                return response
        return None, "", "no stubbed response for this endpoint"

    def call_for(self, fragment: str) -> Optional[Dict[str, Any]]:
        return next((c for c in self.calls if fragment in c["url"]), None)


@pytest.fixture
def configure_providers(monkeypatch):
    """Configure provider credentials, with all outbound HTTP stubbed.

    The paid indexers ship disabled (free-only default), so tests that exercise
    them re-enable them here via ``enable_paid`` + ``provider_order``. WebSub is
    left unconfigured (no feed URL) by default so it records a harmless
    ``skipped`` attempt; pass ``websub_feed_url`` to exercise it. Both
    ``post_json`` and ``post_form`` are routed through the same stub.
    """

    def _apply(
        responses: Dict[str, Tuple[Optional[int], str, Optional[str]]],
        *,
        indexnow_key: str = "test-indexnow-key",
        owned_domains: str = "pintdown.site",
        indexbolt_key: str = "ib_test_key",
        rapid_key: str = "rui_test_key",
        enable_paid: bool = True,
        provider_order: str = "indexbolt,rapid_url_indexer",
        websub_feed_url: str = "",
        websub_hubs: str = "https://pubsubhubbub.appspot.com,https://websubhub.com",
        google_client_email: str = "",
        google_private_key: str = "",
    ) -> FakeTransport:
        monkeypatch.setattr(settings, "indexnow_key", indexnow_key)
        monkeypatch.setattr(settings, "owned_domains_csv", owned_domains)
        monkeypatch.setattr(settings, "indexbolt_api_key", indexbolt_key)
        monkeypatch.setattr(settings, "rapidurlindexer_api_key", rapid_key)
        monkeypatch.setattr(settings, "indexbolt_enabled", enable_paid)
        monkeypatch.setattr(settings, "rapidurlindexer_enabled", enable_paid)
        monkeypatch.setattr(settings, "indexer_provider_order_csv", provider_order)
        monkeypatch.setattr(settings, "websub_enabled", True)
        monkeypatch.setattr(settings, "websub_feed_url", websub_feed_url)
        monkeypatch.setattr(settings, "websub_hub_urls_csv", websub_hubs)
        # Google Indexing API is opt-in via FI_INDEXER_PROVIDER_ORDER, same as
        # the paid indexers. Credentials alone must not make it fire; tests that
        # exercise it pass provider_order="google_indexing".
        monkeypatch.setattr(settings, "google_indexing_enabled", True)
        monkeypatch.setattr(settings, "google_indexing_client_email", google_client_email)
        monkeypatch.setattr(settings, "google_indexing_private_key", google_private_key)
        transport = FakeTransport(responses)
        monkeypatch.setattr(providers_module, "post_json", transport)
        monkeypatch.setattr(providers_module, "post_form", transport)
        return transport

    return _apply


# ---------------------------------------------------------------------------
# URL handling
# ---------------------------------------------------------------------------
def test_normalise_url_lowercases_host_but_preserves_path_case():
    assert normalise_url("HTTPS://Example.COM/Path/To") == "https://example.com/Path/To"


def test_normalise_url_strips_fragment_and_whitespace():
    assert normalise_url("  https://a.com/p?x=1#frag  ") == "https://a.com/p?x=1"


@pytest.mark.parametrize(
    "bad",
    ["", "   ", "not-a-url", "ftp://example.com/x", "javascript:alert(1)", "https://"],
)
def test_normalise_url_rejects_unsubmittable_input(bad):
    assert normalise_url(bad) is None


def test_normalise_url_rejects_overlong_url():
    assert normalise_url("https://a.com/" + "x" * 2100) is None


def test_split_urls_accepts_blob_or_list():
    assert split_urls("https://a.com\n\nhttps://b.com\n") == [
        "https://a.com",
        "https://b.com",
    ]
    assert split_urls(["https://a.com"]) == ["https://a.com"]


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------
async def test_bulk_import_dedupes_and_reports_invalid(session):
    svc = IndexerDispatchService(session)
    outcome = await svc.bulk_import(
        TENANT,
        # Second entry is the same URL with a different host case.
        "https://a.com/one\nhttps://A.com/one\nhttps://b.com/two\nnot-a-url",
    )
    assert len(outcome.created) == 2
    assert outcome.skipped_duplicates == 1
    assert outcome.invalid == ["not-a-url"]


async def test_bulk_import_skips_urls_already_stored(session):
    svc = IndexerDispatchService(session)
    await svc.bulk_import(TENANT, "https://a.com/one")
    second = await svc.bulk_import(TENANT, "https://a.com/one\nhttps://a.com/two")
    assert len(second.created) == 1
    assert second.skipped_duplicates == 1


async def test_create_backlink_returns_existing_row_for_duplicate(session):
    svc = IndexerDispatchService(session)
    first = await svc.create_backlink(TENANT, url="https://a.com/x")
    second = await svc.create_backlink(TENANT, url="https://a.com/x")
    assert first is not None and second is not None
    assert first.id == second.id


async def test_create_backlink_rejects_invalid_url(session):
    svc = IndexerDispatchService(session)
    assert await svc.create_backlink(TENANT, url="nope") is None


# ---------------------------------------------------------------------------
# CSV import (shares the bulk-import insertion path)
# ---------------------------------------------------------------------------
async def test_import_csv_creates_rows_with_metadata_and_dispatches(
    session, configure_providers
):
    configure_providers(
        {"pubsubhubbub.appspot.com": (202, "", None)},
        enable_paid=False,
        provider_order="",
        websub_feed_url="https://pintdown.site/feed.xml",
    )
    svc = IndexerDispatchService(session)
    csv_bytes = (
        b"url,title,platform,rel_type,notes\n"
        b"https://reddit.com/r/a/1,First,reddit,nofollow,hello\n"
        b"https://news.ycombinator.com/item?id=2,HN post,hackernews,ugc,world\n"
    )

    outcome = await svc.import_csv(TENANT, csv_bytes)

    assert len(outcome.created) == 2
    assert outcome.invalid == []
    first = outcome.created[0]
    assert first.title == "First"
    assert first.platform == "reddit"
    assert first.rel_type == "nofollow"
    assert first.notes == "hello"
    assert first.domain == "reddit.com"
    # Dispatched through the free-signal pipeline; WebSub reaches Google.
    assert first.dispatch_status == DISPATCH_SUBMITTED
    assert first.dispatch_method == METHOD_WEBSUB


async def test_import_csv_reports_invalid_rows_with_row_numbers(session):
    svc = IndexerDispatchService(session)
    csv_bytes = (
        b"url,title\n"
        b"https://good.com/1,ok\n"
        b"not-a-url,bad\n"
        b"ftp://nope.com/x,bad scheme\n"
    )

    outcome = await svc.import_csv(TENANT, csv_bytes, dispatch=False)

    assert len(outcome.created) == 1
    assert outcome.created[0].domain == "good.com"
    assert any("Row 3" in e and "not-a-url" in e for e in outcome.invalid)
    assert any("Row 4" in e for e in outcome.invalid)


async def test_import_csv_only_optional_columns_present_are_mapped(session):
    svc = IndexerDispatchService(session)
    # url plus a subset of optional columns in a different order; a 'domain'
    # column is present but ignored in favour of the host from the URL.
    csv_bytes = (
        b"platform,url,domain,country\n"
        b"producthunt,https://producthunt.com/posts/foo,WRONG.example,US\n"
    )

    outcome = await svc.import_csv(TENANT, csv_bytes, dispatch=False)

    assert len(outcome.created) == 1
    row = outcome.created[0]
    assert row.platform == "producthunt"
    assert row.country == "US"
    assert row.domain == "producthunt.com"  # derived, not the WRONG.example column


async def test_import_csv_empty_file_is_rejected(session):
    svc = IndexerDispatchService(session)
    with pytest.raises(ValueError):
        await svc.import_csv(TENANT, b"", dispatch=False)


async def test_import_csv_missing_url_column_is_rejected(session):
    svc = IndexerDispatchService(session)
    with pytest.raises(ValueError):
        await svc.import_csv(TENANT, b"title,platform\nHello,reddit\n", dispatch=False)


async def test_import_csv_malformed_rows_are_handled_without_raising(session):
    svc = IndexerDispatchService(session)
    # Irregular/malformed rows: wrong column counts, stray commas, blank line.
    # The import must degrade gracefully (never raise / 500): keep the good row,
    # report the rest.
    csv_bytes = (
        b"url,title\n"
        b"https://ok.com/1,fine\n"
        b"this is, not a url, with, too, many, commas\n"
        b",,,\n"
    )

    outcome = await svc.import_csv(TENANT, csv_bytes, dispatch=False)

    assert len(outcome.created) == 1
    assert outcome.created[0].domain == "ok.com"
    # Both malformed lines are reported with their row numbers.
    assert any("Row 3" in e for e in outcome.invalid)
    assert any("Row 4" in e for e in outcome.invalid)


async def test_import_csv_dedupes_within_file_and_against_existing(session):
    svc = IndexerDispatchService(session)
    await svc.bulk_import(TENANT, "https://dupe.com/x")

    csv_bytes = (
        b"url\n"
        b"https://dupe.com/x\n"        # already stored
        b"https://fresh.com/y\n"
        b"https://FRESH.com/y\n"        # same as previous after normalisation
    )
    outcome = await svc.import_csv(TENANT, csv_bytes, dispatch=False)

    assert len(outcome.created) == 1
    assert outcome.created[0].domain == "fresh.com"
    assert outcome.skipped_duplicates == 2


# ---------------------------------------------------------------------------
# IndexNow branching
# ---------------------------------------------------------------------------
async def test_indexnow_skipped_for_domain_we_do_not_own(session, configure_providers):
    transport = configure_providers(
        {"indexbolt.com": (201, '{"success":true,"data":{"submissionId":"sub_1"}}', None)}
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://someoneelse.com/post")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    indexnow = next(a for a in outcome.attempts if a.method == METHOD_INDEXNOW)
    assert indexnow.status == ATTEMPT_NOT_APPLICABLE
    assert "FI_OWNED_DOMAINS" in (indexnow.error or "")
    # No IndexNow HTTP call should have been attempted at all.
    assert transport.call_for("indexnow.org") is None


async def test_indexnow_fires_for_owned_domain_with_spec_payload(session, configure_providers):
    transport = configure_providers(
        {
            "indexnow.org": (200, "", None),
            "indexbolt.com": (201, '{"success":true,"data":{"submissionId":"sub_1"}}', None),
        }
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/page")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    indexnow = next(a for a in outcome.attempts if a.method == METHOD_INDEXNOW)
    assert indexnow.status == ATTEMPT_SUCCESS
    assert indexnow.response_code == 200

    sent = transport.call_for("indexnow.org")
    assert sent is not None
    assert sent["payload"] == {
        "host": "pintdown.site",
        "key": "test-indexnow-key",
        "keyLocation": "https://pintdown.site/test-indexnow-key.txt",
        "urlList": ["https://pintdown.site/page"],
    }
    assert sent["timeout"] == settings.indexer_http_timeout_seconds


async def test_indexnow_matches_subdomains_of_owned_domain(session, configure_providers):
    configure_providers({"indexnow.org": (202, "", None), "indexbolt.com": (201, "{}", None)})
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://blog.pintdown.site/post")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    indexnow = next(a for a in outcome.attempts if a.method == METHOD_INDEXNOW)
    assert indexnow.status == ATTEMPT_SUCCESS
    assert indexnow.response_code == 202


async def test_indexnow_key_is_redacted_in_ping_log(session, configure_providers):
    configure_providers({"indexnow.org": (200, "", None), "indexbolt.com": (201, "{}", None)})
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/page")
    await svc.dispatch_backlink(TENANT, backlink)

    logs = await svc.logs_for_backlink(TENANT, backlink.id)
    indexnow_log = next(log for log in logs if log.method == METHOD_INDEXNOW)
    serialised = str(indexnow_log.request_payload)
    assert "test-indexnow-key" not in serialised
    assert "\u2026(17 chars)" in serialised


# ---------------------------------------------------------------------------
# WebSub (the only free channel that can reach Google for third-party URLs)
# ---------------------------------------------------------------------------
async def test_websub_skipped_when_no_feed_configured(session, configure_providers):
    configure_providers({"indexbolt.com": (201, "{}", None)})  # no websub_feed_url
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://third-party.com/w")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    websub = next(a for a in outcome.attempts if a.method == METHOD_WEBSUB)
    assert websub.status == ATTEMPT_SKIPPED
    assert "FI_WEBSUB_FEED_URL" in (websub.error or "")


async def test_websub_publishes_feed_to_hub_for_third_party_url(session, configure_providers):
    transport = configure_providers(
        {"pubsubhubbub.appspot.com": (202, "", None)},
        indexnow_key="",  # isolate WebSub as the only active free signal
        owned_domains="",
        enable_paid=False,
        provider_order="",
        websub_feed_url="https://pintdown.site/feed.xml",
    )
    svc = IndexerDispatchService(session)
    # A URL on a domain we do NOT own — exactly what IndexNow cannot handle.
    backlink = await svc.create_backlink(TENANT, url="https://reddit.com/r/x/comments/abc")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_status == DISPATCH_SUBMITTED
    assert outcome.dispatch_method == METHOD_WEBSUB
    assert outcome.summary == "signal sent via WebSub (Google/Bing feed discovery)"
    assert backlink.index_status == INDEX_PINGED

    sent = transport.call_for("pubsubhubbub.appspot.com")
    assert sent is not None
    assert sent["payload"] == {
        "hub.mode": "publish",
        "hub.url": "https://pintdown.site/feed.xml",
    }


async def test_websub_fires_for_third_party_url_where_indexnow_is_not_applicable(
    session, configure_providers
):
    configure_providers(
        {"pubsubhubbub.appspot.com": (202, "", None)},
        enable_paid=False,
        provider_order="",
        websub_feed_url="https://pintdown.site/feed.xml",
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://producthunt.com/posts/foo")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    indexnow = next(a for a in outcome.attempts if a.method == METHOD_INDEXNOW)
    websub = next(a for a in outcome.attempts if a.method == METHOD_WEBSUB)
    assert indexnow.status == ATTEMPT_NOT_APPLICABLE
    assert websub.status == ATTEMPT_SUCCESS
    assert outcome.dispatch_method == METHOD_WEBSUB


async def test_websub_outranks_indexnow_for_owned_domain(session, configure_providers):
    configure_providers(
        {
            "indexnow.org": (200, "", None),
            "pubsubhubbub.appspot.com": (202, "", None),
        },
        enable_paid=False,
        provider_order="",
        websub_feed_url="https://pintdown.site/feed.xml",
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/own-page")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    indexnow = next(a for a in outcome.attempts if a.method == METHOD_INDEXNOW)
    websub = next(a for a in outcome.attempts if a.method == METHOD_WEBSUB)
    assert indexnow.status == ATTEMPT_SUCCESS
    assert websub.status == ATTEMPT_SUCCESS
    # Both free signals fired; WebSub is recorded because it is the one that
    # reaches Google, while IndexNow reaches only Bing/Yandex.
    assert outcome.dispatch_method == METHOD_WEBSUB
    assert outcome.summary == "signal sent via WebSub (Google/Bing feed discovery)"


async def test_indexnow_only_success_uses_honest_bing_yandex_summary(
    session, configure_providers
):
    configure_providers(
        {"indexnow.org": (200, "", None)},
        enable_paid=False,
        provider_order="",
        # websub_feed_url left empty -> WebSub is skipped, so IndexNow wins.
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/only")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_method == METHOD_INDEXNOW
    assert outcome.summary == "signal sent via IndexNow (Bing/Yandex — not Google)"


async def test_websub_failure_is_reported_without_faking_a_signal(
    session, configure_providers
):
    configure_providers(
        {
            "pubsubhubbub.appspot.com": (503, "hub down", None),
            "websubhub.com": (500, "relay down", None),
        },
        indexnow_key="",
        owned_domains="",
        enable_paid=False,
        provider_order="",
        websub_feed_url="https://pintdown.site/feed.xml",
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://third-party.com/down")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_status == DISPATCH_FAILED
    websub = next(a for a in outcome.attempts if a.method == METHOD_WEBSUB)
    assert websub.status == ATTEMPT_FAILED
    assert backlink.index_status == INDEX_PENDING


# ---------------------------------------------------------------------------
# Google Indexing API (opt-in, owner-only, direct Google notification)
# ---------------------------------------------------------------------------
async def test_google_indexing_does_not_fire_when_not_in_provider_order(
    session, configure_providers
):
    # Valid credentials, owned domain, even enabled — but FI_INDEXER_PROVIDER_ORDER
    # is unset, so the channel must not be attempted at all. Opt-in is the order
    # list, not the mere presence of a service account.
    transport = configure_providers(
        {
            "oauth2.googleapis.com": (200, GOOGLE_TOKEN_OK, None),
            "indexing.googleapis.com": (200, "{}", None),
            "indexnow.org": (200, "", None),
        },
        enable_paid=False,
        provider_order="",
        google_client_email=GOOGLE_TEST_CLIENT_EMAIL,
        google_private_key=GOOGLE_TEST_PRIVATE_KEY,
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/no-opt-in")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert METHOD_GOOGLE_INDEXING not in {a.method for a in outcome.attempts}
    assert transport.call_for("oauth2.googleapis.com") is None
    assert transport.call_for("indexing.googleapis.com") is None
    # Free channels still run; IndexNow owns this host.
    assert outcome.dispatch_method == METHOD_INDEXNOW


async def test_google_indexing_skipped_when_no_service_account(session, configure_providers):
    # Opted in via FI_INDEXER_PROVIDER_ORDER, but no service account: the
    # channel records a skipped attempt rather than pretending to have submitted.
    configure_providers(
        {"indexnow.org": (200, "", None)},
        enable_paid=False,
        provider_order="google_indexing",
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/no-sa")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    google = next(a for a in outcome.attempts if a.method == METHOD_GOOGLE_INDEXING)
    assert google.status == ATTEMPT_SKIPPED
    assert "FI_GOOGLE_INDEXING_CLIENT_EMAIL" in (google.error or "")


async def test_google_indexing_not_applicable_for_third_party_domain(
    session, configure_providers
):
    # Configured, but the URL is on a domain we do not own: owner-only, so it is
    # not_applicable — and no OAuth/token call is even attempted.
    transport = configure_providers(
        {"pubsubhubbub.appspot.com": (202, "", None)},
        indexnow_key="",
        enable_paid=False,
        provider_order="google_indexing",
        websub_feed_url="https://pintdown.site/feed.xml",
        google_client_email=GOOGLE_TEST_CLIENT_EMAIL,
        google_private_key=GOOGLE_TEST_PRIVATE_KEY,
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://reddit.com/r/x/comments/abc")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    google = next(a for a in outcome.attempts if a.method == METHOD_GOOGLE_INDEXING)
    assert google.status == ATTEMPT_NOT_APPLICABLE
    assert "owner-only" in (google.error or "")
    # It must not have tried to authenticate for a URL it cannot submit.
    assert transport.call_for("oauth2.googleapis.com") is None
    # WebSub still carries third-party URLs to Google.
    assert outcome.dispatch_method == METHOD_WEBSUB


async def test_google_indexing_publishes_for_owned_domain_with_signed_jwt(
    session, configure_providers
):
    transport = configure_providers(
        {
            "oauth2.googleapis.com": (200, GOOGLE_TOKEN_OK, None),
            "indexing.googleapis.com": (
                200,
                '{"urlNotificationMetadata":{"url":"https://pintdown.site/own","latestUpdate":{"type":"URL_UPDATED"}}}',
                None,
            ),
        },
        indexnow_key="",  # isolate Google Indexing as the only active channel
        enable_paid=False,
        provider_order="google_indexing",
        google_client_email=GOOGLE_TEST_CLIENT_EMAIL,
        google_private_key=GOOGLE_TEST_PRIVATE_KEY,
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/own")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_status == DISPATCH_SUBMITTED
    assert outcome.dispatch_method == METHOD_GOOGLE_INDEXING
    assert outcome.summary == (
        "signal sent via Google Indexing API (owned domains only; official for "
        "JobPosting/BroadcastEvent — misuse can revoke API access, not a domain penalty)"
    )
    assert backlink.index_status == INDEX_PINGED

    # The token exchange used a genuinely RS256-signed assertion for our account.
    token_call = transport.call_for("oauth2.googleapis.com")
    assert token_call is not None
    assert (
        token_call["payload"]["grant_type"]
        == "urn:ietf:params:oauth:grant-type:jwt-bearer"
    )
    decoded = jwt.decode(
        token_call["payload"]["assertion"],
        GOOGLE_TEST_PUBLIC_KEY,
        algorithms=["RS256"],
        audience=settings.google_indexing_token_uri,
    )
    assert decoded["iss"] == GOOGLE_TEST_CLIENT_EMAIL
    assert decoded["scope"] == "https://www.googleapis.com/auth/indexing"

    # The publish call carried the bearer token and the spec payload.
    publish = transport.call_for("indexing.googleapis.com")
    assert publish is not None
    assert publish["headers"]["Authorization"] == "Bearer ya29.test-token"
    assert publish["payload"] == {"url": "https://pintdown.site/own", "type": "URL_UPDATED"}


async def test_google_indexing_never_persists_key_or_token_in_audit_trail(
    session, configure_providers
):
    configure_providers(
        {
            "oauth2.googleapis.com": (200, GOOGLE_TOKEN_OK, None),
            "indexing.googleapis.com": (200, "{}", None),
        },
        indexnow_key="",
        enable_paid=False,
        provider_order="google_indexing",
        google_client_email=GOOGLE_TEST_CLIENT_EMAIL,
        google_private_key=GOOGLE_TEST_PRIVATE_KEY,
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/audit")
    await svc.dispatch_backlink(TENANT, backlink)

    logs = await svc.logs_for_backlink(TENANT, backlink.id)
    google_log = next(log for log in logs if log.method == METHOD_GOOGLE_INDEXING)
    serialised = str(google_log.request_payload)
    assert "PRIVATE KEY" not in serialised
    assert "ya29.test-token" not in serialised
    # The account identifier is fine to record for a diagnosable audit trail.
    assert GOOGLE_TEST_CLIENT_EMAIL in serialised


async def test_google_indexing_403_ownership_is_reported_without_faking_success(
    session, configure_providers
):
    configure_providers(
        {
            "oauth2.googleapis.com": (200, GOOGLE_TOKEN_OK, None),
            "indexing.googleapis.com": (
                403,
                '{"error":{"code":403,"message":"Permission denied. Failed to verify the URL ownership."}}',
                None,
            ),
        },
        indexnow_key="",
        enable_paid=False,
        provider_order="google_indexing",
        google_client_email=GOOGLE_TEST_CLIENT_EMAIL,
        google_private_key=GOOGLE_TEST_PRIVATE_KEY,
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/forbidden")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_status == DISPATCH_FAILED
    google = next(a for a in outcome.attempts if a.method == METHOD_GOOGLE_INDEXING)
    assert google.status == ATTEMPT_FAILED
    assert google.response_code == 403
    assert "Owner" in (google.error or "")
    assert backlink.index_status == INDEX_PENDING


async def test_google_indexing_quota_exhausted_reports_out_of_credits(
    session, configure_providers
):
    configure_providers(
        {
            "oauth2.googleapis.com": (200, GOOGLE_TOKEN_OK, None),
            "indexing.googleapis.com": (429, '{"error":{"message":"quota"}}', None),
        },
        indexnow_key="",
        enable_paid=False,
        provider_order="google_indexing",
        google_client_email=GOOGLE_TEST_CLIENT_EMAIL,
        google_private_key=GOOGLE_TEST_PRIVATE_KEY,
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/quota")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    google = next(a for a in outcome.attempts if a.method == METHOD_GOOGLE_INDEXING)
    assert google.status == ATTEMPT_OUT_OF_CREDITS
    assert google.response_code == 429


async def test_google_indexing_token_failure_skips_publish(session, configure_providers):
    transport = configure_providers(
        {
            "oauth2.googleapis.com": (
                400,
                '{"error":"invalid_grant","error_description":"Invalid JWT Signature."}',
                None,
            ),
            "indexing.googleapis.com": (200, "{}", None),
        },
        indexnow_key="",
        enable_paid=False,
        provider_order="google_indexing",
        google_client_email=GOOGLE_TEST_CLIENT_EMAIL,
        google_private_key=GOOGLE_TEST_PRIVATE_KEY,
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/badtoken")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    google = next(a for a in outcome.attempts if a.method == METHOD_GOOGLE_INDEXING)
    assert google.status == ATTEMPT_FAILED
    assert "OAuth token request rejected" in (google.error or "")
    # Without a token we must never call the publish endpoint.
    assert transport.call_for("indexing.googleapis.com") is None


async def test_google_indexing_outranks_websub_for_owned_domain(session, configure_providers):
    configure_providers(
        {
            "oauth2.googleapis.com": (200, GOOGLE_TOKEN_OK, None),
            "indexing.googleapis.com": (200, "{}", None),
            "pubsubhubbub.appspot.com": (202, "", None),
        },
        indexnow_key="",
        enable_paid=False,
        provider_order="google_indexing",
        websub_feed_url="https://pintdown.site/feed.xml",
        google_client_email=GOOGLE_TEST_CLIENT_EMAIL,
        google_private_key=GOOGLE_TEST_PRIVATE_KEY,
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/both")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    google = next(a for a in outcome.attempts if a.method == METHOD_GOOGLE_INDEXING)
    websub = next(a for a in outcome.attempts if a.method == METHOD_WEBSUB)
    assert google.status == ATTEMPT_SUCCESS
    assert websub.status == ATTEMPT_SUCCESS
    # Both Google-reaching signals fired; the direct API notification is the
    # one recorded, as it outranks WebSub's indirect feed discovery.
    assert outcome.dispatch_method == METHOD_GOOGLE_INDEXING


# ---------------------------------------------------------------------------
# Free-only defaults
# ---------------------------------------------------------------------------
async def test_paid_providers_are_disabled_by_default(session):
    # No settings monkeypatching: this is the production default configuration.
    # Only the always-on free channels appear. The Google Indexing API is
    # opt-in (FI_INDEXER_PROVIDER_ORDER) so it is absent, as are the paid ones.
    svc = IndexerDispatchService(session)
    statuses = {s["method"] for s in svc.provider_statuses()}
    assert statuses == {METHOD_INDEXNOW, METHOD_WEBSUB}
    assert METHOD_GOOGLE_INDEXING not in statuses
    assert METHOD_INDEXBOLT not in statuses
    assert METHOD_RAPID_URL_INDEXER not in statuses


async def test_paid_indexer_outranks_free_signals_when_explicitly_enabled(
    session, configure_providers
):
    configure_providers(
        {
            "indexnow.org": (200, "", None),
            "pubsubhubbub.appspot.com": (202, "", None),
            "indexbolt.com": (201, '{"data":{"submissionId":"sub_paid"}}', None),
        },
        websub_feed_url="https://pintdown.site/feed.xml",
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/own")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_method == METHOD_INDEXBOLT
    assert outcome.summary == "submitted via IndexBolt"
    assert backlink.external_ref == "sub_paid"


# ---------------------------------------------------------------------------
# Third-party chain and fallback
# ---------------------------------------------------------------------------
async def test_indexbolt_is_primary_and_stops_the_chain(session, configure_providers):
    transport = configure_providers(
        {"indexbolt.com": (201, '{"success":true,"data":{"submissionId":"sub_abc"}}', None)}
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://third-party.com/a")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_status == DISPATCH_SUBMITTED
    assert outcome.dispatch_method == METHOD_INDEXBOLT
    assert outcome.summary == "submitted via IndexBolt"
    assert backlink.external_ref == "sub_abc"
    # The fallback must not have been contacted.
    assert transport.call_for("rapidurlindexer.com") is None


async def test_falls_back_to_rapid_url_indexer_when_indexbolt_out_of_credits(
    session, configure_providers
):
    configure_providers(
        {
            "indexbolt.com": (
                402,
                '{"success":false,"error":{"code":"INSUFFICIENT_CREDITS","message":"no credits"}}',
                None,
            ),
            "rapidurlindexer.com": (201, '{"message":"created","project_id":123}', None),
        }
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://third-party.com/b")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_status == DISPATCH_SUBMITTED
    assert outcome.dispatch_method == METHOD_RAPID_URL_INDEXER
    assert outcome.summary == "submitted via Rapid URL Indexer"
    assert backlink.external_ref == "123"

    bolt = next(a for a in outcome.attempts if a.method == METHOD_INDEXBOLT)
    assert bolt.status == ATTEMPT_OUT_OF_CREDITS
    assert bolt.response_code == 402


async def test_falls_back_when_indexbolt_times_out(session, configure_providers):
    configure_providers(
        {
            "indexbolt.com": (None, "", "TimeoutException: request timed out"),
            "rapidurlindexer.com": (201, '{"project_id":7}', None),
        }
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://third-party.com/c")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_method == METHOD_RAPID_URL_INDEXER
    bolt = next(a for a in outcome.attempts if a.method == METHOD_INDEXBOLT)
    assert bolt.response_code is None
    assert "Timeout" in (bolt.error or "")


async def test_all_providers_failing_marks_backlink_failed(session, configure_providers):
    configure_providers(
        {
            "indexbolt.com": (500, "upstream exploded", None),
            "rapidurlindexer.com": (500, "also exploded", None),
        }
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://third-party.com/d")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_status == DISPATCH_FAILED
    assert outcome.dispatch_method is None
    assert outcome.summary == "failed"
    assert METHOD_INDEXBOLT in (backlink.last_error or "")
    assert METHOD_RAPID_URL_INDEXER in (backlink.last_error or "")
    # A failed dispatch must not claim the URL was pinged.
    assert backlink.index_status == INDEX_PENDING


async def test_unconfigured_providers_yield_skipped_not_success(session, monkeypatch):
    monkeypatch.setattr(settings, "indexnow_key", "")
    monkeypatch.setattr(settings, "owned_domains_csv", "")
    monkeypatch.setattr(settings, "indexbolt_api_key", "")
    monkeypatch.setattr(settings, "rapidurlindexer_api_key", "")

    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://third-party.com/e")

    outcome = await svc.dispatch_backlink(TENANT, backlink)

    assert outcome.dispatch_status == DISPATCH_SKIPPED
    assert outcome.summary == "skipped (no provider configured)"
    assert all(a.status == ATTEMPT_SKIPPED for a in outcome.attempts)
    assert backlink.index_status == INDEX_PENDING


async def test_success_moves_index_status_to_pinged_only_from_pending(
    session, configure_providers
):
    configure_providers({"indexbolt.com": (201, '{"data":{"submissionId":"s1"}}', None)})
    svc = IndexerDispatchService(session)

    backlink = await svc.create_backlink(TENANT, url="https://third-party.com/f")
    await svc.dispatch_backlink(TENANT, backlink)
    assert backlink.index_status == INDEX_PINGED

    # A human marking the URL indexed must not be overwritten by a re-ping.
    await svc.set_index_status(TENANT, backlink.id, "indexed")
    await svc.dispatch_backlink(TENANT, backlink)
    assert backlink.index_status == "indexed"


# ---------------------------------------------------------------------------
# Ping log audit trail
# ---------------------------------------------------------------------------
async def test_every_attempt_is_logged_with_response_code(session, configure_providers):
    configure_providers(
        {
            "indexnow.org": (200, "", None),
            "indexbolt.com": (402, '{"error":{"message":"no credits"}}', None),
            "rapidurlindexer.com": (201, '{"project_id":9}', None),
        }
    )
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://pintdown.site/g")

    await svc.dispatch_backlink(TENANT, backlink)

    logs = await svc.logs_for_backlink(TENANT, backlink.id)
    by_method = {log.method: log for log in logs}
    assert set(by_method) == {
        METHOD_INDEXNOW,
        METHOD_WEBSUB,
        METHOD_INDEXBOLT,
        METHOD_RAPID_URL_INDEXER,
    }
    assert by_method[METHOD_INDEXNOW].response_code == 200
    # WebSub is always attempted; here it is skipped (no feed URL configured).
    assert by_method[METHOD_WEBSUB].status == ATTEMPT_SKIPPED
    # Google Indexing API is opt-in; with the default paid-only order it must
    # not appear in the attempt list at all.
    assert METHOD_GOOGLE_INDEXING not in by_method
    assert by_method[METHOD_INDEXBOLT].response_code == 402
    assert by_method[METHOD_RAPID_URL_INDEXER].response_code == 201
    assert by_method[METHOD_RAPID_URL_INDEXER].external_ref == "9"
    assert all(log.endpoint for log in logs)
    assert all(log.attempt == 1 for log in logs)


async def test_repeat_dispatch_increments_attempt_number(session, configure_providers):
    configure_providers({"indexbolt.com": (201, '{"data":{"submissionId":"s"}}', None)})
    svc = IndexerDispatchService(session)
    backlink = await svc.create_backlink(TENANT, url="https://third-party.com/h")

    await svc.dispatch_backlink(TENANT, backlink)
    await svc.dispatch_backlink(TENANT, backlink)

    logs = await svc.logs_for_backlink(TENANT, backlink.id)
    bolt_attempts = sorted(
        log.attempt for log in logs if log.method == METHOD_INDEXBOLT
    )
    assert bolt_attempts == [1, 2]
    assert backlink.dispatch_attempts == 2


async def test_ping_logs_are_tenant_scoped(session, configure_providers):
    configure_providers({"indexbolt.com": (201, "{}", None)})
    svc = IndexerDispatchService(session)
    mine = await svc.create_backlink(TENANT, url="https://third-party.com/i")
    await svc.dispatch_backlink(TENANT, mine)

    assert await svc.recent_logs("tenant-2") == []
    assert await svc.logs_for_backlink("tenant-2", mine.id) == []


# ---------------------------------------------------------------------------
# Batch dispatch and listing
# ---------------------------------------------------------------------------
async def test_dispatch_pending_processes_only_pending_rows(session, configure_providers):
    configure_providers({"indexbolt.com": (201, '{"data":{"submissionId":"s"}}', None)})
    svc = IndexerDispatchService(session)
    await svc.bulk_import(TENANT, "https://a.com/1\nhttps://a.com/2\nhttps://a.com/3")

    first = await svc.dispatch_pending(TENANT)
    assert len(first) == 3
    assert all(o.dispatch_status == DISPATCH_SUBMITTED for o in first)

    # Nothing remains pending, so a second sweep is a no-op.
    assert await svc.dispatch_pending(TENANT) == []


async def test_list_backlinks_filters_by_status_and_query(session, configure_providers):
    configure_providers({"indexbolt.com": (201, '{"data":{"submissionId":"s"}}', None)})
    svc = IndexerDispatchService(session)
    await svc.create_backlink(TENANT, url="https://alpha.com/keep")
    beta = await svc.create_backlink(TENANT, url="https://beta.com/other")
    await svc.dispatch_backlink(TENANT, beta)

    submitted, total = await svc.list_backlinks(TENANT, dispatch_status=DISPATCH_SUBMITTED)
    assert total == 1 and submitted[0].domain == "beta.com"

    matched, total = await svc.list_backlinks(TENANT, query="alpha")
    assert total == 1 and matched[0].domain == "alpha.com"


async def test_provider_statuses_never_leak_keys(session, configure_providers):
    configure_providers(
        {"indexbolt.com": (201, "{}", None)},
        websub_feed_url="https://pintdown.site/feed.xml",
        provider_order="google_indexing,indexbolt,rapid_url_indexer",
        google_client_email="svc@proj.iam.gserviceaccount.com",
        google_private_key="-----BEGIN PRIVATE KEY-----\nSECRETKEYMATERIAL\n-----END PRIVATE KEY-----",
    )
    svc = IndexerDispatchService(session)

    statuses = svc.provider_statuses()
    methods = {s["method"] for s in statuses}
    assert methods == {
        METHOD_INDEXNOW,
        METHOD_WEBSUB,
        METHOD_GOOGLE_INDEXING,
        METHOD_INDEXBOLT,
        METHOD_RAPID_URL_INDEXER,
    }
    assert all(s["configured"] for s in statuses)
    blob = str(statuses)
    assert "ib_test_key" not in blob
    assert "test-indexnow-key" not in blob
    # The provider status report must never surface the service account key.
    assert "SECRETKEYMATERIAL" not in blob


# ---------------------------------------------------------------------------
# HTTP API
# ---------------------------------------------------------------------------
async def test_api_bulk_import_then_dispatch_and_read_logs(
    client, auth_headers, configure_providers
):
    configure_providers({"indexbolt.com": (201, '{"data":{"submissionId":"sub_x"}}', None)})

    created = await client.post(
        "/api/indexing/backlinks/bulk",
        json={"urls": "https://x.com/1\nhttps://x.com/2\nbroken", "dispatch": True},
        headers=auth_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["created"] == 2
    assert body["invalid"] == ["broken"]

    listed = await client.get("/api/indexing/backlinks", headers=auth_headers)
    assert listed.status_code == 200
    assert listed.json()["total"] == 2

    backlink_id = body["backlink_ids"][0]
    logs = await client.get(
        f"/api/indexing/backlinks/{backlink_id}/logs", headers=auth_headers
    )
    assert logs.status_code == 200
    assert any(log["response_code"] == 201 for log in logs.json())


async def test_api_import_csv_uploads_file_creates_and_dispatches(
    client, auth_headers, configure_providers
):
    configure_providers(
        {"pubsubhubbub.appspot.com": (202, "", None)},
        enable_paid=False,
        provider_order="",
        websub_feed_url="https://pintdown.site/feed.xml",
    )
    csv_bytes = (
        b"url,title,platform\n"
        b"https://example.com/a,Alpha,directory\n"
        b"https://example.com/b,Beta,directory\n"
        b"not-a-url,Bad,directory\n"
    )

    res = await client.post(
        "/api/indexing/backlinks/import-csv",
        files={"file": ("backlinks.csv", csv_bytes, "text/csv")},
        headers=auth_headers,
    )

    assert res.status_code == 201
    body = res.json()
    assert body["created"] == 2
    assert body["skipped_duplicates"] == 0
    assert any("Row 4" in e for e in body["errors"])
    assert len(body["backlink_ids"]) == 2

    # Rows really landed in the table.
    listed = await client.get("/api/indexing/backlinks", headers=auth_headers)
    assert listed.json()["total"] == 2

    # And they were dispatched through the free-signal pipeline.
    bid = body["backlink_ids"][0]
    logs = await client.get(f"/api/indexing/backlinks/{bid}/logs", headers=auth_headers)
    assert logs.status_code == 200
    assert any(log["method"] == METHOD_WEBSUB for log in logs.json())


async def test_api_import_csv_missing_url_column_returns_400(client, auth_headers):
    res = await client.post(
        "/api/indexing/backlinks/import-csv",
        files={"file": ("bad.csv", b"title,platform\nHello,reddit\n", "text/csv")},
        headers=auth_headers,
    )
    assert res.status_code == 400
    assert "url" in (res.json().get("detail") or "").lower()


async def test_api_import_csv_empty_file_returns_400(client, auth_headers):
    res = await client.post(
        "/api/indexing/backlinks/import-csv",
        files={"file": ("empty.csv", b"", "text/csv")},
        headers=auth_headers,
    )
    assert res.status_code == 400


async def test_api_manual_reping_reports_the_winning_method(
    client, auth_headers, configure_providers
):
    configure_providers({"indexbolt.com": (201, '{"data":{"submissionId":"sub_y"}}', None)})
    created = await client.post(
        "/api/indexing/backlinks",
        json={"url": "https://y.com/page"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    backlink_id = created.json()["id"]

    dispatched = await client.post(
        f"/api/indexing/backlinks/{backlink_id}/dispatch", headers=auth_headers
    )
    assert dispatched.status_code == 200
    payload = dispatched.json()
    assert payload["dispatch_status"] == DISPATCH_SUBMITTED
    assert payload["summary"] == "submitted via IndexBolt"


async def test_api_status_dropdown_accepts_the_mvp_vocabulary(client, auth_headers):
    created = await client.post(
        "/api/indexing/backlinks", json={"url": "https://z.com/p"}, headers=auth_headers
    )
    backlink_id = created.json()["id"]

    for value in ("pending", "pinged", "indexed", "not_indexed"):
        response = await client.patch(
            f"/api/indexing/backlinks/{backlink_id}/status",
            json={"index_status": value},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["index_status"] == value


async def test_api_status_dropdown_rejects_unknown_value(client, auth_headers):
    created = await client.post(
        "/api/indexing/backlinks", json={"url": "https://z.com/q"}, headers=auth_headers
    )
    response = await client.patch(
        f"/api/indexing/backlinks/{created.json()['id']}/status",
        json={"index_status": "totally-made-up"},
        headers=auth_headers,
    )
    assert response.status_code == 422


async def test_api_rejects_invalid_url(client, auth_headers):
    response = await client.post(
        "/api/indexing/backlinks", json={"url": "not-a-url"}, headers=auth_headers
    )
    assert response.status_code == 400


async def test_api_unknown_backlink_returns_404(client, auth_headers):
    response = await client.get("/api/indexing/backlinks/missing", headers=auth_headers)
    assert response.status_code == 404


async def test_api_update_backlink_general_fields(client, auth_headers):
    created = await client.post(
        "/api/indexing/backlinks",
        json={"url": "https://update-test.com/initial", "title": "Initial Title"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    backlink_id = created.json()["id"]

    updated = await client.put(
        f"/api/indexing/backlinks/{backlink_id}",
        json={
            "title": "Updated Title",
            "url": "https://update-test.com/new-path",
            "notes": "Updated notes",
            "anchor_text": "Updated Anchor",
            "source": "manual_edit",
        },
        headers=auth_headers,
    )
    assert updated.status_code == 200
    data = updated.json()
    assert data["title"] == "Updated Title"
    assert data["url"] == "https://update-test.com/new-path"
    assert data["domain"] == "update-test.com"
    assert data["notes"] == "Updated notes"
    assert data["anchor_text"] == "Updated Anchor"
    assert data["source"] == "manual_edit"


async def test_api_delete_backlink_removes_record_and_ping_logs(client, auth_headers):
    created = await client.post(
        "/api/indexing/backlinks",
        json={"url": "https://delete-test.com/to-remove"},
        headers=auth_headers,
    )
    assert created.status_code == 201
    backlink_id = created.json()["id"]

    # Generate a ping log for the backlink
    await client.post(f"/api/indexing/backlinks/{backlink_id}/dispatch", headers=auth_headers)

    logs_before = await client.get(
        f"/api/indexing/backlinks/{backlink_id}/logs", headers=auth_headers
    )
    assert logs_before.status_code == 200
    assert len(logs_before.json()) > 0

    # Delete the backlink
    deleted = await client.delete(
        f"/api/indexing/backlinks/{backlink_id}", headers=auth_headers
    )
    assert deleted.status_code == 204

    # Verify backlink is gone
    get_res = await client.get(
        f"/api/indexing/backlinks/{backlink_id}", headers=auth_headers
    )
    assert get_res.status_code == 404

    # Verify ping logs are deleted
    logs_after = await client.get(
        f"/api/indexing/backlinks/{backlink_id}/logs", headers=auth_headers
    )
    assert logs_after.status_code == 200
    assert len(logs_after.json()) == 0


async def test_api_backlinks_are_isolated_between_tenants(
    client, auth_headers, other_tenant_headers
):
    await client.post(
        "/api/indexing/backlinks", json={"url": "https://private.com/a"}, headers=auth_headers
    )
    other = await client.get("/api/indexing/backlinks", headers=other_tenant_headers)
    assert other.json()["total"] == 0

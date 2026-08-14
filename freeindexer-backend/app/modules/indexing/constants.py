"""Status vocabularies and method names for the indexing dispatch pipeline."""
from __future__ import annotations

from typing import Final, FrozenSet

# --- Dispatch methods -------------------------------------------------------

METHOD_INDEXNOW: Final = "indexnow"
METHOD_WEBSUB: Final = "websub"
METHOD_GOOGLE_INDEXING: Final = "google_indexing"
METHOD_INDEXBOLT: Final = "indexbolt"
METHOD_RAPID_URL_INDEXER: Final = "rapid_url_indexer"

#: Free channels we operate ourselves. They are always attempted, in this
#: order, regardless of ``FI_INDEXER_PROVIDER_ORDER`` (which only governs the
#: optional opt-in chain below). None can promise Google *indexing*:
#: - IndexNow reaches Bing/Yandex/Seznam/Naver only (never Google), and is
#:   owner-only (requires the key file on the target host).
#: - WebSub is a discovery hint that nudges Google/Bing to crawl a feed we host.
#: Google still decides what, if anything, to index.
FREE_METHODS: Final[tuple[str, ...]] = (METHOD_INDEXNOW, METHOD_WEBSUB)

#: Optional opt-in channels. They only run when listed in
#: ``FI_INDEXER_PROVIDER_ORDER`` (empty by default). Includes the paid indexers
#: and the Google Indexing API, which is free but unofficial for pages that are
#: not JobPosting/BroadcastEvent — opt-in so the operator sees that ToS nuance
#: before it fires.
THIRD_PARTY_METHODS: Final[tuple[str, ...]] = (
    METHOD_GOOGLE_INDEXING,
    METHOD_INDEXBOLT,
    METHOD_RAPID_URL_INDEXER,
)
ALL_METHODS: Final[tuple[str, ...]] = (*FREE_METHODS, *THIRD_PARTY_METHODS)

#: When more than one channel accepts a URL, the recorded ``dispatch_method``
#: prefers the channel that reaches the most valuable index: a paid indexer
#: (which explicitly targets Google) outranks the Google Indexing API (free,
#: direct Google notification for owned domains), which outranks WebSub (free
#: Google/Bing feed discovery), which outranks IndexNow (Bing/Yandex only).
DISPATCH_METHOD_PRIORITY: Final[tuple[str, ...]] = (
    METHOD_INDEXBOLT,
    METHOD_RAPID_URL_INDEXER,
    METHOD_GOOGLE_INDEXING,
    METHOD_WEBSUB,
    METHOD_INDEXNOW,
)

# --- Per-attempt outcome (what a single provider call did) ------------------

ATTEMPT_SUCCESS: Final = "success"
ATTEMPT_FAILED: Final = "failed"
#: Provider is not configured (no API key) or is disabled by settings.
ATTEMPT_SKIPPED: Final = "skipped"
#: The method structurally cannot apply, e.g. IndexNow on a domain we do not own.
ATTEMPT_NOT_APPLICABLE: Final = "not_applicable"
#: Provider rejected the call because the account is out of credits.
ATTEMPT_OUT_OF_CREDITS: Final = "out_of_credits"

# --- Backlink dispatch status (what our pipeline achieved for this URL) -----

DISPATCH_PENDING: Final = "pending"
DISPATCH_SUBMITTED: Final = "submitted"
DISPATCH_FAILED: Final = "failed"
#: Nothing was attempted because no provider was configured.
DISPATCH_SKIPPED: Final = "skipped"

DISPATCH_STATUSES: Final[FrozenSet[str]] = frozenset(
    {DISPATCH_PENDING, DISPATCH_SUBMITTED, DISPATCH_FAILED, DISPATCH_SKIPPED}
)

# --- Backlink index status (where the search engine stands) -----------------
#
# Set manually from the dashboard, or by a verifier job. The pipeline only
# moves a URL to "pinged"; it never claims a URL is indexed, because only the
# search engine decides that.

INDEX_PENDING: Final = "pending"
INDEX_PINGED: Final = "pinged"
INDEX_INDEXED: Final = "indexed"
INDEX_NOT_INDEXED: Final = "not_indexed"

INDEX_STATUSES: Final[FrozenSet[str]] = frozenset(
    {INDEX_PENDING, INDEX_PINGED, INDEX_INDEXED, INDEX_NOT_INDEXED}
)

#: ``index_status`` values hidden from the public "featured on" endpoint. A URL
#: the search engine explicitly declined to index is treated as broken or
#: low-value, so it is excluded from the crawlable public list; ``pending`` and
#: ``pinged`` rows are still shown because they are simply awaiting a verdict.
PUBLIC_HIDDEN_INDEX_STATUSES: Final[FrozenSet[str]] = frozenset({INDEX_NOT_INDEXED})

#: Human-readable label per method, for dashboard badges.
METHOD_LABELS: Final[dict[str, str]] = {
    METHOD_INDEXNOW: "IndexNow",
    METHOD_WEBSUB: "WebSub",
    METHOD_GOOGLE_INDEXING: "Google Indexing API",
    METHOD_INDEXBOLT: "IndexBolt",
    METHOD_RAPID_URL_INDEXER: "Rapid URL Indexer",
}

#: Honest, scope-aware dashboard text for a successful dispatch. We only ever
#: claim what we actually control — that a *signal* was sent — never that a
#: search engine indexed the page. "signal sent" for the free channels we run;
#: "submitted" for the optional paid indexers (which queue the URL on their side).
DISPATCH_METHOD_SUMMARY: Final[dict[str, str]] = {
    METHOD_INDEXNOW: "signal sent via IndexNow (Bing/Yandex — not Google)",
    METHOD_WEBSUB: "signal sent via WebSub (Google/Bing feed discovery)",
    METHOD_GOOGLE_INDEXING: (
        "signal sent via Google Indexing API (owned domains only; official for "
        "JobPosting/BroadcastEvent — misuse can revoke API access, not a domain penalty)"
    ),
    METHOD_INDEXBOLT: "submitted via IndexBolt",
    METHOD_RAPID_URL_INDEXER: "submitted via Rapid URL Indexer",
}


def describe_dispatch(dispatch_status: str, method: str | None) -> str:
    """Render the honest dashboard string, e.g. ``"signal sent via WebSub …"``.

    Never implies indexing: a dispatch we call ``submitted`` only means a
    provider accepted the signal. Whether Google (or any engine) indexes the
    page is the engine's decision alone.
    """
    if dispatch_status == DISPATCH_SUBMITTED and method:
        return DISPATCH_METHOD_SUMMARY.get(
            method, f"submitted via {METHOD_LABELS.get(method, method)}"
        )
    if dispatch_status == DISPATCH_FAILED:
        return "failed"
    if dispatch_status == DISPATCH_SKIPPED:
        return "skipped (no provider configured)"
    return "pending"

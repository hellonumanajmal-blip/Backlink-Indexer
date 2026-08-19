"""Pipeline state machine for the free indexing engine.

A successful HTTP fetch, a completed worker task, or a discovery POST is never
enough to mark a URL INDEXED. Visibility (whether Google has the URL) is a
separate vocabulary from the pipeline stage.
"""
from __future__ import annotations

from enum import Enum
from typing import FrozenSet, Mapping


class PipelineStatus(str, Enum):
    RECEIVED = "RECEIVED"
    VALIDATING = "VALIDATING"
    VALIDATED = "VALIDATED"
    BACKLINK_CHECK = "BACKLINK_CHECK"
    BACKLINK_VERIFIED = "BACKLINK_VERIFIED"
    CRAWLABILITY_CHECK = "CRAWLABILITY_CHECK"
    DISCOVERY_QUEUED = "DISCOVERY_QUEUED"
    DISCOVERY_SUBMITTED = "DISCOVERY_SUBMITTED"
    WAITING_FOR_CRAWL = "WAITING_FOR_CRAWL"
    VERIFICATION_PENDING = "VERIFICATION_PENDING"
    INDEXED = "INDEXED"

    INVALID_URL = "INVALID_URL"
    URL_UNREACHABLE = "URL_UNREACHABLE"
    BACKLINK_NOT_FOUND = "BACKLINK_NOT_FOUND"
    BACKLINK_REMOVED = "BACKLINK_REMOVED"
    ROBOTS_BLOCKED = "ROBOTS_BLOCKED"
    NOINDEX = "NOINDEX"
    DISCOVERY_FAILED = "DISCOVERY_FAILED"
    VERIFICATION_FAILED = "VERIFICATION_FAILED"
    TIMEOUT = "TIMEOUT"
    RETRY_PENDING = "RETRY_PENDING"
    NOT_INDEXED = "NOT_INDEXED"


class VisibilityStatus(str, Enum):
    """Search-engine visibility. Independent of HTTP 200 / our crawler visit."""

    UNKNOWN = "UNKNOWN"
    DISCOVERED = "DISCOVERED"
    CRAWLED = "CRAWLED"
    INDEXED = "INDEXED"
    NOT_INDEXED = "NOT_INDEXED"


class PropertyType(str, Enum):
    OWNED_PROPERTY = "OWNED_PROPERTY"
    THIRD_PARTY_BACKLINK = "THIRD_PARTY_BACKLINK"


class CrawlVisitor(str, Enum):
    NONE = "NONE"
    OUR_CRAWLER_VISITED = "OUR_CRAWLER_VISITED"
    GOOGLEBOT_VISITED = "GOOGLEBOT_VISITED"


class ChannelResultStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    RATE_LIMITED = "RATE_LIMITED"
    UNAVAILABLE = "UNAVAILABLE"
    SKIPPED = "SKIPPED"
    INDEXNOW_NOT_AVAILABLE = "INDEXNOW_NOT_AVAILABLE"
    SITEMAP_NOT_AVAILABLE = "SITEMAP_NOT_AVAILABLE"
    WEBSUB_ACCEPTED = "WEBSUB_ACCEPTED"
    WEBSUB_FAILED = "WEBSUB_FAILED"
    WEBSUB_UNAVAILABLE = "WEBSUB_UNAVAILABLE"
    DISCOVERY_ACCEPTED = "DISCOVERY_ACCEPTED"
    DISCOVERY_PUBLISHED = "DISCOVERY_PUBLISHED"
    DISCOVERY_VERIFIED = "DISCOVERY_VERIFIED"


class DiscoveryStage(str, Enum):
    """Publication quality of a discovery signal — not an index probability."""

    NONE = "NONE"
    DISCOVERY_ACCEPTED = "DISCOVERY_ACCEPTED"
    DISCOVERY_PUBLISHED = "DISCOVERY_PUBLISHED"
    DISCOVERY_VERIFIED = "DISCOVERY_VERIFIED"


class DiscoveryLayer(str, Enum):
    """These layers must never be collapsed into a single INDEXED flag."""

    OUR_HUB_CRAWLED = "OUR_HUB_CRAWLED"
    TARGET_URL_DISCOVERED = "TARGET_URL_DISCOVERED"
    TARGET_URL_CRAWLED = "TARGET_URL_CRAWLED"
    TARGET_URL_INDEXED = "TARGET_URL_INDEXED"


class CrawlEvidenceType(str, Enum):
    OUR_CRAWLER = "OUR_CRAWLER"
    SEARCH_CONSOLE = "SEARCH_CONSOLE"
    SEARCH_RESULT = "SEARCH_RESULT"
    MANUAL = "MANUAL"
    #: Googlebot (PTR + forward DNS verified) fetched one of our public pages.
    CRAWLER_EVIDENCE = "CRAWLER_EVIDENCE"


#: Signal quality of a discovery channel (0–1). Not "probability Google indexed".
CHANNEL_SIGNAL_QUALITY: Mapping[str, float] = {
    "public_hub": 0.35,
    "websub": 0.45,
    "indexnow": 0.80,
    "sitemap": 0.50,
    "gsc_feed_sitemap": 0.40,
}

CHANNEL_ACCEPTED_STATUSES: FrozenSet[ChannelResultStatus] = frozenset(
    {
        ChannelResultStatus.SUCCESS,
        ChannelResultStatus.WEBSUB_ACCEPTED,
        ChannelResultStatus.DISCOVERY_ACCEPTED,
        ChannelResultStatus.DISCOVERY_PUBLISHED,
        ChannelResultStatus.DISCOVERY_VERIFIED,
    }
)


class PriorityBand(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


SUCCESS_STATES: FrozenSet[PipelineStatus] = frozenset(
    {
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
    }
)

FAILURE_STATES: FrozenSet[PipelineStatus] = frozenset(
    {
        PipelineStatus.INVALID_URL,
        PipelineStatus.URL_UNREACHABLE,
        PipelineStatus.BACKLINK_NOT_FOUND,
        PipelineStatus.BACKLINK_REMOVED,
        PipelineStatus.ROBOTS_BLOCKED,
        PipelineStatus.NOINDEX,
        PipelineStatus.DISCOVERY_FAILED,
        PipelineStatus.VERIFICATION_FAILED,
        PipelineStatus.TIMEOUT,
        PipelineStatus.RETRY_PENDING,
        PipelineStatus.NOT_INDEXED,
    }
)

TERMINAL_NO_RETRY: FrozenSet[PipelineStatus] = frozenset(
    {
        PipelineStatus.INVALID_URL,
        PipelineStatus.URL_UNREACHABLE,
        PipelineStatus.BACKLINK_NOT_FOUND,
        PipelineStatus.ROBOTS_BLOCKED,
        PipelineStatus.NOINDEX,
        PipelineStatus.INDEXED,
    }
)

# Explicit allow-list. Anything not listed is rejected.
ALLOWED_TRANSITIONS: Mapping[PipelineStatus, FrozenSet[PipelineStatus]] = {
    PipelineStatus.RECEIVED: frozenset({PipelineStatus.VALIDATING}),
    PipelineStatus.VALIDATING: frozenset(
        {
            PipelineStatus.VALIDATED,
            PipelineStatus.INVALID_URL,
            PipelineStatus.URL_UNREACHABLE,
            PipelineStatus.TIMEOUT,
        }
    ),
    PipelineStatus.VALIDATED: frozenset(
        {
            PipelineStatus.BACKLINK_CHECK,
            PipelineStatus.CRAWLABILITY_CHECK,
        }
    ),
    PipelineStatus.BACKLINK_CHECK: frozenset(
        {
            PipelineStatus.BACKLINK_VERIFIED,
            PipelineStatus.BACKLINK_NOT_FOUND,
            PipelineStatus.TIMEOUT,
        }
    ),
    PipelineStatus.BACKLINK_VERIFIED: frozenset({PipelineStatus.CRAWLABILITY_CHECK}),
    PipelineStatus.CRAWLABILITY_CHECK: frozenset(
        {
            PipelineStatus.DISCOVERY_QUEUED,
            PipelineStatus.ROBOTS_BLOCKED,
            PipelineStatus.NOINDEX,
            PipelineStatus.URL_UNREACHABLE,
            PipelineStatus.BACKLINK_REMOVED,
        }
    ),
    PipelineStatus.DISCOVERY_QUEUED: frozenset(
        {
            PipelineStatus.DISCOVERY_SUBMITTED,
            PipelineStatus.DISCOVERY_FAILED,
            PipelineStatus.RETRY_PENDING,
            PipelineStatus.WAITING_FOR_CRAWL,
            PipelineStatus.INDEXED,
            PipelineStatus.BACKLINK_REMOVED,
        }
    ),
    PipelineStatus.DISCOVERY_SUBMITTED: frozenset(
        {
            PipelineStatus.WAITING_FOR_CRAWL,
        }
    ),
    PipelineStatus.WAITING_FOR_CRAWL: frozenset(
        {
            PipelineStatus.VERIFICATION_PENDING,
            PipelineStatus.RETRY_PENDING,
            PipelineStatus.TIMEOUT,
            PipelineStatus.BACKLINK_REMOVED,
        }
    ),
    PipelineStatus.VERIFICATION_PENDING: frozenset(
        {
            PipelineStatus.INDEXED,
            PipelineStatus.NOT_INDEXED,
            PipelineStatus.VERIFICATION_FAILED,
            PipelineStatus.RETRY_PENDING,
        }
    ),
    PipelineStatus.RETRY_PENDING: frozenset(
        {
            PipelineStatus.DISCOVERY_QUEUED,
            PipelineStatus.VERIFICATION_PENDING,
            PipelineStatus.NOT_INDEXED,
            PipelineStatus.INDEXED,
            PipelineStatus.TIMEOUT,
            PipelineStatus.BACKLINK_REMOVED,
            PipelineStatus.NOINDEX,
            PipelineStatus.ROBOTS_BLOCKED,
            PipelineStatus.URL_UNREACHABLE,
            PipelineStatus.BACKLINK_CHECK,
        }
    ),
    PipelineStatus.BACKLINK_REMOVED: frozenset(
        {
            PipelineStatus.BACKLINK_CHECK,
            PipelineStatus.DISCOVERY_QUEUED,
            PipelineStatus.RETRY_PENDING,
            PipelineStatus.TIMEOUT,
            PipelineStatus.URL_UNREACHABLE,
            PipelineStatus.NOINDEX,
            PipelineStatus.ROBOTS_BLOCKED,
        }
    ),
    PipelineStatus.DISCOVERY_FAILED: frozenset(
        {PipelineStatus.RETRY_PENDING, PipelineStatus.NOT_INDEXED}
    ),
    PipelineStatus.VERIFICATION_FAILED: frozenset(
        {PipelineStatus.RETRY_PENDING, PipelineStatus.NOT_INDEXED}
    ),
    PipelineStatus.NOT_INDEXED: frozenset(
        {
            PipelineStatus.RETRY_PENDING,
            PipelineStatus.VERIFICATION_PENDING,
            PipelineStatus.INDEXED,
        }
    ),
    PipelineStatus.TIMEOUT: frozenset({PipelineStatus.RETRY_PENDING}),
    # Terminal (no outbound edges): INDEXED, INVALID_URL, URL_UNREACHABLE,
    # BACKLINK_NOT_FOUND, ROBOTS_BLOCKED, NOINDEX
    # BACKLINK_REMOVED is pause-and-resume, not a terminal no-retry failure.
    PipelineStatus.INDEXED: frozenset(),
    PipelineStatus.INVALID_URL: frozenset(),
    PipelineStatus.URL_UNREACHABLE: frozenset(),
    PipelineStatus.BACKLINK_NOT_FOUND: frozenset(),
    PipelineStatus.ROBOTS_BLOCKED: frozenset(),
    PipelineStatus.NOINDEX: frozenset(),
}


class InvalidTransition(ValueError):
    """Raised when a pipeline status change is not in the allow-list."""


def can_transition(current: PipelineStatus, nxt: PipelineStatus) -> bool:
    if current == nxt:
        return True
    return nxt in ALLOWED_TRANSITIONS.get(current, frozenset())


def assert_transition(current: PipelineStatus, nxt: PipelineStatus) -> None:
    if not can_transition(current, nxt):
        raise InvalidTransition(f"Cannot transition from {current.value} to {nxt.value}")


def crawlability_band(score: int) -> str:
    if score <= 20:
        return "Very Poor"
    if score <= 40:
        return "Poor"
    if score <= 60:
        return "Moderate"
    if score <= 80:
        return "Good"
    return "Strong"


class WorkflowStage(str, Enum):
    """Operator-facing lifecycle. DISCOVERY != INDEXING. CRAWL != INDEXING."""

    SUBMITTED = "SUBMITTED"
    VALIDATED = "VALIDATED"
    BACKLINK_FOUND = "BACKLINK_FOUND"
    DISCOVERY_PUBLISHED = "DISCOVERY_PUBLISHED"
    CRAWL_SIGNAL_SENT = "CRAWL_SIGNAL_SENT"
    WAITING = "WAITING"
    CRAWLED_EVIDENCE = "CRAWLED_EVIDENCE"
    INDEXED = "INDEXED"
    NOT_INDEXED = "NOT_INDEXED"
    FAILED = "FAILED"


def workflow_stage_for(job) -> str:
    vis = getattr(job, "visibility_status", "")
    pipe = getattr(job, "pipeline_status", "")
    if vis == VisibilityStatus.INDEXED.value or pipe == PipelineStatus.INDEXED.value:
        return WorkflowStage.INDEXED.value
    if vis == VisibilityStatus.CRAWLED.value or getattr(job, "googlebot_visited", False):
        return WorkflowStage.CRAWLED_EVIDENCE.value
    if vis == VisibilityStatus.NOT_INDEXED.value or pipe == PipelineStatus.NOT_INDEXED.value:
        return WorkflowStage.NOT_INDEXED.value
    if pipe in {
        PipelineStatus.INVALID_URL.value,
        PipelineStatus.URL_UNREACHABLE.value,
        PipelineStatus.BACKLINK_NOT_FOUND.value,
        PipelineStatus.BACKLINK_REMOVED.value,
        PipelineStatus.ROBOTS_BLOCKED.value,
        PipelineStatus.NOINDEX.value,
        PipelineStatus.DISCOVERY_FAILED.value,
        PipelineStatus.VERIFICATION_FAILED.value,
        PipelineStatus.TIMEOUT.value,
    }:
        return WorkflowStage.FAILED.value
    if pipe in {
        PipelineStatus.WAITING_FOR_CRAWL.value,
        PipelineStatus.VERIFICATION_PENDING.value,
        PipelineStatus.RETRY_PENDING.value,
    }:
        if getattr(job, "discovery_stage", None) and getattr(job, "discovery_stage") != "NONE":
            return WorkflowStage.WAITING.value
        return WorkflowStage.CRAWL_SIGNAL_SENT.value
    if pipe in {PipelineStatus.DISCOVERY_SUBMITTED.value, PipelineStatus.DISCOVERY_QUEUED.value}:
        return WorkflowStage.DISCOVERY_PUBLISHED.value if pipe == PipelineStatus.DISCOVERY_SUBMITTED.value else WorkflowStage.CRAWL_SIGNAL_SENT.value
    if pipe in {PipelineStatus.BACKLINK_VERIFIED.value, PipelineStatus.BACKLINK_CHECK.value}:
        return WorkflowStage.BACKLINK_FOUND.value
    if pipe in {PipelineStatus.VALIDATED.value, PipelineStatus.VALIDATING.value, PipelineStatus.CRAWLABILITY_CHECK.value}:
        return WorkflowStage.VALIDATED.value
    return WorkflowStage.SUBMITTED.value


def final_status_for(job) -> str:
    """Highest honest layer reached. These labels must never be collapsed."""
    vis = getattr(job, "visibility_status", "") or ""
    pipe = getattr(job, "pipeline_status", "") or ""
    stage = getattr(job, "discovery_stage", "") or ""
    if vis == VisibilityStatus.INDEXED.value or pipe == PipelineStatus.INDEXED.value:
        return "INDEXED"
    if vis == VisibilityStatus.CRAWLED.value:
        return "TARGET_CRAWLED"
    if vis == VisibilityStatus.DISCOVERED.value:
        return "TARGET_DISCOVERED"
    if pipe == PipelineStatus.DISCOVERY_SUBMITTED.value:
        return "DISCOVERY_SUBMITTED"
    if stage in {
        DiscoveryStage.DISCOVERY_ACCEPTED.value,
        DiscoveryStage.DISCOVERY_PUBLISHED.value,
        DiscoveryStage.DISCOVERY_VERIFIED.value,
    }:
        return "DISCOVERY_ACCEPTED"
    if vis == VisibilityStatus.UNKNOWN.value:
        return "UNKNOWN"
    return vis or pipe or "UNKNOWN"

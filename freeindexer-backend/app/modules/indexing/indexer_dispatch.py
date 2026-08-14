"""Backlink indexing dispatch.

Routes a URL through the free, legitimate discovery channels we operate and
records every attempt — including the provider's HTTP response code — in
``ping_logs``.

Channels for a single URL:

1. **Free channels, always attempted** (``FREE_METHODS``):
   - **IndexNow**, but only when the host is one we control (the protocol
     requires serving ``{key}.txt`` on the target domain, so it is impossible
     for third-party backlinks). Free and near-instant for Bing, Yandex, Seznam
     and Naver; it does **nothing for Google**, which does not participate.
   - **WebSub** publish, when a feed URL is configured. This is the only free
     channel that can reach Google for URLs we do not own: the URLs live in a
     feed on a domain we control, and the hub ping asks Google's Feedfetcher to
     re-crawl that feed. A discovery hint, not an indexing guarantee.
2. **Optional opt-in channels** in the order given by ``FI_INDEXER_PROVIDER_ORDER``
   (empty by default, so the pipeline is free-only). The chain stops at the
   first provider that accepts the URL, and falls through when a provider is
   unconfigured, out of credits, or erroring. This is where the paid indexers
   live, and also the **Google Indexing API** — free and owner-only, but
   unofficial for pages that are not JobPosting/BroadcastEvent, so it is
   opt-in rather than always-attempted.

No channel can guarantee indexing. A successful dispatch means a provider
accepted the *signal*, not that a search engine indexed the page — Google alone
decides that.
"""
from __future__ import annotations

import csv
import hashlib
import io
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence
from urllib.parse import urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.modules.indexing.constants import (
    ATTEMPT_NOT_APPLICABLE,
    ATTEMPT_SKIPPED,
    DISPATCH_FAILED,
    DISPATCH_METHOD_PRIORITY,
    DISPATCH_PENDING,
    DISPATCH_SKIPPED,
    DISPATCH_SUBMITTED,
    FREE_METHODS,
    INDEX_PENDING,
    INDEX_PINGED,
    PUBLIC_HIDDEN_INDEX_STATUSES,
    describe_dispatch,
)
from app.modules.indexing.models import Backlink, PingLog
from app.modules.indexing.providers import (
    IndexerProvider,
    ProviderResult,
    build_providers,
    host_of,
)
from app.modules.indexing.repository import BacklinkRepository, PingLogRepository

MAX_URL_LENGTH = 2048


@dataclass(slots=True)
class DispatchOutcome:
    """Result of dispatching one backlink through the channel chain."""

    backlink_id: str
    url: str
    dispatch_status: str
    dispatch_method: Optional[str]
    attempts: List[ProviderResult] = field(default_factory=list)

    @property
    def summary(self) -> str:
        return describe_dispatch(self.dispatch_status, self.dispatch_method)


@dataclass(slots=True)
class ImportOutcome:
    created: List[Backlink] = field(default_factory=list)
    skipped_duplicates: int = 0
    invalid: List[str] = field(default_factory=list)


@dataclass(slots=True)
class BacklinkRow:
    """A single import candidate: a URL plus optional metadata.

    ``label`` identifies the source location (e.g. ``"Row 3"``) so CSV imports
    can report *which* row failed; it is ``None`` for textarea bulk imports,
    whose invalid entries are just the raw URL string (preserving that API).
    """

    url: str
    title: Optional[str] = None
    platform: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    anchor_text: Optional[str] = None
    rel_type: Optional[str] = None
    notes: Optional[str] = None
    label: Optional[str] = None


def _invalid_label(row: BacklinkRow) -> str:
    """Human-readable invalid-row message, with the CSV location when known."""
    raw = (row.url or "").strip()
    if row.label:
        return f"{row.label}: missing url" if not raw else f"{row.label}: invalid URL '{raw}'"
    return raw


def normalise_url(raw: str) -> Optional[str]:
    """Return a canonical URL, or ``None`` when it is not submittable.

    Only the scheme and host are lowercased; path and query are preserved
    exactly, since those are case-sensitive on many servers.
    """
    candidate = (raw or "").strip()
    if not candidate or len(candidate) > MAX_URL_LENGTH:
        return None
    try:
        parsed = urlparse(candidate)
    except ValueError:
        return None
    if parsed.scheme.lower() not in ("http", "https") or not parsed.hostname:
        return None

    netloc = parsed.hostname.lower()
    if parsed.port:
        netloc = f"{netloc}:{parsed.port}"
    if parsed.username:
        credentials = parsed.username
        if parsed.password:
            credentials = f"{credentials}:{parsed.password}"
        netloc = f"{credentials}@{netloc}"

    return urlunparse(
        (parsed.scheme.lower(), netloc, parsed.path, parsed.params, parsed.query, "")
    )


def url_fingerprint(url: str) -> str:
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


def split_urls(payload: str | Sequence[str]) -> List[str]:
    """Accept either a newline-separated blob or an explicit list."""
    if isinstance(payload, str):
        return [line for line in payload.splitlines() if line.strip()]
    return [str(item) for item in payload]


#: Optional columns honoured in a CSV upload, beyond the required ``url``. A
#: ``domain`` column is accepted (so the header does not error) but ignored in
#: favour of the host derived from the URL, keeping ``domain`` consistent.
CSV_OPTIONAL_COLUMNS: tuple[str, ...] = (
    "title",
    "platform",
    "country",
    "language",
    "anchor_text",
    "rel_type",
    "notes",
)


def parse_backlink_csv(raw: bytes) -> tuple[List[BacklinkRow], List[str]]:
    """Parse an uploaded CSV into import rows.

    Requires a ``url`` column (case-insensitive); optional schema columns are
    mapped when present and unknown columns are ignored. Returns
    ``(rows, parse_errors)`` where ``parse_errors`` notes any line the CSV
    reader could not parse. Raises :class:`ValueError` only when the file cannot
    be parsed at all (empty, no header row, or no ``url`` column) so the caller
    can answer ``400`` instead of silently importing nothing.
    """
    if not raw or not raw.strip():
        raise ValueError("CSV file is empty")
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")

    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise ValueError("CSV file has no header row")
    header = {(name or "").strip().lower(): name for name in reader.fieldnames}
    if "url" not in header:
        raise ValueError("CSV must include a 'url' column")

    def cell(row: Dict[str, Any], key: str) -> Optional[str]:
        source = header.get(key)
        if source is None:
            return None
        value = (row.get(source) or "").strip()
        return value or None

    rows: List[BacklinkRow] = []
    parse_errors: List[str] = []
    line = 1  # header is line 1; data rows start at line 2
    while True:
        line += 1
        try:
            raw_row = next(reader)
        except StopIteration:
            break
        except csv.Error as exc:
            # A line the reader cannot parse (e.g. an embedded NUL). Record it
            # and stop, rather than looping on a wedged reader or raising a 500.
            parse_errors.append(f"Row {line}: malformed CSV ({exc})")
            break
        rows.append(
            BacklinkRow(
                url=(raw_row.get(header["url"]) or "").strip(),
                title=cell(raw_row, "title"),
                platform=cell(raw_row, "platform"),
                country=cell(raw_row, "country"),
                language=cell(raw_row, "language"),
                anchor_text=cell(raw_row, "anchor_text"),
                rel_type=cell(raw_row, "rel_type"),
                notes=cell(raw_row, "notes"),
                label=f"Row {line}",
            )
        )
    return rows, parse_errors


class IndexerDispatchService:
    """Creates backlinks, dispatches them, and records the audit trail."""

    def __init__(
        self,
        session: AsyncSession,
        providers: Optional[Dict[str, IndexerProvider]] = None,
    ) -> None:
        self.session = session
        self.backlinks = BacklinkRepository(session)
        self.ping_logs = PingLogRepository(session)
        self.providers = providers if providers is not None else build_providers()

    # ------------------------------------------------------------------
    # Backlink management
    # ------------------------------------------------------------------
    async def create_backlink(
        self,
        tenant_id: str,
        *,
        url: str,
        title: Optional[str] = None,
        anchor_text: Optional[str] = None,
        notes: Optional[str] = None,
        source: str = "manual",
        platform: Optional[str] = None,
        country: Optional[str] = None,
        language: Optional[str] = None,
        rel_type: Optional[str] = None,
        authority_score: Optional[int] = None,
    ) -> Optional[Backlink]:
        """Create a backlink, or return the existing row for a duplicate URL."""
        normalised = normalise_url(url)
        if normalised is None:
            return None

        fingerprint = url_fingerprint(normalised)
        if existing := await self.backlinks.get_by_hash(tenant_id, fingerprint):
            return existing

        backlink = Backlink(
            tenant_id=tenant_id,
            url=normalised,
            url_hash=fingerprint,
            domain=host_of(normalised),
            title=title,
            anchor_text=anchor_text,
            notes=notes,
            source=source,
            platform=platform,
            country=country,
            language=language,
            rel_type=rel_type,
            authority_score=authority_score,
            index_status=INDEX_PENDING,
            dispatch_status=DISPATCH_PENDING,
        )
        return await self.backlinks.add(backlink)

    async def bulk_import(
        self,
        tenant_id: str,
        payload: str | Sequence[str],
        *,
        source: str = "bulk",
    ) -> ImportOutcome:
        """Import a newline blob / list of URLs (no per-row metadata)."""
        rows = [BacklinkRow(url=raw) for raw in split_urls(payload)]
        return await self._import_rows(tenant_id, rows, source=source)

    async def import_csv(
        self,
        tenant_id: str,
        raw: bytes,
        *,
        source: str = "csv",
        dispatch: bool = True,
    ) -> ImportOutcome:
        """Import a CSV upload, reusing the shared row-insertion path.

        Parses the file (raising :class:`ValueError` for a file we cannot parse
        at all), inserts the valid rows exactly like :meth:`bulk_import`, folds
        any per-line parse errors into ``invalid``, and — like the textarea
        path — dispatches the newly created rows through the free-signal
        pipeline when ``dispatch`` is set.
        """
        rows, parse_errors = parse_backlink_csv(raw)
        outcome = await self._import_rows(tenant_id, rows, source=source)
        outcome.invalid.extend(parse_errors)
        if dispatch and outcome.created:
            await self.dispatch_many(tenant_id, outcome.created)
        return outcome

    async def _import_rows(
        self,
        tenant_id: str,
        rows: Sequence[BacklinkRow],
        *,
        source: str,
    ) -> ImportOutcome:
        """Shared insertion path for every import format (textarea and CSV).

        Normalises URLs (bad ones are reported in ``invalid``), de-duplicates
        within the batch and against existing rows, then inserts the survivors
        with whatever optional metadata each row carried. ``domain`` is always
        derived from the URL so it cannot drift from the stored address.
        """
        outcome = ImportOutcome()
        drafts: List[tuple[str, BacklinkRow]] = []
        seen: set[str] = set()
        for row in rows:
            candidate = normalise_url(row.url)
            if candidate is None:
                outcome.invalid.append(_invalid_label(row))
                continue
            fingerprint = url_fingerprint(candidate)
            if fingerprint in seen:
                outcome.skipped_duplicates += 1
                continue
            seen.add(fingerprint)
            drafts.append((candidate, row))

        already_present = await self.backlinks.existing_hashes(tenant_id, list(seen))
        for candidate, row in drafts:
            fingerprint = url_fingerprint(candidate)
            if fingerprint in already_present:
                outcome.skipped_duplicates += 1
                continue
            backlink = Backlink(
                tenant_id=tenant_id,
                url=candidate,
                url_hash=fingerprint,
                domain=host_of(candidate),
                title=row.title,
                anchor_text=row.anchor_text,
                notes=row.notes,
                source=source,
                platform=row.platform,
                country=row.country,
                language=row.language,
                rel_type=row.rel_type,
                index_status=INDEX_PENDING,
                dispatch_status=DISPATCH_PENDING,
            )
            outcome.created.append(await self.backlinks.add(backlink))

        return outcome

    async def get_backlink(self, tenant_id: str, backlink_id: str) -> Optional[Backlink]:
        return await self.backlinks.get_for_tenant(backlink_id, tenant_id)

    async def list_backlinks(
        self,
        tenant_id: str,
        *,
        query: Optional[str] = None,
        index_status: Optional[str] = None,
        dispatch_status: Optional[str] = None,
        domain: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[List[Backlink], int]:
        return await self.backlinks.search(
            tenant_id,
            query=query,
            index_status=index_status,
            dispatch_status=dispatch_status,
            domain=domain,
            limit=limit,
            offset=offset,
        )

    async def list_public_featured(
        self,
        *,
        limit: int = 200,
        offset: int = 0,
    ) -> tuple[List[Backlink], int]:
        """Backlinks for the public "featured on" page.

        Applies the configured public tenant scope (``FI_PUBLIC_FEATURED_TENANT_ID``,
        empty means all tenants) and hides ``not_indexed`` rows so broken or
        rejected links never appear on a crawlable public page.
        """
        return await self.backlinks.list_public_featured(
            tenant_id=settings.public_featured_tenant_id or None,
            exclude_index_statuses=tuple(PUBLIC_HIDDEN_INDEX_STATUSES),
            limit=limit,
            offset=offset,
        )

    async def set_index_status(
        self, tenant_id: str, backlink_id: str, index_status: str
    ) -> Optional[Backlink]:
        """Apply a manual status change from the dashboard dropdown."""
        backlink = await self.backlinks.get_for_tenant(backlink_id, tenant_id)
        if backlink is None:
            return None
        backlink.index_status = index_status
        await self.session.flush()
        return backlink

    # ------------------------------------------------------------------
    # Dispatch
    # ------------------------------------------------------------------
    async def dispatch_backlink(self, tenant_id: str, backlink: Backlink) -> DispatchOutcome:
        attempts: List[ProviderResult] = []
        backlink.dispatch_attempts += 1
        attempt_no = backlink.dispatch_attempts

        # Free channels we operate ourselves are always attempted.
        for method in FREE_METHODS:
            provider = self.providers.get(method)
            if provider is None:
                continue
            result = await provider.submit([backlink.url])
            attempts.append(result)
            await self._record(tenant_id, backlink, result, attempt_no)

        # Optional opt-in chain (empty by default): stop at the first provider
        # that accepts the URL, and never re-run a free channel already tried.
        for method in settings.indexer_provider_order:
            if method in FREE_METHODS:
                continue
            provider = self.providers.get(method)
            if provider is None:
                continue
            result = await provider.submit([backlink.url])
            attempts.append(result)
            await self._record(tenant_id, backlink, result, attempt_no)
            if result.ok:
                break

        self._apply_outcome(backlink, attempts)
        await self.session.flush()

        return DispatchOutcome(
            backlink_id=backlink.id,
            url=backlink.url,
            dispatch_status=backlink.dispatch_status,
            dispatch_method=backlink.dispatch_method,
            attempts=attempts,
        )

    async def dispatch_many(
        self, tenant_id: str, backlinks: Iterable[Backlink]
    ) -> List[DispatchOutcome]:
        return [await self.dispatch_backlink(tenant_id, b) for b in backlinks]

    async def dispatch_pending(
        self, tenant_id: str, limit: Optional[int] = None
    ) -> List[DispatchOutcome]:
        batch = await self.backlinks.list_pending_dispatch(
            tenant_id, limit=limit or settings.indexer_batch_size
        )
        return await self.dispatch_many(tenant_id, batch)

    @staticmethod
    def _select_winner(attempts: Sequence[ProviderResult]) -> Optional[ProviderResult]:
        """Pick which successful attempt names the dispatch, by channel value.

        A paid indexer (targets Google) outranks the Google Indexing API (free,
        direct Google notification for owned domains), which outranks WebSub
        (free Google/Bing feed discovery), which outranks IndexNow (Bing/Yandex
        only). See ``DISPATCH_METHOD_PRIORITY``.
        """
        succeeded = {a.method: a for a in attempts if a.ok}
        if not succeeded:
            return None
        for method in DISPATCH_METHOD_PRIORITY:
            if method in succeeded:
                return succeeded[method]
        return next(iter(succeeded.values()))

    @staticmethod
    def _apply_outcome(
        backlink: Backlink,
        attempts: Sequence[ProviderResult],
    ) -> None:
        """Fold the attempt list into the backlink's dispatch columns."""
        backlink.last_dispatched_at = datetime.now(timezone.utc)

        winner = IndexerDispatchService._select_winner(attempts)
        if winner is not None:
            backlink.dispatch_status = DISPATCH_SUBMITTED
            backlink.dispatch_method = winner.method
            backlink.external_ref = winner.external_ref
            backlink.last_error = None
            if backlink.index_status == INDEX_PENDING:
                backlink.index_status = INDEX_PINGED
            return

        inert = {ATTEMPT_SKIPPED, ATTEMPT_NOT_APPLICABLE}
        real_failures = [a for a in attempts if a.status not in inert]
        if not real_failures:
            backlink.dispatch_status = DISPATCH_SKIPPED
            backlink.dispatch_method = None
            backlink.last_error = "No indexing provider is configured"
            return

        backlink.dispatch_status = DISPATCH_FAILED
        backlink.dispatch_method = None
        backlink.last_error = "; ".join(
            f"{a.method}: {a.error}" for a in real_failures if a.error
        ) or "Dispatch failed"

    async def _record(
        self,
        tenant_id: str,
        backlink: Backlink,
        result: ProviderResult,
        attempt_no: int,
    ) -> PingLog:
        log = PingLog(
            tenant_id=tenant_id,
            backlink_id=backlink.id,
            url=backlink.url,
            method=result.method,
            endpoint=result.endpoint,
            status=result.status,
            response_code=result.response_code,
            response_body=result.response_body,
            error=result.error,
            attempt=attempt_no,
            duration_ms=result.duration_ms,
            external_ref=result.external_ref,
            request_payload=result.request_payload,
        )
        return await self.ping_logs.add(log)

    # ------------------------------------------------------------------
    # Logs and provider introspection
    # ------------------------------------------------------------------
    async def logs_for_backlink(
        self, tenant_id: str, backlink_id: str, limit: int = 100
    ) -> List[PingLog]:
        return await self.ping_logs.list_for_backlink(tenant_id, backlink_id, limit=limit)

    async def recent_logs(
        self,
        tenant_id: str,
        *,
        method: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[PingLog]:
        return await self.ping_logs.list_recent(
            tenant_id, method=method, status=status, limit=limit, offset=offset
        )

    def provider_statuses(self) -> List[Dict[str, Any]]:
        """Report configuration state per channel, without exposing secrets."""
        statuses: List[Dict[str, Any]] = []
        seen: set[str] = set()
        for method in (*FREE_METHODS, *settings.indexer_provider_order):
            if method in seen:
                continue
            seen.add(method)
            provider = self.providers.get(method)
            if provider is None:
                continue
            statuses.append(
                {
                    "method": provider.method,
                    "label": provider.label,
                    "configured": provider.configured,
                    "enabled": provider.enabled,
                    "endpoint": provider.endpoint,
                    "detail": provider.unavailable_reason,
                }
            )
        return statuses

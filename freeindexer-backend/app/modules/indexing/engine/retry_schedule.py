"""Intelligent retry schedule.

Based on publicly documented cadences from SpeedyIndex (72h report, day-6
resubmit, day-7/11 final), Rapid URL Indexer (day-4 / day-14 reports, up to 3
Apex attempts), and IndexMeNow (hourly checks are too aggressive for a free
self-hosted crawler — we verify on a backoff instead).

We never retry every hour, never hammer Google, and never retry terminal
failures (dead URLs, noindex, robots blocked, missing backlink).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional, Sequence

from app.modules.indexing.engine.states import PipelineStatus, TERMINAL_NO_RETRY

# Attempt 1 immediate, then 6h, 24h, 48h, 72h, 7d, 14d.
DISCOVERY_BACKOFF_SECONDS: tuple[int, ...] = (
    0,
    6 * 3600,
    24 * 3600,
    48 * 3600,
    72 * 3600,
    7 * 86400,
    14 * 86400,
)
MAX_DISCOVERY_ATTEMPTS = 7
FINAL_VERIFICATION_AFTER = timedelta(days=7)
JOB_TIMEOUT = timedelta(days=14)


def next_retry_at(
    attempt_count: int,
    *,
    now: Optional[datetime] = None,
    backoff: Sequence[int] = DISCOVERY_BACKOFF_SECONDS,
    jitter_ratio: float = 0.0,
) -> datetime:
    """Return when attempt ``attempt_count`` (1-based after increment) should run.

    Attempt 1 → immediately; attempt 2 → +6h from now, etc.
    ``jitter_ratio`` adds a small random spread so workers do not stampede.
    Tests keep the default of 0 so timings stay deterministic.
    """
    now = now or datetime.now(timezone.utc)
    idx = max(0, attempt_count - 1)
    if idx >= len(backoff):
        delay = backoff[-1]
    else:
        delay = backoff[idx]
    if jitter_ratio and delay:
        import random

        spread = delay * jitter_ratio
        delay = max(0, int(delay + random.uniform(-spread, spread)))
    return now + timedelta(seconds=delay)


def should_retry(status: PipelineStatus, attempt_count: int) -> bool:
    if status in TERMINAL_NO_RETRY:
        return False
    if attempt_count >= MAX_DISCOVERY_ATTEMPTS:
        return False
    return True


def is_timed_out(submitted_at: Optional[datetime], *, now: Optional[datetime] = None) -> bool:
    if submitted_at is None:
        return False
    now = now or datetime.now(timezone.utc)
    submitted = submitted_at if submitted_at.tzinfo else submitted_at.replace(tzinfo=timezone.utc)
    return now - submitted >= JOB_TIMEOUT


def final_verification_due(
    submitted_at: Optional[datetime], *, now: Optional[datetime] = None
) -> bool:
    if submitted_at is None:
        return False
    now = now or datetime.now(timezone.utc)
    submitted = submitted_at if submitted_at.tzinfo else submitted_at.replace(tzinfo=timezone.utc)
    return now - submitted >= FINAL_VERIFICATION_AFTER

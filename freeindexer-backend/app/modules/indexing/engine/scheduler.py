"""Calendar discovery scheduler (SpeedyIndex-like cadence, no spam).

Public paid-indexer pattern we can reproduce: filter first, then retry on a
multi-day cadence (day 0 / 1 / 3 / 7 / 14), then a final verification.
Failed discovery still uses the shorter exponential backoff.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.core.config import settings
from app.modules.indexing.engine.retry_schedule import (
    JOB_TIMEOUT,
    next_retry_at,
    should_retry,
)
from app.modules.indexing.engine.states import PipelineStatus

CALENDAR_DAYS = (1, 3, 7, 14)

# Empirical verification checkpoints from experiment_started_at (not discovery spam).
VERIFY_OFFSETS = (
    (0, "T+0"),
    (15 * 60, "T+15m"),
    (3600, "T+1h"),
    (3 * 3600, "T+3h"),
    (6 * 3600, "T+6h"),
    (12 * 3600, "T+12h"),
    (24 * 3600, "T+24h"),
    (48 * 3600, "T+48h"),
)


@dataclass(frozen=True, slots=True)
class ScheduleAction:
    name: str
    action: str
    next_at: Optional[datetime]
    note: str


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def calendar_action(
    submitted_at: Optional[datetime],
    *,
    now: Optional[datetime] = None,
    jitter_ratio: float = 0.1,
) -> ScheduleAction:
    """Pick the next calendar phase from submission time."""
    now = now or datetime.now(timezone.utc)
    if submitted_at is None:
        return ScheduleAction("unknown", "retry_discovery", now, "missing submitted_at")
    start = _aware(submitted_at)
    elapsed = now - start
    if elapsed >= JOB_TIMEOUT or elapsed >= timedelta(days=14):
        return ScheduleAction("DAY_14", "final", None, "14-day window complete")
    if elapsed < timedelta(hours=20):
        return ScheduleAction(
            "DAY_1", "feed_refresh", _jitter(start + timedelta(days=1), jitter_ratio), "scheduled day-1 feed refresh"
        )
    if elapsed < timedelta(days=2):
        return ScheduleAction(
            "DAY_1", "feed_refresh", start + timedelta(days=3), "due day-1 feed refresh"
        )
    if elapsed < timedelta(days=5):
        return ScheduleAction(
            "DAY_3", "retry_discovery", start + timedelta(days=7), "due day-3 discovery retry"
        )
    if elapsed < timedelta(days=10):
        return ScheduleAction(
            "DAY_7", "verify", start + timedelta(days=14), "due day-7 verification"
        )
    return ScheduleAction("DAY_14", "final", None, "due day-14 final status")


def _jitter(when: datetime, jitter_ratio: float) -> datetime:
    if not jitter_ratio:
        return when
    import random

    spread = min(3600.0, 86400 * jitter_ratio)
    return when + timedelta(seconds=random.uniform(0, spread))


def next_after_success(
    submitted_at: Optional[datetime],
    *,
    now: Optional[datetime] = None,
    jitter_ratio: float = 0.1,
) -> datetime:
    action = calendar_action(submitted_at, now=now, jitter_ratio=jitter_ratio)
    return action.next_at or (now or datetime.now(timezone.utc)) + timedelta(days=1)


def retry_action_for_job(job, *, now: Optional[datetime] = None) -> ScheduleAction:
    """Failed hub listing uses short backoff. Experiment jobs use verify checkpoints."""
    now = now or datetime.now(timezone.utc)
    failed = (getattr(job, "discovery_status", None) or "") == "FAILED"
    if failed or getattr(job, "pipeline_status", "") == PipelineStatus.DISCOVERY_FAILED.value:
        nxt = next_retry_at(getattr(job, "attempt_count", 0) + 1, now=now, jitter_ratio=0.1)
        return ScheduleAction("BACKOFF", "retry_discovery", nxt, "exponential backoff after failed discovery")
    started = getattr(job, "experiment_started_at", None)
    if started is not None:
        action = experiment_verify_action(job, now=now)
        if bool(getattr(settings, "max_discovery_mode", False)) and action.action == "verify":
            return ScheduleAction(
                action.name,
                "retry_and_verify",
                action.next_at,
                f"{action.note}. MAX_DISCOVERY_MODE re-publishes discovery then verifies. "
                "WEBSUB_ACCEPTED is not INDEXED.",
            )
        return action
    return calendar_action(getattr(job, "submitted_at", None), now=now)


def experiment_verify_action(job, *, now: Optional[datetime] = None) -> ScheduleAction:
    """Next T+15m / 1h / 3h / 6h / 12h / 24h / 48h verification.

    Each checkpoint is verified exactly once. If a checkpoint was missed
    (e.g. the service was down or a job was created before the fast cadence
    existed), the scheduler catches up by verifying the highest checkpoint
    already reached in time — never re-verifying past checkpoints and never
    spamming (one verification per checkpoint).
    """
    now = now or datetime.now(timezone.utc)
    start = _aware(getattr(job, "experiment_started_at", None) or getattr(job, "submitted_at") or now)
    elapsed = (now - start).total_seconds()
    current = getattr(job, "experiment_checkpoint", None) or "T+0"
    names = [name for _, name in VERIFY_OFFSETS]
    try:
        idx = names.index(current)
    except ValueError:
        idx = 0
    if elapsed >= 14 * 86400:
        return ScheduleAction("T+48h", "final", None, "14-day experiment window complete")
    reached = idx
    for i, (offset, _name) in enumerate(VERIFY_OFFSETS):
        if offset <= elapsed:
            reached = max(reached, i)
    if reached > idx:
        name = VERIFY_OFFSETS[reached][1]
        nxt_after = None
        if reached + 1 < len(VERIFY_OFFSETS):
            nxt_after = start + timedelta(seconds=VERIFY_OFFSETS[reached + 1][0])
        return ScheduleAction(
            name,
            "verify",
            nxt_after,
            f"catch-up {name} verification (checkpoint was {current})",
        )
    nxt_idx = min(idx + 1, len(VERIFY_OFFSETS) - 1)
    offset, name = VERIFY_OFFSETS[nxt_idx]
    due_at = start + timedelta(seconds=offset)
    if now + timedelta(minutes=5) >= due_at or elapsed >= offset:
        nxt_after = None
        if nxt_idx + 1 < len(VERIFY_OFFSETS):
            nxt_after = start + timedelta(seconds=VERIFY_OFFSETS[nxt_idx + 1][0])
        action = "final" if name == "T+48h" else "verify"
        return ScheduleAction(name, action, nxt_after, f"due {name} verification")
    return ScheduleAction(
        current,
        "wait",
        due_at,
        f"next verification {names[nxt_idx]} at {due_at.isoformat()}",
    )


class DiscoveryScheduler:
    """Thin facade used by the orchestrator and tests."""

    def next_action(self, job, *, now: Optional[datetime] = None) -> ScheduleAction:
        return retry_action_for_job(job, now=now)

    def should_continue(self, status: PipelineStatus, attempt_count: int) -> bool:
        return should_retry(status, attempt_count)


__all__ = [
    "CALENDAR_DAYS",
    "DiscoveryScheduler",
    "ScheduleAction",
    "calendar_action",
    "experiment_verify_action",
    "next_after_success",
    "retry_action_for_job",
    "VERIFY_OFFSETS",
]

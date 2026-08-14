"""Outbound request throttling for the free indexing engine.

Per-domain and global caps keep the worker from aggressively hitting third-party
sites. Mock transports (unit tests) bypass this limiter.
"""
from __future__ import annotations

import asyncio
import random
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from typing import AsyncIterator, Deque, Dict
from urllib.parse import urlparse

DEFAULT_PER_DOMAIN_PER_MINUTE = 12
DEFAULT_GLOBAL_PER_MINUTE = 60
DEFAULT_PER_DOMAIN_CONCURRENCY = 2
DEFAULT_GLOBAL_CONCURRENCY = 8
WINDOW_SECONDS = 60.0
MAX_WAIT_SECONDS = 30.0


class OutboundRateLimiter:
    def __init__(
        self,
        *,
        per_domain_per_minute: int = DEFAULT_PER_DOMAIN_PER_MINUTE,
        global_per_minute: int = DEFAULT_GLOBAL_PER_MINUTE,
        per_domain_concurrency: int = DEFAULT_PER_DOMAIN_CONCURRENCY,
        global_concurrency: int = DEFAULT_GLOBAL_CONCURRENCY,
    ) -> None:
        self.per_domain_per_minute = per_domain_per_minute
        self.global_per_minute = global_per_minute
        self.per_domain_concurrency = max(1, per_domain_concurrency)
        self.global_concurrency = max(1, global_concurrency)
        self._global: Deque[float] = deque()
        self._hosts: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()
        self._host_sems: Dict[str, asyncio.Semaphore] = {}
        self._global_sem = asyncio.Semaphore(self.global_concurrency)

    def _host_sem(self, host: str) -> asyncio.Semaphore:
        sem = self._host_sems.get(host)
        if sem is None:
            sem = asyncio.Semaphore(self.per_domain_concurrency)
            self._host_sems[host] = sem
        return sem

    def _prune(self, bucket: Deque[float], now: float) -> None:
        cutoff = now - WINDOW_SECONDS
        while bucket and bucket[0] < cutoff:
            bucket.popleft()

    async def acquire(self, url: str) -> float:
        """Block until a rate slot is free. Returns seconds waited."""
        host = (urlparse(url).hostname or "").lower() or "unknown"
        waited = 0.0
        while True:
            async with self._lock:
                now = time.monotonic()
                self._prune(self._global, now)
                self._prune(self._hosts[host], now)
                domain_full = len(self._hosts[host]) >= self.per_domain_per_minute
                global_full = len(self._global) >= self.global_per_minute
                if not domain_full and not global_full:
                    self._global.append(now)
                    self._hosts[host].append(now)
                    return waited
                oldest = []
                if domain_full and self._hosts[host]:
                    oldest.append(self._hosts[host][0])
                if global_full and self._global:
                    oldest.append(self._global[0])
                delay = max(0.05, WINDOW_SECONDS - (now - min(oldest))) if oldest else 0.2
            delay = min(MAX_WAIT_SECONDS, delay + random.uniform(0.05, 0.4))
            await asyncio.sleep(delay)
            waited += delay
            if waited >= MAX_WAIT_SECONDS:
                return waited

    @asynccontextmanager
    async def slot(self, url: str) -> AsyncIterator[float]:
        """Hold per-domain and global concurrency while a fetch runs."""
        host = (urlparse(url).hostname or "").lower() or "unknown"
        waited = await self.acquire(url)
        host_sem = self._host_sem(host)
        await self._global_sem.acquire()
        await host_sem.acquire()
        try:
            yield waited
        finally:
            host_sem.release()
            self._global_sem.release()


_limiter: OutboundRateLimiter | None = None


def get_limiter() -> OutboundRateLimiter:
    global _limiter
    if _limiter is None:
        kwargs = {}
        try:
            from app.core.config import settings

            kwargs = {
                "per_domain_per_minute": int(
                    getattr(settings, "engine_per_domain_rate_per_minute", DEFAULT_PER_DOMAIN_PER_MINUTE)
                ),
                "global_per_minute": int(
                    getattr(settings, "engine_global_rate_per_minute", DEFAULT_GLOBAL_PER_MINUTE)
                ),
                "per_domain_concurrency": int(
                    getattr(settings, "engine_per_domain_concurrency", DEFAULT_PER_DOMAIN_CONCURRENCY)
                ),
                "global_concurrency": int(
                    getattr(settings, "engine_global_concurrency", DEFAULT_GLOBAL_CONCURRENCY)
                ),
            }
        except Exception:
            kwargs = {}
        _limiter = OutboundRateLimiter(**kwargs)
    return _limiter


def parse_retry_after(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return min(MAX_WAIT_SECONDS, max(0.0, float(value)))
    except ValueError:
        return 0.0


__all__ = ["OutboundRateLimiter", "get_limiter", "parse_retry_after"]

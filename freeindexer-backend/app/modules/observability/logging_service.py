"""Structured logging with correlation ID propagation."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import structlog

from app.modules.observability.tracing import get_correlation_id, get_trace_id
from app.observability import metrics

logger = structlog.get_logger("observability")


class LoggingService:
    """Emits structured logs and keeps a tenant-scoped ring buffer for the API."""

    def __init__(self, *, capacity: int = 1000) -> None:
        self._capacity = capacity
        self._logs: Dict[str, List[Dict[str, Any]]] = {}

    def emit(
        self,
        tenant_id: str,
        level: str,
        message: str,
        *,
        service: str = "platform",
        extra: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        record = {
            "tenant_id": tenant_id,
            "level": level,
            "message": message,
            "service": service,
            "correlation_id": get_correlation_id(),
            "trace_id": get_trace_id(),
            "extra": extra or {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        bucket = self._logs.setdefault(tenant_id, [])
        bucket.append(record)
        if len(bucket) > self._capacity:
            del bucket[0 : len(bucket) - self._capacity]
        getattr(logger, level if level in {"debug", "info", "warning", "error"} else "info")(
            message,
            tenant_id=tenant_id,
            correlation_id=record["correlation_id"],
            trace_id=record["trace_id"],
            service=service,
            **(extra or {}),
        )
        metrics.observability_logs_total.labels(tenant_id=tenant_id, level=level).inc()
        return record

    def list_logs(
        self,
        tenant_id: str,
        *,
        level: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        rows = self._logs.get(tenant_id, [])
        if level:
            rows = [r for r in rows if r["level"] == level]
        return list(reversed(rows[-limit:]))

    def cleanup(self, tenant_id: str, keep: int = 200) -> int:
        rows = self._logs.get(tenant_id, [])
        if len(rows) <= keep:
            return 0
        removed = len(rows) - keep
        self._logs[tenant_id] = rows[-keep:]
        return removed

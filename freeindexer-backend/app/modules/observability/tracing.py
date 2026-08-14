"""Distributed tracing helpers with correlation IDs."""
from __future__ import annotations

import uuid
from contextvars import ContextVar
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.observability import metrics

_correlation_id: ContextVar[Optional[str]] = ContextVar("correlation_id", default=None)
_trace_id: ContextVar[Optional[str]] = ContextVar("trace_id", default=None)


def get_correlation_id() -> Optional[str]:
    return _correlation_id.get()


def set_correlation_id(value: Optional[str]) -> None:
    _correlation_id.set(value)


def get_trace_id() -> Optional[str]:
    return _trace_id.get()


def set_trace_id(value: Optional[str]) -> None:
    _trace_id.set(value)


def new_ids() -> Dict[str, str]:
    correlation = str(uuid.uuid4())
    trace = uuid.uuid4().hex
    set_correlation_id(correlation)
    set_trace_id(trace)
    return {"correlation_id": correlation, "trace_id": trace}


class TracingService:
    """Records request/span traces for persistence and diagnostics."""

    def __init__(self) -> None:
        self._buffer: Dict[str, List[Dict[str, Any]]] = {}

    def start_span(
        self,
        tenant_id: str,
        service_name: str,
        operation: str,
        *,
        parent_span_id: Optional[str] = None,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        ids = {
            "trace_id": get_trace_id() or uuid.uuid4().hex,
            "correlation_id": get_correlation_id() or str(uuid.uuid4()),
            "span_id": uuid.uuid4().hex[:16],
        }
        set_trace_id(ids["trace_id"])
        set_correlation_id(ids["correlation_id"])
        span = {
            **ids,
            "parent_span_id": parent_span_id,
            "service_name": service_name,
            "operation": operation,
            "status": "started",
            "duration_ms": 0.0,
            "attributes": attributes or {},
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        self._buffer.setdefault(tenant_id, []).append(span)
        return span

    def finish_span(
        self,
        tenant_id: str,
        span_id: str,
        *,
        status: str = "ok",
        duration_ms: float = 0.0,
        attributes: Optional[Dict[str, Any]] = None,
    ) -> Optional[Dict[str, Any]]:
        for span in self._buffer.get(tenant_id, []):
            if span["span_id"] == span_id:
                span["status"] = status
                span["duration_ms"] = duration_ms
                if attributes:
                    span["attributes"].update(attributes)
                span["finished_at"] = datetime.now(timezone.utc).isoformat()
                metrics.observability_traces_total.labels(
                    tenant_id=tenant_id, status=status
                ).inc()
                return span
        return None

    def list_traces(self, tenant_id: str, *, limit: int = 100) -> List[Dict[str, Any]]:
        return list(reversed(self._buffer.get(tenant_id, [])[-limit:]))

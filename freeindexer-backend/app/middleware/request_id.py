"""ASGI middleware that propagates X-Request-ID / correlation IDs."""
from __future__ import annotations

import uuid
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from app.modules.observability.tracing import set_correlation_id, set_trace_id


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Attach correlation and request IDs to every inbound HTTP request."""

    header_name = "X-Request-ID"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get(self.header_name) or str(uuid.uuid4())
        correlation_id = request.headers.get("X-Correlation-ID") or request_id
        trace_id = request.headers.get("X-Trace-ID") or uuid.uuid4().hex
        set_correlation_id(correlation_id)
        set_trace_id(trace_id)
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id
        request.state.trace_id = trace_id
        response = await call_next(request)
        response.headers[self.header_name] = request_id
        response.headers["X-Correlation-ID"] = correlation_id
        response.headers["X-Trace-ID"] = trace_id
        return response

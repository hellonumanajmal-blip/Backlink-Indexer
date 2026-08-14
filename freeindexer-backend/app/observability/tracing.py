"""OpenTelemetry tracing bootstrap for FastAPI."""
from __future__ import annotations

from typing import Optional

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import ConsoleSpanExporter, SimpleSpanProcessor

from app.core.config import settings

_provider: Optional[TracerProvider] = None


def configure_tracing(service_name: str = "freeindexer-backend") -> TracerProvider:
    """Install a process-wide TracerProvider.

    Console export is enabled only outside development to keep tests quiet.
    """
    global _provider
    if _provider is not None:
        return _provider
    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    if settings.environment not in {"development", "test"}:
        provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))
    trace.set_tracer_provider(provider)
    _provider = provider
    return provider


def get_tracer(name: str = "freeindexer"):
    return trace.get_tracer(name)


__all__ = ["configure_tracing", "get_tracer"]

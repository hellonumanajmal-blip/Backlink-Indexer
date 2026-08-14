"""Structured JSON logging configuration (structlog)."""
from __future__ import annotations

import logging
import sys

import structlog

from app.modules.observability.tracing import get_correlation_id, get_trace_id


def _add_correlation(_, __, event_dict: dict) -> dict:
    cid = get_correlation_id()
    tid = get_trace_id()
    if cid:
        event_dict["correlation_id"] = cid
    if tid:
        event_dict["trace_id"] = tid
    return event_dict


def configure_logging(*, json_logs: bool = True) -> None:
    """Configure structlog + stdlib logging for production-grade structured logs."""
    shared_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        _add_correlation,
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    if json_logs:
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer()

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processor=renderer,
        foreign_pre_chain=shared_processors,
    )
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


__all__ = ["configure_logging"]

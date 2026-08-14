"""Global exception handlers emitting structured error envelopes."""
from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import structlog

logger = structlog.get_logger("errors")


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        if isinstance(exc, (HTTPException, RequestValidationError)):
            raise exc
        request_id = getattr(request.state, "request_id", None)
        logger.error(
            "unhandled_exception",
            path=str(request.url.path),
            request_id=request_id,
            error=str(exc),
            exc_info=True,
        )
        return JSONResponse(
            status_code=500,
            content={
                "error": "internal_server_error",
                "detail": "An unexpected error occurred",
                "request_id": request_id,
            },
        )

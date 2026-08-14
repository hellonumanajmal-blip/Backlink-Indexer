"""FastAPI application entrypoint."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from app.api.router import api_router
from app.core.config import settings
from app.middleware.request_id import RequestIdMiddleware
from app.observability import CONTENT_TYPE_LATEST, render_metrics
from app.observability.logging import configure_logging
from app.observability.tracing import configure_tracing


def create_app() -> FastAPI:
    configure_logging(json_logs=settings.environment != "development")
    configure_tracing(service_name=settings.app_name)

    app = FastAPI(title=settings.app_name, debug=settings.debug)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(RequestIdMiddleware)

    @app.get("/health", tags=["system"])
    async def health() -> dict:
        return {"status": "ok", "environment": settings.environment}

    @app.get("/metrics", tags=["system"])
    async def metrics() -> Response:
        return Response(content=render_metrics(), media_type=CONTENT_TYPE_LATEST)

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()

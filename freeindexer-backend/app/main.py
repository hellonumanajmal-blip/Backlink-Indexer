"""FastAPI application entrypoint."""
from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.router import api_router
from app.core.config import settings
from app.database import get_db
from app.middleware.crawler_evidence import CrawlerEvidenceMiddleware, persist_crawler_evidence
from app.middleware.request_id import RequestIdMiddleware
from app.modules.indexing.engine.public_router import _robots_txt_body, _sitemap_xml_body
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
    app.add_middleware(CrawlerEvidenceMiddleware)

    @app.get("/health", tags=["system"])
    async def health() -> dict:
        return {"status": "ok", "environment": settings.environment}

    @app.get("/metrics", tags=["system"])
    async def metrics() -> Response:
        return Response(content=render_metrics(), media_type=CONTENT_TYPE_LATEST)

    @app.get("/robots.txt", tags=["public-discovery"])
    async def root_robots_txt(
        db: AsyncSession = Depends(get_db),
        _: None = Depends(persist_crawler_evidence),
    ) -> Response:
        return Response(
            content=_robots_txt_body(),
            media_type="text/plain; charset=utf-8",
            headers={"Cache-Control": "public, max-age=3600"},
        )

    @app.get("/sitemap.xml", tags=["public-discovery"])
    async def root_sitemap(
        db: AsyncSession = Depends(get_db),
        _: None = Depends(persist_crawler_evidence),
    ) -> Response:
        return Response(
            content=await _sitemap_xml_body(db),
            media_type="application/xml; charset=utf-8",
            headers={"Cache-Control": "public, max-age=3600", "X-Robots-Tag": "index, follow"},
        )

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()

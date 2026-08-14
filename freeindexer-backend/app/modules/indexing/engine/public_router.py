"""Unauthenticated crawlable hub + feeds for legitimate URL discovery."""
from __future__ import annotations

from html import escape
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database import get_db
from app.modules.indexing.engine.feeds import (
    feed_etag,
    render_atom,
    render_hub_html,
    render_json_feed,
    render_rss,
    websub_link_headers,
)
from app.modules.indexing.engine.repository import get_public_by_hash, list_categories, list_category_items, list_feed_items

router = APIRouter(prefix="/public", tags=["public-discovery"])

DISCLAIMER = (
    "These listings are outbound discovery hints on a property we host. "
    "Inclusion does not mean Google crawled or indexed the target URL."
)
CACHE_CONTROL = "public, max-age=300"


def _urls() -> tuple[str, str, str, str]:
    hub = settings.public_hub_url or "https://pintdown.site/featured"
    feed = settings.websub_feed_url or "https://pintdown.site/feed.xml"
    hub_ping = settings.websub_hub_urls[0] if settings.websub_hub_urls else "https://pubsubhubbub.appspot.com"
    return hub, feed, hub_ping, "https://pintdown.site/feed.atom"


def _feed_headers(body: str, *, content_type: str, feed_url: str, hub_url: str) -> dict:
    return {
        "Content-Type": content_type,
        "Cache-Control": CACHE_CONTROL,
        "ETag": feed_etag(body),
        "Link": websub_link_headers(feed_url=feed_url, hub_url=hub_url),
        "X-Robots-Tag": "index, follow",
    }


def _public_card(item) -> dict:
    return {
        "title": item.title,
        "description": item.summary,
        "url": item.url,
        "hash": item.url_hash,
        "detail_path": f"/discover/{item.url_hash}" if item.url_hash else None,
        "platform": "discovery-hub",
        "domain": (urlparse(item.url).hostname or ""),
        "date_added": item.updated.isoformat() if item.updated else None,
    }


def _safe_job_public(job) -> dict:
    parsed = urlparse(job.source_url)
    host = (parsed.hostname or "listed-host").lower()
    path = parsed.path or "/"
    return {
        "hash": job.source_url_hash,
        "url": job.source_url,
        "title": f"Public mention on {host}{path}",
        "domain": host,
        "submitted_at": job.submitted_at.isoformat() if job.submitted_at else None,
        "http_status": job.http_status,
        "backlink_found": job.backlink_found,
        "canonical_status": job.canonical_status,
        "disclaimer": DISCLAIMER,
    }


@router.get("/featured")
async def public_featured(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=100, ge=1, le=200),
) -> dict:
    items = await list_feed_items(db, limit=limit)
    return {
        "items": [_public_card(item) for item in items],
        "disclaimer": DISCLAIMER,
    }


@router.get("/discover")
async def public_discover(
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=1000),
) -> dict:
    # Fetch a window then slice — inventory is already capped at 200 qualifying URLs.
    items = await list_feed_items(db, limit=min(200, offset + limit))
    window = items[offset : offset + limit]
    return {
        "items": [_public_card(item) for item in window],
        "total": len(items),
        "limit": limit,
        "offset": offset,
        "disclaimer": DISCLAIMER,
        "categories": await list_categories(db, min_count=3, limit=30),
    }


@router.get("/categories")
async def public_categories(db: AsyncSession = Depends(get_db)) -> dict:
    rows = await list_categories(db, min_count=3, limit=50)
    return {"items": rows, "disclaimer": DISCLAIMER}


@router.get("/categories/{domain}")
async def public_category(domain: str, db: AsyncSession = Depends(get_db)) -> dict:
    items = await list_category_items(db, domain, limit=50)
    if len(items) < 3:
        raise HTTPException(status_code=404, detail="Category is too thin to publish")
    return {
        "domain": domain,
        "items": [_public_card(item) for item in items],
        "disclaimer": DISCLAIMER,
    }


@router.get("/urls/{url_hash}")
async def public_url_detail(url_hash: str, db: AsyncSession = Depends(get_db)) -> dict:
    job = await get_public_by_hash(db, url_hash)
    if job is None:
        raise HTTPException(status_code=404, detail="URL is not on the public discovery index")
    return _safe_job_public(job)


@router.get("/url/{url_hash}")
async def public_url_html(url_hash: str, db: AsyncSession = Depends(get_db)) -> Response:
    job = await get_public_by_hash(db, url_hash)
    if job is None:
        raise HTTPException(status_code=404, detail="URL is not on the public discovery index")
    card = _safe_job_public(job)
    items = await list_feed_items(db, limit=200)
    prev_hash = None
    next_hash = None
    for idx, item in enumerate(items):
        if item.url_hash == url_hash:
            if idx > 0:
                prev_hash = items[idx - 1].url_hash
            if idx + 1 < len(items):
                next_hash = items[idx + 1].url_hash
            break
    host = escape(card["domain"] or "listed-host")
    dest = escape(card["url"])
    title = escape(card["title"] or f"Public mention on {host}")
    prev_link = (
        f'<a href="/discover/{escape(prev_hash)}">Previous listing</a>'
        if prev_hash
        else '<a href="/discover">Discovery index</a>'
    )
    next_link = (
        f'<a href="/discover/{escape(next_hash)}">Next listing</a>'
        if next_hash
        else '<a href="/featured">Featured hub</a>'
    )
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>{title}</title>
  <link rel="canonical" href="https://pintdown.site/discover/{escape(url_hash)}"/>
  <meta name="robots" content="index,follow"/>
  <meta name="description" content="Crawlable discovery listing for a public mention on {host}."/>
</head>
<body>
  <nav>
    <a href="/featured">Featured</a> →
    <a href="/discover">Discover</a> →
    <span>This listing</span> →
    <a href="{dest}">{dest}</a>
  </nav>
  <h1>{title}</h1>
  <p>This page is a stable, crawlable HTML listing on a property we host. It exists so
  search crawlers can traverse a public path from our hub to an outbound URL. It is not
  a ranking doorway, not a Google indexing claim, and it does not include operator
  account information.</p>
  <p>The mention lives on <strong>{host}</strong>. Crawlers may follow the outbound
  link below. Listing it here does not mean Google has crawled or indexed that destination.</p>
  <p><a href="{dest}">{dest}</a></p>
  <p>HTTP status observed by our crawler (never Googlebot): {escape(str(card['http_status'] or 'unknown'))}.
  Canonical signal: {escape(str(card['canonical_status'] or 'unknown'))}.</p>
  <p>{escape(DISCLAIMER)}</p>
  <p>{prev_link} · {next_link} · <a href="/feed.xml">RSS</a> · <a href="/atom.xml">Atom</a> · <a href="/feed.json">JSON</a></p>
</body>
</html>
"""
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Cache-Control": CACHE_CONTROL, "X-Robots-Tag": "index, follow"},
    )


@router.get("/hub")
async def public_hub(db: AsyncSession = Depends(get_db)) -> Response:
    hub, _, _, _ = _urls()
    items = await list_feed_items(db, limit=200)
    html = render_hub_html(items, canonical=hub)
    return Response(
        content=html,
        media_type="text/html; charset=utf-8",
        headers={"Cache-Control": CACHE_CONTROL, "X-Robots-Tag": "index, follow"},
    )


@router.get("/feed.xml")
@router.get("/rss.xml")
async def public_rss(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    hub, feed, ping, _ = _urls()
    items = await list_feed_items(db, limit=200)
    xml = render_rss(items, home_url=hub, feed_url=feed, hub_url=ping)
    headers = _feed_headers(xml, content_type="application/rss+xml; charset=utf-8", feed_url=feed, hub_url=ping)
    if request.headers.get("if-none-match") == headers["ETag"]:
        return Response(status_code=304, headers=headers)
    return Response(content=xml, headers=headers)


@router.get("/feed.atom")
@router.get("/atom.xml")
async def public_atom(request: Request, db: AsyncSession = Depends(get_db)) -> Response:
    hub, _, ping, atom = _urls()
    items = await list_feed_items(db, limit=200)
    xml = render_atom(items, home_url=hub, feed_url=atom, hub_url=ping)
    headers = _feed_headers(xml, content_type="application/atom+xml; charset=utf-8", feed_url=atom, hub_url=ping)
    if request.headers.get("if-none-match") == headers["ETag"]:
        return Response(status_code=304, headers=headers)
    return Response(content=xml, headers=headers)


@router.get("/feed.json")
async def public_json(db: AsyncSession = Depends(get_db)) -> Response:
    hub, _, ping, _ = _urls()
    items = await list_feed_items(db, limit=200)
    payload = render_json_feed(items, home_url=hub, feed_url="https://pintdown.site/feed.json")
    import json

    body = json.dumps(payload)
    headers = {
        "Content-Type": "application/feed+json; charset=utf-8",
        "Cache-Control": CACHE_CONTROL,
        "ETag": feed_etag(body),
        "Link": websub_link_headers(feed_url="https://pintdown.site/feed.json", hub_url=ping),
        "X-Robots-Tag": "index, follow",
    }
    return Response(content=body, headers=headers)

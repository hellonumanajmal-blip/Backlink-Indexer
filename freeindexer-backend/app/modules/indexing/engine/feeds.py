"""Generate crawlable RSS / Atom / JSON feeds from the discovery inventory.

A URL appearing in this feed is a discovery hint on a property we host. It is
not proof that Google crawled or indexed the target URL.

Timestamps are the submission time of each URL. lastBuildDate is the newest
item timestamp — never "now" on every request (that would fake freshness).
"""
from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from html import escape
from typing import Iterable, List, Optional, Sequence
from xml.sax.saxutils import escape as xml_escape

from app.modules.indexing.engine.backlink_checker import urls_equivalent


@dataclass(slots=True)
class FeedItem:
    url: str
    title: str
    summary: str = ""
    updated: Optional[datetime] = None
    id: Optional[str] = None
    url_hash: Optional[str] = None


def _aware(value: Optional[datetime]) -> Optional[datetime]:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _iso(value: Optional[datetime]) -> str:
    aware = _aware(value)
    if aware is None:
        return datetime.now(timezone.utc).isoformat()
    return aware.isoformat()


def _rfc822(value: Optional[datetime]) -> str:
    aware = _aware(value) or datetime.now(timezone.utc)
    return aware.strftime("%a, %d %b %Y %H:%M:%S +0000")


def _newest(items: Sequence[FeedItem]) -> Optional[datetime]:
    stamps = [_aware(item.updated) for item in items if item.updated]
    stamps = [s for s in stamps if s is not None]
    return max(stamps) if stamps else None


def url_in_document(document: str, url: str) -> bool:
    if not document or not url:
        return False
    if url in document:
        return True
    stripped = url.rstrip("/")
    return bool(stripped) and stripped in document


def inventory_contains(items: Sequence[FeedItem], url: str) -> bool:
    return any(urls_equivalent(item.url, url) for item in items)


def feed_etag(body: str) -> str:
    digest = hashlib.sha256(body.encode("utf-8")).hexdigest()[:32]
    return f'"{digest}"'


def websub_link_headers(*, feed_url: str, hub_url: str) -> str:
    return f'<{hub_url}>; rel="hub", <{feed_url}>; rel="self"'


def render_rss(
    items: Iterable[FeedItem],
    *,
    title: str = "PintDown Discovery Feed",
    home_url: str = "https://pintdown.site/featured",
    feed_url: str = "https://pintdown.site/feed.xml",
    hub_url: str = "https://pubsubhubbub.appspot.com",
) -> str:
    rows = list(items)
    built = _rfc822(_newest(rows))
    entries = []
    for item in rows:
        guid = item.url
        pub = _rfc822(item.updated)
        entries.append(
            f"""    <item>
      <title>{xml_escape(item.title or item.url)}</title>
      <link>{xml_escape(item.url)}</link>
      <guid isPermaLink="true">{xml_escape(guid)}</guid>
      <description>{xml_escape(item.summary or item.title or item.url)}</description>
      <pubDate>{pub}</pubDate>
    </item>"""
        )
    body = "\n".join(entries)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>{xml_escape(title)}</title>
    <link>{xml_escape(home_url)}</link>
    <description>Outbound discovery listings we host. Inclusion is a discovery hint, not a Google indexing confirmation.</description>
    <lastBuildDate>{built}</lastBuildDate>
    <atom:link href="{xml_escape(feed_url)}" rel="self" type="application/rss+xml"/>
    <atom:link href="{xml_escape(hub_url)}" rel="hub"/>
{body}
  </channel>
</rss>
"""


def render_atom(
    items: Iterable[FeedItem],
    *,
    title: str = "PintDown Discovery Feed",
    home_url: str = "https://pintdown.site/featured",
    feed_url: str = "https://pintdown.site/feed.atom",
    hub_url: str = "https://pubsubhubbub.appspot.com",
) -> str:
    rows = list(items)
    updated = _iso(_newest(rows) or datetime.now(timezone.utc))
    entries = []
    for item in rows:
        entries.append(
            f"""  <entry>
    <title>{xml_escape(item.title or item.url)}</title>
    <link href="{xml_escape(item.url)}" rel="alternate"/>
    <id>{xml_escape(item.id or item.url)}</id>
    <updated>{_iso(item.updated)}</updated>
    <published>{_iso(item.updated)}</published>
    <summary>{xml_escape(item.summary or item.title or item.url)}</summary>
  </entry>"""
        )
    body = "\n".join(entries)
    return f"""<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>{xml_escape(title)}</title>
  <link href="{xml_escape(home_url)}" rel="alternate"/>
  <link href="{xml_escape(feed_url)}" rel="self"/>
  <link href="{xml_escape(hub_url)}" rel="hub"/>
  <updated>{updated}</updated>
  <id>{xml_escape(feed_url)}</id>
  <subtitle>Outbound discovery listings we host. Not a Google indexing confirmation.</subtitle>
{body}
</feed>
"""


def render_json_feed(
    items: Iterable[FeedItem],
    *,
    title: str = "PintDown Discovery Feed",
    home_url: str = "https://pintdown.site/featured",
    feed_url: str = "https://pintdown.site/feed.json",
) -> dict:
    return {
        "version": "https://jsonfeed.org/version/1.1",
        "title": title,
        "home_page_url": home_url,
        "feed_url": feed_url,
        "description": (
            "Outbound discovery listings we host. Inclusion is a discovery hint, "
            "not a Google indexing confirmation."
        ),
        "items": [
            {
                "id": item.id or item.url,
                "url": item.url,
                "title": item.title or item.url,
                "content_text": item.summary or item.title or item.url,
                "date_published": _iso(item.updated),
                "date_modified": _iso(item.updated),
            }
            for item in items
        ],
    }


def render_hub_html(
    items: Iterable[FeedItem],
    *,
    title: str = "PintDown public discovery hub",
    canonical: str = "https://pintdown.site/featured",
) -> str:
    rows = list(items)
    lis = []
    for item in rows:
        detail = f"url/{escape(item.url_hash)}" if item.url_hash else ""
        listing = (
            f' <a href="{detail}">listing</a>'
            if detail
            else ""
        )
        lis.append(
            f'<li><a href="{escape(item.url)}">{escape(item.title or item.url)}</a>'
            f"{listing}"
            f"<p>{escape(item.summary or '')}</p></li>"
        )
    body = "\n".join(lis) or "<li>No discovery URLs published yet.</li>"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>{escape(title)}</title>
  <link rel="canonical" href="{escape(canonical)}"/>
  <meta name="robots" content="index,follow"/>
  <link rel="alternate" type="application/rss+xml" href="feed.xml"/>
  <link rel="alternate" type="application/atom+xml" href="feed.atom"/>
  <link rel="alternate" type="application/feed+json" href="feed.json"/>
</head>
<body>
  <h1>{escape(title)}</h1>
  <p>These are outbound mentions we host so crawlers can discover third-party URLs.
  Listing a URL here is not proof that Google crawled or indexed it.</p>
  <p><a href="index">Public discovery index</a> · <a href="feed.xml">RSS</a> · <a href="feed.atom">Atom</a> · <a href="feed.json">JSON</a></p>
  <ul>
  {body}
  </ul>
</body>
</html>
"""


def render_index_html(
    items: Iterable[FeedItem],
    *,
    title: str = "PintDown public discovery index",
    canonical: str = "https://pintdown.site/index",
) -> str:
    rows = list(items)
    lis = []
    for item in rows:
        detail = f"url/{escape(item.url_hash)}" if item.url_hash else ""
        lis.append(
            f'<li><a href="{detail}">{escape(item.title or item.url)}</a>'
            f"<p>{escape(item.summary or '')}</p></li>"
        )
    body = "\n".join(lis) or "<li>No discovery URLs published yet.</li>"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>{escape(title)}</title>
  <link rel="canonical" href="{escape(canonical)}"/>
  <meta name="robots" content="index,follow"/>
</head>
<body>
  <h1>{escape(title)}</h1>
  <p>Every URL in the public discovery inventory, with a stable per-URL page.</p>
  <p><a href="hub">Discovery hub</a> · <a href="feed.xml">RSS</a> · <a href="feed.atom">Atom</a> · <a href="feed.json">JSON</a></p>
  <ul>
  {body}
  </ul>
</body>
</html>
"""


__all__ = [
    "FeedItem",
    "feed_etag",
    "inventory_contains",
    "render_atom",
    "render_hub_html",
    "render_index_html",
    "render_json_feed",
    "render_rss",
    "url_in_document",
    "websub_link_headers",
]

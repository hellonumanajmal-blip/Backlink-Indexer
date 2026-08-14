import { NextResponse } from "next/server";

const FASTAPI = process.env.FASTAPI_INTERNAL_URL || process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI.replace(/\/$/, "")}/api/public/feed.xml`, { cache: "no-store" });
    if (res.ok) {
      return new NextResponse(await res.text(), {
        headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
      });
    }
  } catch {
    /* fall through to empty honest feed */
  }
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>PintDown Discovery Feed</title>
    <link>https://pintdown.site/featured</link>
    <description>Outbound discovery listings. Empty because the inventory API was unreachable — this feed never fabricates submitted URLs.</description>
    <atom:link href="https://pintdown.site/feed.xml" rel="self" type="application/rss+xml"/>
    <atom:link href="https://pubsubhubbub.appspot.com" rel="hub"/>
  </channel>
</rss>`;
  return new NextResponse(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}

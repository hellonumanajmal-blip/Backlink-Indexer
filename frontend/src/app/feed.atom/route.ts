import { NextResponse } from "next/server";

const FASTAPI = process.env.FASTAPI_INTERNAL_URL || process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI.replace(/\/$/, "")}/api/public/feed.atom`, { cache: "no-store" });
    if (res.ok) {
      return new NextResponse(await res.text(), {
        headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
      });
    }
  } catch {
    /* honest empty feed */
  }
  const atom = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>PintDown Discovery Feed</title>
  <link href="https://pintdown.site/featured" rel="alternate"/>
  <link href="https://pintdown.site/feed.atom" rel="self"/>
  <link href="https://pubsubhubbub.appspot.com" rel="hub"/>
  <id>https://pintdown.site/feed.atom</id>
  <updated>${new Date().toISOString()}</updated>
  <subtitle>Empty because the inventory API was unreachable. This feed never fabricates submitted URLs.</subtitle>
</feed>`;
  return new NextResponse(atom, {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
}

import { NextResponse } from "next/server";

const FASTAPI = process.env.FASTAPI_INTERNAL_URL || process.env.API_INTERNAL_URL || "http://127.0.0.1:8000";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(`${FASTAPI.replace(/\/$/, "")}/api/public/feed.json`, { cache: "no-store" });
    if (res.ok) {
      return NextResponse.json(await res.json());
    }
  } catch {
    /* honest empty feed */
  }
  return NextResponse.json({
    version: "https://jsonfeed.org/version/1.1",
    title: "PintDown Discovery Feed",
    home_page_url: "https://pintdown.site/featured",
    feed_url: "https://pintdown.site/feed.json",
    description: "Empty because the inventory API was unreachable. This feed never fabricates submitted URLs.",
    items: [],
  });
}

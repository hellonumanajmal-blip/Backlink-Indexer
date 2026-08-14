import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pintdown.site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/featured",
        "/discover",
        "/feed.xml",
        "/feed.atom",
        "/feed.json",
        "/rss.xml",
        "/atom.xml",
        "/sitemap.xml",
      ],
      disallow: ["/internal/", "/dashboard/", "/login", "/signup"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";
import { fetchDiscover } from "@/lib/api";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pintdown.site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: `${SITE}/featured`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${SITE}/discover`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];
  const { items } = await fetchDiscover(50);
  for (const item of items.slice(0, 50)) {
    if (!item.hash) continue;
    entries.push({
      url: `${SITE}/discover/${item.hash}`,
      lastModified: item.date_added ? new Date(item.date_added) : new Date(),
      changeFrequency: "weekly",
      priority: 0.4,
    });
  }
  return entries;
}

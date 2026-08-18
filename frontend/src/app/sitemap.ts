import type { MetadataRoute } from "next";
import { fetchDiscover } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_URL}/featured`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${SITE_URL}/discover`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.5,
    },
  ];
  const { items } = await fetchDiscover(50);
  for (const item of items.slice(0, 50)) {
    if (!item.hash) continue;
    entries.push({
      url: `${SITE_URL}/discover/${item.hash}`,
      lastModified: item.date_added ? new Date(item.date_added) : new Date(),
      changeFrequency: "weekly",
      priority: 0.4,
    });
  }
  return entries;
}

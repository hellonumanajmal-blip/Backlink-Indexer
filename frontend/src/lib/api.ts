export const API_BASE =
  process.env.API_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "";

export type FeaturedItem = {
  title: string;
  description: string;
  url: string;
  platform: string;
  domain: string;
  date_added: string | null;
};

export async function fetchFeatured(): Promise<{ items: FeaturedItem[]; disclaimer: string }> {
  try {
    const baseUrl = API_BASE || (typeof window === "undefined" ? "http://127.0.0.1:3000" : "");
    const res = await fetch(`${baseUrl}/api/public/featured?limit=100`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error("Fetch failed");
    return await res.json();
  } catch {
    return {
      items: [],
      disclaimer:
        "These are publicly shared mentions related to PintDown. Inclusion does not guarantee indexing.",
    };
  }
}

export type DiscoverItem = FeaturedItem & { hash?: string | null; detail_path?: string | null };

export async function fetchDiscover(limit = 50): Promise<{
  items: DiscoverItem[];
  disclaimer: string;
  categories?: Array<{ domain: string; count: number; path: string }>;
}> {
  try {
    const baseUrl = API_BASE || (typeof window === "undefined" ? "http://127.0.0.1:3000" : "");
    const res = await fetch(`${baseUrl}/api/public/discover?limit=${limit}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error("Fetch failed");
    return await res.json();
  } catch {
    return {
      items: [],
      disclaimer:
        "Public discovery index. Listing is a crawlable hint, not a Google indexing confirmation.",
      categories: [],
    };
  }
}

export async function fetchCategory(domain: string): Promise<{
  domain: string;
  items: DiscoverItem[];
  disclaimer: string;
} | null> {
  try {
    const baseUrl = API_BASE || (typeof window === "undefined" ? "http://127.0.0.1:3000" : "");
    const res = await fetch(`${baseUrl}/api/public/categories/${encodeURIComponent(domain)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchDiscoverDetail(hash: string): Promise<{
  url: string;
  title?: string | null;
  domain?: string | null;
  submitted_at: string | null;
  http_status: number | null;
  backlink_found: boolean | null;
  canonical_status: string | null;
  disclaimer: string;
} | null> {
  try {
    const baseUrl = API_BASE || (typeof window === "undefined" ? "http://127.0.0.1:3000" : "");
    const res = await fetch(`${baseUrl}/api/public/urls/${hash}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

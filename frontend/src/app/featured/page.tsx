import type { Metadata } from "next";
import { fetchFeatured } from "@/lib/api";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pintdown.site";

export const metadata: Metadata = {
  title: "Featured Mentions",
  description:
    "A curated list of public mentions, directory listings, and community posts related to PintDown — the free Pinterest video downloader.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${SITE}/featured`,
    types: {
      "application/rss+xml": `${SITE}/feed.xml`,
      "application/atom+xml": `${SITE}/feed.atom`,
      "application/feed+json": `${SITE}/feed.json`,
    },
  },
  openGraph: {
    title: "PintDown Featured Mentions",
    description:
      "Curated public mentions and listings related to PintDown. Useful for humans — not a spam link farm.",
    url: `${SITE}/featured`,
    siteName: "PintDown",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PintDown Featured Mentions",
    description: "Curated public mentions and listings related to PintDown.",
  },
};

export default async function FeaturedPage() {
  const { items, disclaimer } = await fetchFeatured();

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "PintDown Featured Mentions",
    description:
      "Curated public mentions and directory listings related to PintDown.",
    url: `${SITE}/featured`,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.title,
      url: item.url,
      description: item.description || undefined,
    })),
  };

  return (
    <main className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <div
        className="relative overflow-hidden border-b border-[var(--line)]"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 10% 0%, #cfe8d8 0%, transparent 55%), radial-gradient(ellipse 70% 50% at 90% 20%, #e8efe4 0%, transparent 50%), linear-gradient(180deg, #eef4ec 0%, var(--paper) 100%)",
        }}
      >
        <div className="mx-auto max-w-3xl px-6 pb-16 pt-20 md:pt-28">
          <p className="font-display text-4xl font-semibold tracking-tight text-[var(--moss-deep)] md:text-5xl">
            PintDown
          </p>
          <h1 className="mt-4 max-w-xl text-2xl font-semibold leading-snug text-[var(--ink)] md:text-3xl">
            Featured mentions &amp; listings
          </h1>
          <p className="mt-4 max-w-lg text-lg leading-relaxed text-[var(--muted)]">
            A human-curated collection of public places where PintDown is listed or discussed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://pintdown.site"
              className="inline-flex items-center bg-[var(--moss)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--moss-deep)]"
            >
              Open PintDown
            </a>
            <a
              href="/feed.xml"
              className="inline-flex items-center border border-[var(--line)] bg-white/70 px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--moss)]"
            >
              RSS feed
            </a>
            <a
              href="/discover"
              className="inline-flex items-center border border-[var(--line)] bg-white/70 px-5 py-2.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[var(--moss)]"
            >
              Public index
            </a>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-3xl px-6 py-14">
        <h2 className="font-display text-2xl font-semibold text-[var(--ink)]">Latest mentions</h2>
        <p className="mt-2 text-[var(--muted)]">
          Each entry includes where it lives and a short note — useful if you are researching the tool.
        </p>

        {items.length === 0 ? (
          <p className="mt-10 text-[var(--muted)]">No featured mentions yet. Check back soon.</p>
        ) : (
          <ul className="mt-10 divide-y divide-[var(--line)]">
            {items.map((item) => (
              <li key={item.url} className="py-6">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-lg font-semibold text-[var(--moss-deep)] underline-offset-4 hover:underline"
                  >
                    {item.title}
                  </a>
                  <span className="text-sm uppercase tracking-wide text-[var(--muted)]">
                    {item.platform}
                  </span>
                </div>
                {item.description ? (
                  <p className="mt-2 max-w-2xl leading-relaxed text-[var(--muted)]">{item.description}</p>
                ) : null}
                <p className="mt-2 text-sm text-[var(--muted)]">{item.domain}</p>
              </li>
            ))}
          </ul>
        )}

        <aside className="mt-16 border-t border-[var(--line)] pt-8 text-sm leading-relaxed text-[var(--muted)]">
          <p>{disclaimer}</p>
          <p className="mt-3">
            Google decides whether any page is indexed. This page increases legitimate discovery
            signals only — it does not scrape search results, simulate traffic, or guarantee indexing.
          </p>
        </aside>
      </section>
    </main>
  );
}

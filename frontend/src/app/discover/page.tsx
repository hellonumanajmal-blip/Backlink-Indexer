import type { Metadata } from "next";
import { fetchDiscover } from "@/lib/api";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pintdown.site";

export const metadata: Metadata = {
  title: "Public discovery index",
  description:
    "Crawlable listings of qualifying URLs. This is URL discovery, not Google indexing.",
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${SITE}/discover`,
    types: {
      "application/rss+xml": `${SITE}/feed.xml`,
      "application/atom+xml": `${SITE}/atom.xml`,
    },
  },
};

export default async function DiscoverPage() {
  const { items, disclaimer, categories } = await fetchDiscover(50);

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--moss)]">
        URL Discovery
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--moss-deep)]">
        Public discovery index
      </h1>
      <p className="mt-4 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
        Qualifying URLs are listed here so crawlers can follow a public path. Inclusion is not
        crawl monitoring evidence and never means a URL is indexed.
      </p>
      <p className="mt-4 text-sm text-[var(--muted)]">
        <a className="underline" href="/featured">
          Featured hub
        </a>
        {" · "}
        <a className="underline" href="/feed.xml">
          RSS
        </a>
        {" · "}
        <a className="underline" href="/rss.xml">
          RSS alias
        </a>
        {" · "}
        <a className="underline" href="/atom.xml">
          Atom
        </a>
        {" · "}
        <a className="underline" href="/feed.json">
          JSON
        </a>
      </p>
      {categories && categories.length > 0 ? (
        <p className="mt-6 text-sm text-[var(--muted)]">
          Host groups:{" "}
          {categories.map((cat) => (
            <a key={cat.domain} className="mr-3 underline" href={cat.path}>
              {cat.domain} ({cat.count})
            </a>
          ))}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="mt-10 text-[var(--muted)]">No qualifying URLs are listed yet.</p>
      ) : (
        <ul className="mt-10 divide-y divide-[var(--line)]">
          {items.map((item) => (
            <li key={item.hash || item.url} className="py-5">
              <a
                href={item.detail_path || item.url}
                className="font-semibold text-[var(--moss-deep)] underline-offset-4 hover:underline"
              >
                {item.title}
              </a>
              <p className="mt-1 text-sm text-[var(--muted)]">{item.domain}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-16 border-t border-[var(--line)] pt-8 text-sm text-[var(--muted)]">
        {disclaimer}
      </p>
    </main>
  );
}

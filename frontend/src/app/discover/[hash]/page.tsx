import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchDiscoverDetail } from "@/lib/api";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pintdown.site";

type Props = { params: Promise<{ hash: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  const detail = await fetchDiscoverDetail(hash);
  const host = detail?.domain || "listed host";
  return {
    title: detail?.title || `Public mention on ${host}`,
    description: `Crawlable discovery listing for a public mention on ${host}. Not a Google indexing claim.`,
    robots: { index: true, follow: true },
    alternates: { canonical: `${SITE}/discover/${hash}` },
  };
}

export default async function DiscoverDetailPage({ params }: Props) {
  const { hash } = await params;
  const detail = await fetchDiscoverDetail(hash);
  if (!detail) notFound();
  const host = detail.domain || "listed host";

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--moss)]">
        Public discovery
      </p>
      <nav className="mt-3 text-sm text-[var(--muted)]">
        <a className="underline" href="/featured">
          Featured
        </a>
        {" → "}
        <a className="underline" href="/discover">
          Discover
        </a>
        {" → "}
        this listing
        {" → "}
        <a className="underline" href={detail.url}>
          outbound URL
        </a>
      </nav>
      <h1 className="mt-6 font-display text-3xl font-semibold text-[var(--moss-deep)]">
        {detail.title || `Public mention on ${host}`}
      </h1>
      <p className="mt-4 leading-relaxed text-[var(--muted)]">
        This is a stable, crawlable HTML listing on a property we host. It exists so search
        crawlers can follow a public path from our hub to an outbound URL. It is not a ranking
        doorway and does not claim Google crawled or indexed the destination.
      </p>
      <p className="mt-4 leading-relaxed text-[var(--ink)]">
        The mention lives on <strong>{host}</strong>. Crawlers may follow the outbound link
        below. Listing it here is a discovery hint only.
      </p>
      <p className="mt-6">
        <a
          href={detail.url}
          className="break-all text-lg font-semibold text-[var(--moss-deep)] underline"
        >
          {detail.url}
        </a>
      </p>
      <p className="mt-8 text-sm text-[var(--muted)]">
        Observed HTTP status (our crawler, never Googlebot): {detail.http_status ?? "unknown"}.
        Canonical signal: {detail.canonical_status || "unknown"}.
      </p>
      <p className="mt-10 text-sm text-[var(--muted)]">{detail.disclaimer}</p>
      <p className="mt-6 text-sm">
        <a className="underline" href="/discover">
          Back to index
        </a>
        {" · "}
        <a className="underline" href="/featured">
          Featured hub
        </a>
        {" · "}
        <a className="underline" href="/feed.xml">
          RSS
        </a>
      </p>
    </main>
  );
}

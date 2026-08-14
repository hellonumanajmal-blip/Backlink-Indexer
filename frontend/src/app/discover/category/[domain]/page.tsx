import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchCategory } from "@/lib/api";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pintdown.site";

type Props = { params: Promise<{ domain: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { domain } = await params;
  return {
    title: `Discovery listings for ${domain}`,
    robots: { index: true, follow: true },
    alternates: { canonical: `${SITE}/discover/category/${domain}` },
  };
}

export default async function CategoryPage({ params }: Props) {
  const { domain } = await params;
  const data = await fetchCategory(domain);
  if (!data) notFound();

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl font-semibold text-[var(--moss-deep)]">
        Listings on {data.domain}
      </h1>
      <p className="mt-4 text-[var(--muted)]">
        A crawlable group of qualifying URLs from one host. This is not a doorway page and does not
        mean Google indexed them.
      </p>
      <ul className="mt-10 divide-y divide-[var(--line)]">
        {data.items.map((item) => (
          <li key={item.hash || item.url} className="py-4">
            <a className="font-semibold underline" href={item.detail_path || item.url}>
              {item.title}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-10 text-sm text-[var(--muted)]">{data.disclaimer}</p>
      <p className="mt-4 text-sm">
        <a className="underline" href="/discover">
          Back to index
        </a>
      </p>
    </main>
  );
}

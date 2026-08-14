import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://pintdown.site";

export const metadata: Metadata = {
  title: "Backlink Indexing Engine — Free Backlink Discovery Optimization Platform",
  description:
    "Optimize backlink discovery, crawl monitoring, and indexing verification from one intelligent platform. Legitimate discovery signals — Google decides what gets indexed.",
  alternates: { canonical: SITE },
  openGraph: {
    title: "Backlink Indexing Engine",
    description:
      "Optimize backlink discovery, crawl monitoring, and indexing verification from one intelligent platform.",
    url: SITE,
    siteName: "Backlink Indexing Engine",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Backlink Indexing Engine",
    description:
      "Optimize backlink discovery, crawl monitoring, and indexing verification from one intelligent platform.",
  },
  robots: { index: true, follow: true },
};

export default function Page() {
  return <LandingPage />;
}

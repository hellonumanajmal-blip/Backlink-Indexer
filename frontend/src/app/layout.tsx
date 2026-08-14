import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://backlinkindexer.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Backlink Indexer — Free Backlink Indexing Optimization Platform",
    template: "%s · Backlink Indexer",
  },
  description:
    "Discover, monitor and verify your backlinks with a legitimate crawl and indexing workflow. Validate backlinks, optimize crawl discovery, monitor crawls and verify search engine indexing — without fake indexing promises.",
  keywords: [
    "backlink indexer",
    "backlink indexing",
    "backlink discovery",
    "crawl monitoring",
    "index verification",
    "IndexNow",
    "WebSub",
    "SEO tools",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Backlink Indexer",
    title: "Backlink Indexer — Get Your Backlinks Discovered Faster",
    description:
      "One platform to validate backlinks, optimize crawl discovery, monitor crawls and verify search engine indexing — without fake indexing promises.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Backlink Indexer — Get Your Backlinks Discovered Faster",
    description:
      "Validate backlinks, optimize crawl discovery, monitor crawls and verify indexing — without fake indexing promises.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}

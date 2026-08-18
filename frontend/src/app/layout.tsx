import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Backlink Indexer — Backlink discovery and verification",
    template: "%s · Backlink Indexer",
  },
  description:
    "Submit source URLs, validate crawlability, publish legitimate discovery signals, and review index verification evidence. No indexing guarantees.",
  keywords: [
    "backlink indexer",
    "backlink discovery",
    "crawl monitoring",
    "index verification",
    "WebSub",
    "SEO operations",
  ],
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Backlink Indexer",
    title: "Backlink Indexer — Evidence for backlinks you already earned",
    description:
      "Validate backlinks, publish legitimate discovery signals, monitor crawls, and verify indexing only when evidence exists.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Backlink Indexer — Evidence for backlinks you already earned",
    description:
      "Validate backlinks, publish legitimate discovery signals, and review verification evidence — without indexing promises.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} antialiased`}>{children}</body>
    </html>
  );
}

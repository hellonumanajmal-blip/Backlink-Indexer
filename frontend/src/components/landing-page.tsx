"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { BrandLockup } from "@/components/brand";

function Container({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mx-auto w-full max-w-6xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

const NAV = [
  { href: "#product", label: "Product" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b ${
        scrolled ? "border-border bg-background/95 backdrop-blur-md" : "border-transparent bg-background"
      }`}
    >
      <Container className="flex h-16 items-center justify-between">
        <BrandLockup compact />
        <nav className="hidden items-center gap-8 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <a key={item.href} href={item.href} className="text-sm text-muted transition hover:text-foreground">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-muted hover:text-foreground">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-white hover:bg-primary-strong"
          >
            Create account
          </Link>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-foreground md:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </Container>
      {open ? (
        <div className="border-t border-border bg-background md:hidden">
          <nav className="flex flex-col gap-1 px-5 py-3" aria-label="Mobile">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm text-muted hover:bg-surface-2 hover:text-foreground"
              >
                {item.label}
              </a>
            ))}
            <div className="mt-2 flex gap-2 border-t border-border pt-3">
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md border border-border px-3 py-2.5 text-center text-sm font-medium"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-md bg-primary px-3 py-2.5 text-center text-sm font-medium text-white"
              >
                Create account
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function ProductPreview() {
  const rows = [
    { url: "publisher.example/review", domain: "publisher.example", status: "Pending" },
    { url: "news.example/mention", domain: "news.example", status: "Unknown" },
    { url: "blog.example/roundup", domain: "blog.example", status: "—" },
  ];
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5">
        <p className="text-xs font-medium text-muted">Dashboard · Backlinks</p>
        <p className="text-[11px] text-muted">Interface preview — not customer data</p>
      </div>
      <div className="grid grid-cols-[7.5rem_1fr] sm:grid-cols-[9rem_1fr]">
        <div className="hidden border-r border-border bg-surface-2/70 p-3 sm:block">
          <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Monitor</p>
          {["Overview", "Backlinks", "Discovery", "Verification"].map((item, i) => (
            <div
              key={item}
              className={`mt-1 rounded-md px-2 py-1.5 text-xs ${
                i === 1 ? "bg-surface font-medium text-foreground" : "text-muted"
              }`}
            >
              {item}
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-3 gap-px border-b border-border bg-border">
            {["Submitted", "Verified indexed", "Unknown"].map((label) => (
              <div key={label} className="bg-surface px-3 py-3">
                <p className="text-[11px] text-muted">{label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">—</p>
              </div>
            ))}
          </div>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted">
                <th className="px-3 py-2 font-medium">Source URL</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Domain</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.url} className="border-b border-border last:border-0">
                  <td className="truncate px-3 py-2.5 text-foreground">{row.url}</td>
                  <td className="hidden truncate px-3 py-2.5 text-muted sm:table-cell">{row.domain}</td>
                  <td className="px-3 py-2.5 text-muted">{row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="border-b border-border">
      <Container className="grid items-center gap-12 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Backlink operations</p>
          <h1 className="mt-4 max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-[2.75rem] sm:leading-[1.15]">
            Know what happened to the backlinks you already earned.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-muted">
            Submit source URLs, validate they are crawlable, publish legitimate discovery signals,
            and review crawl and index evidence. Search engines still decide what gets indexed.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-white hover:bg-primary-strong"
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex h-11 items-center rounded-md border border-border bg-surface px-5 text-sm font-medium text-foreground hover:border-border-strong"
            >
              See the workflow
            </a>
          </div>
          <p className="mt-5 text-xs leading-5 text-muted">
            No indexing guarantees. No fake counts. Dashboard numbers come from your account.
          </p>
        </div>
        <ProductPreview />
      </Container>
    </section>
  );
}

const CAPABILITIES = [
  {
    title: "Backlink inventory",
    text: "Keep a searchable record of submitted URLs, domains, dispatch status, and timestamps.",
  },
  {
    title: "Discovery signals",
    text: "Publish crawlable hubs, RSS/Atom/JSON feeds, and WebSub pings on properties you control.",
  },
  {
    title: "Crawl monitoring",
    text: "Record HTTP status, robots, canonical, redirects, and crawlability from our own crawler.",
  },
  {
    title: "Index verification",
    text: "Show INDEXED only when verification evidence exists. UNKNOWN stays UNKNOWN.",
  },
];

function Product() {
  return (
    <section id="product" className="border-b border-border py-20">
      <Container>
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Product</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Built around the actual pipeline</h2>
          <p className="mt-3 text-base leading-7 text-muted">
            The dashboard mirrors the backend workflow: validation, discovery, crawl evidence, then
            verification. Features map to running services — not a marketing wishlist.
          </p>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
          {CAPABILITIES.map((item) => (
            <div key={item.title} className="bg-surface p-6">
              <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

const STEPS = [
  { n: "1", title: "Submit a source URL", text: "Add the page that already contains a backlink to your site. Invalid URLs are rejected." },
  { n: "2", title: "Validate the source", text: "HTTP, redirects, robots, and canonical checks run before discovery is queued." },
  { n: "3", title: "Publish discovery signals", text: "Owned hubs, feeds, and WebSub — never owner-only Google APIs for third-party URLs." },
  { n: "4", title: "Review evidence", text: "Crawl and verification results appear when they exist. Empty states stay empty." },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="border-b border-border py-20">
      <Container className="grid gap-12 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">How it works</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">A four-step operations workflow</h2>
          <p className="mt-3 text-sm leading-6 text-muted">
            Discovery improves the chance a URL is found. It does not force Google to crawl or index it.
          </p>
        </div>
        <ol className="divide-y divide-border rounded-lg border border-border bg-surface">
          {STEPS.map((step) => (
            <li key={step.n} className="flex gap-4 px-5 py-5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-xs font-semibold text-foreground">
                {step.n}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                <p className="mt-1 text-sm leading-6 text-muted">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

const FAQS = [
  {
    q: "Does this guarantee Google indexing?",
    a: "No. No platform can guarantee indexing. We optimize discovery signals and record evidence. Google decides what gets indexed.",
  },
  {
    q: "Is this the Google Indexing API?",
    a: "No. This product does not call the Google Indexing API and does not submit third-party URLs to owner-only Google APIs.",
  },
  {
    q: "Can I verify indexing?",
    a: "Yes, when reliable evidence is available. INDEXED is only set from verification evidence. UNKNOWN is never converted into INDEXED.",
  },
  {
    q: "Does the platform create backlinks?",
    a: "No. It does not create backlinks, link farms, or spam. It monitors URLs you submit and publishes legitimate discovery signals for them.",
  },
];

function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <section id="faq" className="border-b border-border py-20">
      <Container className="grid gap-12 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">FAQ</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">Straight answers</h2>
        </div>
        <div className="divide-y divide-border rounded-lg border border-border bg-surface">
          {FAQS.map((item, i) => (
            <div key={item.q}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                aria-expanded={openIdx === i}
              >
                <span className="text-sm font-medium text-foreground">{item.q}</span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${openIdx === i ? "rotate-180" : ""}`} />
              </button>
              {openIdx === i ? <p className="px-5 pb-4 text-sm leading-6 text-muted">{item.a}</p> : null}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="py-20">
      <Container>
        <div className="rounded-lg border border-border bg-surface px-6 py-12 sm:px-10">
          <h2 className="max-w-lg text-3xl font-semibold tracking-tight text-foreground">
            Start with an empty dashboard. Fill it with real URLs.
          </h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
            After signup you land in the same application used in production — not a demo with invented metrics.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-white hover:bg-primary-strong"
            >
              Create account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-md border border-border px-5 text-sm font-medium text-foreground hover:border-border-strong"
            >
              Log in
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-surface-2/60">
      <Container className="flex flex-col gap-8 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <BrandLockup compact />
          <p className="mt-3 max-w-xs text-sm leading-6 text-muted">
            Backlink discovery optimization and evidence-based monitoring.
          </p>
        </div>
        <div className="flex gap-12 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Product</p>
            <ul className="mt-3 space-y-2">
              <li>
                <a href="#product" className="text-muted hover:text-foreground">
                  Product
                </a>
              </li>
              <li>
                <Link href="/dashboard" className="text-muted hover:text-foreground">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/login" className="text-muted hover:text-foreground">
                  Log in
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </Container>
      <Container className="border-t border-border py-5">
        <p className="text-xs leading-5 text-muted">
          Indexing decisions are controlled by search engines. This platform does not guarantee crawl or index outcomes.
        </p>
      </Container>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <Header />
      <main>
        <Hero />
        <Product />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

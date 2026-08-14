"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Menu,
  X,
  Sparkles,
  Gauge,
  Zap,
  Radar,
  Eye,
  Layers,
  ShieldCheck,
  Rss,
  Atom,
  FileJson,
  Webhook,
  Network,
  FlaskConical,
  TrendingUp,
  Clock,
  Globe2,
  CheckCircle2,
  ChevronDown,
  Link2,
  Target,
  RefreshCw,
  BarChart3,
  Search,
  Lock,
  LineChart,
} from "lucide-react";
import { Button, Pill } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_24px_rgba(99,102,241,0.45)]">
        <Link2 className="h-5 w-5 text-white" />
      </div>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-white">Backlink Indexing Engine</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-indigo-300/80">Discovery Intelligence</p>
      </div>
    </Link>
  );
}

function SectionShell({
  id,
  children,
  className = "",
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={className}>
      <div className="mx-auto max-w-7xl px-5 sm:px-8">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

const NAV_LINKS = [
  { href: "#product", label: "Product" },
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#intelligence", label: "Intelligence" },
  { href: "#experiments", label: "Experiments" },
  { href: "#faq", label: "FAQ" },
];

function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all ${
        scrolled ? "border-b border-white/10 bg-[#060714]/80 backdrop-blur-xl" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Logo />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="rounded-md px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/5 hover:text-white"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.7)] transition hover:brightness-110"
          >
            Get Started
          </Link>
        </div>
        <button
          className="rounded-md p-2 text-slate-200 hover:bg-white/5 lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>
      {open ? (
        <div className="border-t border-white/10 bg-[#060714]/95 backdrop-blur-xl lg:hidden">
          <nav className="mx-auto flex max-w-7xl flex-col gap-1 px-5 py-4" aria-label="Mobile">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2.5 text-sm font-medium text-slate-200 hover:bg-white/5"
              >
                {l.label}
              </a>
            ))}
            <div className="mt-3 flex gap-3 border-t border-white/10 pt-4">
              <Link href="/login" onClick={() => setOpen(false)} className="flex-1 rounded-md border border-white/15 px-4 py-2.5 text-center text-sm font-semibold text-white">
                Login
              </Link>
              <Link href="/signup" onClick={() => setOpen(false)} className="flex-1 rounded-md bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-2.5 text-center text-sm font-semibold text-white">
                Get Started
              </Link>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Hero + dashboard preview                                            */
/* ------------------------------------------------------------------ */

function DemoRow({
  label,
  value,
  pct,
}: {
  label: string;
  value: string;
  pct: number;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-slate-200">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function DashboardPreview() {
  const rows = [
    { label: "Quality Score", value: "82 / 100", pct: 82 },
    { label: "Priority", value: "High", pct: 78 },
    { label: "Discovery Status", value: "Published", pct: 88 },
    { label: "Crawl Status", value: "Crawled", pct: 64 },
    { label: "Index Status", value: "Verified", pct: 58 },
    { label: "Avg. Indexing Time", value: "9 days", pct: 46 },
  ];
  return (
    <div className="relative">
      <div className="absolute -inset-8 -z-10 rounded-[2rem] bg-gradient-to-tr from-indigo-600/25 via-violet-600/15 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1022]/90 shadow-2xl backdrop-blur">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          <span className="ml-3 hidden rounded-md bg-white/5 px-3 py-1 text-[11px] text-slate-400 sm:block">
            app.backlinkindexing.engine/dashboard
          </span>
          <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-indigo-300/70">Demo preview</span>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          {rows.map((r) => (
            <div key={r.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs font-medium text-slate-400">{r.label}</p>
              <DemoRow label={r.label} value={r.value} pct={r.pct} />
            </div>
          ))}
        </div>
        {/* mini bar chart */}
        <div className="border-t border-white/10 px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-400">Indexing Overview</p>
            <p className="text-[10px] text-slate-500">Sample data — not production metrics</p>
          </div>
          <div className="flex h-24 items-end gap-2">
            {[35, 52, 44, 66, 58, 78, 70, 88, 82, 94].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-gradient-to-t from-indigo-600/70 to-violet-500/80"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <SectionShell className="relative overflow-hidden pt-36 pb-20 sm:pt-44">
      {/* ambient glows */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[480px] w-[820px] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute right-[-160px] top-40 -z-10 h-[360px] w-[360px] rounded-full bg-violet-600/15 blur-[100px]" />

      <div className="mx-auto max-w-3xl text-center">
        <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-medium text-indigo-200">
          <Sparkles className="h-3.5 w-3.5" />
          Free backlink discovery optimization platform
        </div>
        <h1 className="animate-fade-up mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-6xl" style={{ animationDelay: "60ms" }}>
          Turn Your Backlinks Into{" "}
          <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
            Discoverable Signals
          </span>
          .
        </h1>
        <p className="animate-fade-up mx-auto mt-6 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg" style={{ animationDelay: "120ms" }}>
          Optimize backlink discovery, crawl monitoring, and indexing verification from one
          intelligent platform. Improve the probability of legitimate discovery — Google decides
          what gets indexed.
        </p>
        <div className="animate-fade-up mt-9 flex flex-wrap items-center justify-center gap-4" style={{ animationDelay: "180ms" }}>
          <Link
            href="/signup"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-7 text-base font-semibold text-white shadow-[0_12px_36px_-10px_rgba(99,102,241,0.8)] transition hover:brightness-110"
          >
            Start Monitoring Backlinks
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#product"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-white/15 bg-white/[0.04] px-7 text-base font-semibold text-white transition hover:border-white/30 hover:bg-white/[0.08]"
          >
            Explore the Engine
          </a>
        </div>
        <p className="animate-fade-up mt-8 text-xs font-medium uppercase tracking-[0.2em] text-slate-500" style={{ animationDelay: "240ms" }}>
          Discovery Engine &middot; Crawl Monitoring &middot; Index Verification
        </p>
      </div>

      <div className="animate-fade-up mx-auto mt-16 max-w-4xl" style={{ animationDelay: "300ms" }}>
        <DashboardPreview />
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* Trust strip                                                         */
/* ------------------------------------------------------------------ */

function TrustStrip() {
  const items = [
    { icon: <BarChart3 className="h-5 w-5" />, label: "Backlink Intelligence" },
    { icon: <Rss className="h-5 w-5" />, label: "Discovery Signals" },
    { icon: <Radar className="h-5 w-5" />, label: "Crawl Monitoring" },
    { icon: <Eye className="h-5 w-5" />, label: "Index Evidence" },
  ];
  return (
    <SectionShell className="border-y border-white/5 bg-white/[0.02] py-10">
      <div className="grid grid-cols-2 items-center gap-6 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-center gap-2.5 text-slate-400">
            <span className="text-indigo-400/80">{it.icon}</span>
            <span className="text-sm font-semibold">{it.label}</span>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    icon: <Gauge className="h-5 w-5" />,
    title: "Backlink Quality Engine",
    text: "Scores each backlink with real evidence — HTTP status, canonical, robots, content signals, and crawlability.",
  },
  {
    icon: <Target className="h-5 w-5" />,
    title: "Priority Engine",
    text: "Assigns priority from quality, freshness, and discovery readiness so the right URLs surface first.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Discovery Engine",
    text: "Publishes legitimate discovery signals through owned hubs, feeds, and WebSub — never owner-only APIs on third-party URLs.",
  },
  {
    icon: <Radar className="h-5 w-5" />,
    title: "Crawl Monitoring",
    text: "Tracks our crawler visits, HTTP classes, redirects, robots verdicts, and crawlability scores per URL.",
  },
  {
    icon: <Eye className="h-5 w-5" />,
    title: "Index Verification",
    text: "Verification only runs when reliable evidence exists. UNKNOWN stays UNKNOWN — we never guess INDEXED.",
  },
  {
    icon: <Globe2 className="h-5 w-5" />,
    title: "Domain Intelligence",
    text: "Per-domain history, success rates, and average indexing time derived from observed operational data.",
  },
  {
    icon: <RefreshCw className="h-5 w-5" />,
    title: "Retry Scheduler",
    text: "Celery Beat-driven retry workflow re-queues pending verification on a disciplined schedule.",
  },
  {
    icon: <Rss className="h-5 w-5" />,
    title: "Discovery Feeds",
    text: "RSS, Atom, and JSON feeds that expose crawlable discovery hints — without promising indexing.",
  },
  {
    icon: <FlaskConical className="h-5 w-5" />,
    title: "Experiment Engine",
    text: "Compare discovery strategies (Hub, Hub + WebSub, all signals) using real evidence. Measure before you claim.",
  },
  {
    icon: <LineChart className="h-5 w-5" />,
    title: "Analytics",
    text: "Executive summaries and operational metrics built from observed backlinks, jobs, and signals.",
  },
];

function Features() {
  return (
    <SectionShell id="features" className="py-24">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Features</p>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Everything you need to optimize discovery signals
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-400">
          Built on the actual engine capabilities in this product — no vaporware, no fake features.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-indigo-400/40 hover:bg-white/[0.05]"
          >
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-500/10 text-indigo-300 transition group-hover:shadow-[0_0_20px_rgba(99,102,241,0.35)]">
              {f.icon}
            </div>
            <h3 className="text-base font-semibold text-white">{f.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{f.text}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const STEPS = [
  { n: "01", title: "Submit backlink", text: "Add URLs through the dashboard, bulk import, or CSV. Duplicates and invalid URLs are rejected." },
  { n: "02", title: "Validate source", text: "Real HTTP validation with SSRF guards, redirect-hop checks, robots, canonical, and noindex analysis." },
  { n: "03", title: "Analyze quality", text: "Quality score, crawlability band, and priority are computed from observed evidence." },
  { n: "04", title: "Publish legitimate discovery signals", text: "Owned hubs, feeds, and WebSub — legitimate channels only. Never owner-only APIs for third-party URLs." },
  { n: "05", title: "Monitor crawl & verify indexing", text: "Watch for crawl evidence, then verify indexing only when reliable verification exists." },
];

function HowItWorks() {
  return (
    <SectionShell id="how-it-works" className="py-24">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">How it works</p>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">A disciplined discovery workflow</h2>
      </div>
      <div className="relative grid gap-6 lg:grid-cols-5">
        <div className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-indigo-500/40 to-transparent lg:block" />
        {STEPS.map((s) => (
          <div key={s.n} className="relative flex gap-4 lg:flex-col lg:gap-0">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-indigo-400/40 bg-[#0b1022] text-sm font-bold text-indigo-300 shadow-[0_0_20px_rgba(99,102,241,0.3)]">
              {s.n}
            </div>
            <div className="lg:mt-4">
              <h3 className="text-sm font-semibold text-white">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-400">{s.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-2xl flex-col items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/[0.06] px-6 py-5 text-center">
        <p className="text-sm font-semibold text-amber-200">Discovery ≠ Indexing</p>
        <p className="text-sm leading-6 text-amber-100/70">
          Discovery signals only improve the probability of legitimate discovery. Google ultimately
          controls crawling and indexing — no platform can force it.
        </p>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* Engine section                                                      */
/* ------------------------------------------------------------------ */

const CHANNELS = [
  { icon: <Globe2 className="h-5 w-5" />, title: "HTML discovery", text: "Crawlable hub pages that list submitted URLs as legitimate outbound discovery hints." },
  { icon: <Rss className="h-5 w-5" />, title: "RSS", text: "A hosted feed of submitted URLs for feed-readers and crawlers to follow." },
  { icon: <Atom className="h-5 w-5" />, title: "Atom", text: "Atom-formatted feed with the same legitimate discovery intent." },
  { icon: <FileJson className="h-5 w-5" />, title: "JSON Feed", text: "Machine-readable JSON feed for modern feed consumers." },
  { icon: <Webhook className="h-5 w-5" />, title: "WebSub", text: "Pings hubs like PubSubHubbub so Google's feed fetcher can re-crawl our feed." },
  { icon: <Network className="h-5 w-5" />, title: "Internal crawl graph", text: "Tracks which URLs our crawler visited and what evidence was captured." },
];

function EngineSection() {
  return (
    <SectionShell id="product" className="relative py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[300px] w-[700px] -translate-x-1/2 rounded-full bg-violet-600/10 blur-[110px]" />
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">The engine</p>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          One Engine. Every Legitimate Discovery Signal.
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-400">
          All channels are legitimate discovery mechanisms. None of them guarantee indexing — they
          simply increase the chance your URL is seen.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {CHANNELS.map((c) => (
          <div key={c.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-violet-400/40">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/10 text-violet-300">
              {c.icon}
            </div>
            <h3 className="text-base font-semibold text-white">{c.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-400">{c.text}</p>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* Intelligence                                                        */
/* ------------------------------------------------------------------ */

const INTELLIGENCE = [
  { icon: <Gauge className="h-5 w-5" />, label: "Quality Score", note: "Evidence-weighted score" },
  { icon: <Target className="h-5 w-5" />, label: "Priority", note: "High / medium / low" },
  { icon: <Globe2 className="h-5 w-5" />, label: "Domain History", note: "Observed per-domain record" },
  { icon: <Clock className="h-5 w-5" />, label: "Average Indexing Time", note: "From verified evidence only" },
  { icon: <TrendingUp className="h-5 w-5" />, label: "Success Rate", note: "Indexed ÷ submitted" },
  { icon: <BarChart3 className="h-5 w-5" />, label: "Best Performing Domains", note: "Ranked by real outcomes" },
];

function Intelligence() {
  return (
    <SectionShell id="intelligence" className="py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Intelligence</p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Descriptive intelligence, not predictions
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-400">
            The intelligence layer is built from observed operational data — backlinks, jobs,
            crawls, and verification evidence. Historical insights are descriptive, not predictions.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {INTELLIGENCE.map((it) => (
              <div key={it.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 text-indigo-300">{it.icon}</div>
                <p className="mt-2.5 text-sm font-semibold text-white">{it.label}</p>
                <p className="text-xs text-slate-500">{it.note}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[#0b1022]/80 p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Domain intelligence</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Sample data</p>
          </div>
          <div className="space-y-4">
            {[
              { d: "example.com", n: 18, s: 11, pct: 61 },
              { d: "blog.example.net", n: 9, s: 6, pct: 67 },
              { d: "news.example.org", n: 7, s: 3, pct: 43 },
            ].map((row) => (
              <div key={row.d} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-200">{row.d}</span>
                  <span className="text-slate-500">
                    {row.s} / {row.n} indexed
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${row.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* Experiments                                                         */
/* ------------------------------------------------------------------ */

const EXPERIMENTS = [
  { name: "Hub", note: "Crawlable hub page only" },
  { name: "Hub + WebSub", note: "Hub plus WebSub hub ping" },
  { name: "Hub + Feed Refresh", note: "Hub plus refreshed feeds" },
  { name: "All Legitimate Signals", note: "Hub, feeds, and WebSub together" },
];

function Experiments() {
  return (
    <SectionShell id="experiments" className="py-24">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Experiments</p>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Measure before you claim
        </h2>
        <p className="mt-4 text-base leading-7 text-slate-400">
          Compare discovery strategies using real evidence. No experiment is called a winner unless
          the data supports it.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {EXPERIMENTS.map((e) => (
          <div key={e.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center transition hover:border-indigo-400/40">
            <FlaskConical className="mx-auto mb-3 h-6 w-6 text-indigo-300" />
            <h3 className="text-sm font-semibold text-white">{e.name}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-500">{e.note}</p>
            <div className="mt-4">
              <Pill tone="neutral">INCONCLUSIVE</Pill>
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* Security                                                            */
/* ------------------------------------------------------------------ */

const SECURITY = [
  { icon: <ShieldCheck className="h-5 w-5" />, title: "SSRF protection", text: "Every outbound fetch is guarded — never localhost, private, link-local, or cloud metadata addresses." },
  { icon: <Lock className="h-5 w-5" />, title: "Private IP blocking", text: "Private and loopback ranges are blocked before any request is made." },
  { icon: <RefreshCw className="h-5 w-5" />, title: "Redirect validation", text: "Redirects are followed hop-by-hop with each hop SSRF-checked." },
  { icon: <Layers className="h-5 w-5" />, title: "Tenant isolation", text: "Backlinks, jobs, and intelligence are scoped per tenant." },
  { icon: <Eye className="h-5 w-5" />, title: "No Googlebot spoofing", text: "Our crawler uses its own user-agent. Googlebot evidence is never faked." },
];

function SecuritySection() {
  return (
    <SectionShell className="py-24">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <div className="grid gap-4 sm:grid-cols-2">
            {SECURITY.map((s) => (
              <div key={s.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/10 text-emerald-300">
                  {s.icon}
                </div>
                <h3 className="text-sm font-semibold text-white">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-5 text-slate-400">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">Security</p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Guardrails built into every request
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-400">
            The engine treats every outbound fetch as untrusted. SSRF guards, redirect validation,
            and tenant scoping are enforced in the pipeline — not bolted on later.
          </p>
        </div>
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

const FAQS = [
  { q: "Does this guarantee Google indexing?", a: "No. No platform can guarantee indexing. We optimize discovery signals and monitor evidence; Google decides what gets indexed." },
  { q: "Is this the Google Indexing API?", a: "No. This platform does not call the Google Indexing API and does not submit third-party URLs to owner-only Google APIs." },
  { q: "Can I monitor backlinks?", a: "Yes. Submit backlinks and track validation, quality, discovery, crawl, and verification status from one dashboard." },
  { q: "Can I verify indexing?", a: "Yes — when reliable evidence is available. INDEXED is only ever set from real verification evidence; UNKNOWN stays UNKNOWN." },
  { q: "Does the platform create backlinks?", a: "No. The platform never creates backlinks, link farms, or spam. It only publishes legitimate discovery signals for URLs you submit." },
  { q: "Does the platform spoof Googlebot?", a: "No. The engine crawls with its own user-agent and never impersonates Googlebot." },
];

function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <SectionShell id="faq" className="py-24">
      <div className="mx-auto mb-14 max-w-2xl text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-400">FAQ</p>
        <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">Honest answers</h2>
      </div>
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQS.map((f, i) => (
          <div key={f.q} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            <button
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              onClick={() => setOpenIdx(openIdx === i ? null : i)}
              aria-expanded={openIdx === i}
            >
              <span className="text-sm font-semibold text-white">{f.q}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${openIdx === i ? "rotate-180" : ""}`} />
            </button>
            {openIdx === i ? <p className="border-t border-white/10 px-5 py-4 text-sm leading-7 text-slate-400">{f.a}</p> : null}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA + footer                                                  */
/* ------------------------------------------------------------------ */

function FinalCta() {
  return (
    <SectionShell className="pb-24">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/20 via-[#0b1022] to-violet-600/20 px-6 py-16 text-center sm:px-16">
        <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-[240px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/25 blur-[100px]" />
        <h2 className="mx-auto max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Know What Happens To Your Backlinks.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-300">
          From validation to discovery signals to verification evidence — see the full journey.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-600 px-7 text-base font-semibold text-white shadow-[0_12px_36px_-10px_rgba(99,102,241,0.8)] transition hover:brightness-110"
          >
            Start Monitoring
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#product"
            className="inline-flex h-12 items-center rounded-lg border border-white/15 bg-white/[0.04] px-7 text-base font-semibold text-white transition hover:border-white/30"
          >
            View Engine
          </a>
        </div>
      </div>
    </SectionShell>
  );
}

function Footer() {
  const cols = [
    {
      title: "Product",
      links: [
        { href: "#features", label: "Features" },
        { href: "/dashboard", label: "Dashboard" },
        { href: "#experiments", label: "Experiments" },
        { href: "/discover", label: "Documentation" },
        { href: "/api", label: "API" },
      ],
    },
    {
      title: "Legal",
      links: [
        { href: "#", label: "Privacy" },
        { href: "#", label: "Terms" },
      ],
    },
  ];
  return (
    <footer className="border-t border-white/10 bg-[#05060f]">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-6 text-slate-500">
              Free backlink indexing optimization platform. Legitimate discovery signals,
              evidence-based monitoring.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className="text-sm text-slate-400 transition hover:text-white">
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 border-t border-white/10 pt-6">
          <p className="text-xs leading-6 text-slate-600">
            Indexing decisions are controlled by search engines. This platform provides discovery
            optimization and evidence-based monitoring. No indexing outcome is ever guaranteed.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function LandingPage() {
  return (
    <div className="dark min-h-screen bg-[#060714] text-foreground antialiased">
      <Header />
      <main>
        <Hero />
        <TrustStrip />
        <Features />
        <HowItWorks />
        <EngineSection />
        <Intelligence />
        <Experiments />
        <SecuritySection />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { StatusBadge } from "@/components/StatusBadge";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

type BacklinkItem = {
  id: string;
  url: string;
  title: string;
  platform: string;
  status: string;
  indexed_status: string;
  date_added: string;
};

export default function HomePage() {
  const [projectName, setProjectName] = useState("Agency Launch");
  const [campaignName, setCampaignName] = useState("Summer Outreach");
  const [urls, setUrls] = useState("https://example.com/one\nhttps://example.com/two");
  const [notes, setNotes] = useState("New campaign for discovery acceleration.");
  const [summary, setSummary] = useState<{ projects: number; campaigns: number; urls: number; queued: number } | null>(null);
  const [recentBacklinks, setRecentBacklinks] = useState<BacklinkItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function loadBacklinks() {
    try {
      const res = await fetch(`${API_BASE}/api/backlinks?page=1&page_size=5`);
      if (res.ok) {
        const data = await res.json();
        setRecentBacklinks(data.items || []);
      }
      const summaryRes = await fetch(`${API_BASE}/api/discovery/summary`);
      if (summaryRes.ok) {
        setSummary(await summaryRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  }

  useEffect(() => {
    void loadBacklinks();
  }, []);

  const stats = useMemo(() => {
    return [
      { label: "Projects", value: summary?.projects ?? 0 },
      { label: "Campaigns", value: summary?.campaigns ?? 0 },
      { label: "URLs", value: summary?.urls ?? 0 },
      { label: "Queued", value: summary?.queued ?? 0 },
    ];
  }, [summary]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/discovery/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_name: projectName,
          campaign_name: campaignName,
          urls: urls.split(/\n+/).filter(Boolean),
          notes,
        }),
      });
      if (!response.ok) throw new Error("Submission failed");
      await loadBacklinks();
      setSubmitted(true);
    } catch (error) {
      console.error(error);
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <section className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-12 lg:flex-row lg:px-10 lg:py-16">
        <div className="max-w-2xl flex-1">
          <p className="mb-4 inline-flex rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--moss)]">
            Discovery Accelerator
          </p>
          <h1 className="font-display text-4xl font-semibold tracking-tight text-[var(--moss-deep)] sm:text-5xl">
            Accelerate backlink discovery with transparent signals.
          </h1>
          <p className="mt-5 text-lg leading-8 text-[var(--muted)]">
            Upload backlinks, validate them, and monitor every discovery step in one professional platform designed for agencies, SaaS teams, and enterprise SEO operations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#launch" className="rounded-lg bg-[var(--moss)] px-5 py-3 font-semibold text-white transition hover:bg-[var(--moss-deep)]">
              Start free
            </a>
            <a href="/featured" className="rounded-lg border border-[var(--line)] bg-white/70 px-5 py-3 font-semibold text-[var(--ink)] transition hover:border-[var(--moss)]">
              Public discovery hub
            </a>
            <a href="/discover" className="rounded-lg border border-[var(--line)] bg-white/70 px-5 py-3 font-semibold text-[var(--ink)] transition hover:border-[var(--moss)]">
              Public URL index
            </a>
            <a href="/internal/backlinks" className="rounded-lg border border-[var(--line)] bg-white/70 px-5 py-3 font-semibold text-[var(--ink)] transition hover:border-[var(--moss)]">
              Manage Backlinks Dashboard
            </a>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-2xl border border-[var(--line)] bg-white/70 p-4 shadow-sm">
                <p className="text-sm text-[var(--muted)]">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--moss-deep)]">{stat.value}</p>
              </div>
            ))}
          </div>

          {recentBacklinks.length > 0 && (
            <div className="mt-8 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-lg text-[var(--ink)] mb-3">Recent Discovery Backlinks</h3>
              <div className="space-y-3">
                {recentBacklinks.map((item) => (
                  <div key={item.id} className="flex items-center justify-between border-b border-[var(--line)] pb-2 text-sm">
                    <div className="truncate max-w-xs md:max-w-md">
                      <p className="font-medium text-[var(--moss-deep)] truncate">{item.title || item.url}</p>
                      <p className="text-xs text-[var(--muted)] truncate">{item.url}</p>
                    </div>
                    <div>
                      <StatusBadge status={item.status || item.indexed_status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <form id="launch" onSubmit={handleSubmit} className="flex-1 rounded-3xl border border-[var(--line)] bg-white p-6 shadow-[0_24px_80px_rgba(20,82,57,0.08)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--moss)]">Launch workspace</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--ink)]">Create a project and campaign</h2>
            </div>
            <span className="rounded-full border border-[var(--line)] px-3 py-1 text-sm text-[var(--muted)]">
              {submitted ? "Submitted" : "Ready"}
            </span>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-[var(--ink)]">
              Project name
              <input value={projectName} onChange={(e) => setProjectName(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none ring-0" />
            </label>
            <label className="block text-sm font-medium text-[var(--ink)]">
              Campaign name
              <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none ring-0" />
            </label>
            <label className="block text-sm font-medium text-[var(--ink)]">
              Backlinks
              <textarea value={urls} onChange={(e) => setUrls(e.target.value)} rows={6} className="mt-2 min-h-36 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none ring-0" />
            </label>
            <label className="block text-sm font-medium text-[var(--ink)]">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-2 w-full rounded-xl border border-[var(--line)] bg-[var(--paper)] px-3 py-2 outline-none ring-0" />
            </label>
          </div>

          <button type="submit" disabled={loading} className="mt-6 w-full rounded-xl bg-[var(--moss)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--moss-deep)] disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? "Submitting..." : "Submit discovery queue"}
          </button>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            This flow is intentionally transparent: it logs the project, campaign, and every submitted URL without promising indexing.
          </p>
        </form>
      </section>

      <section id="features" className="mx-auto max-w-7xl px-6 pb-16 lg:px-10">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: "Validation-first",
              text: "Every URL is checked for structure, crawlability, and basic health before it enters the workflow.",
            },
            {
              title: "Lifecycle visibility",
              text: "Track discovery progress, status changes, and recommendations in a single place.",
            },
            {
              title: "Enterprise reporting",
              text: "Turn discovery activity into reporting, analytics, and executive-ready summaries.",
            },
          ].map((feature) => (
            <div key={feature.title} className="rounded-2xl border border-[var(--line)] bg-white/70 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-[var(--ink)]">{feature.title}</h3>
              <p className="mt-3 leading-7 text-[var(--muted)]">{feature.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

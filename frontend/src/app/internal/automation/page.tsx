"use client";

import { useCallback, useEffect, useState } from "react";

type Overview = {
  total_workflows: number;
  enabled_workflows: number;
  running_jobs: number;
  queued_jobs: number;
  failed_jobs: number;
  scheduled_jobs: number;
  success_rate: number;
  avg_duration_ms: number;
  retry_success_rate: number;
  open_failures: number;
};

const NAV = [
  ["/internal/automation", "Overview"],
  ["/internal/automation-workflows", "Workflows"],
  ["/internal/automation-runs", "Running Jobs"],
  ["/internal/automation-schedules", "Schedules"],
  ["/internal/automation-retries", "Retries"],
  ["/internal/automation-failures", "Failures"],
  ["/internal/automation-timeline", "Timeline"],
  ["/internal/automation-metrics", "Metrics"],
] as const;

export default function AutomationOverviewPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/automation/overview");
      if (res.ok) setOverview(await res.json());
      else setError("Failed to load automation overview");
    } catch {
      setError("Failed to load automation overview");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function runNow() {
    setBusy(true);
    try {
      await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "dashboard" }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!overview && !error) return <div className="p-6 text-gray-500">Loading automation…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!overview) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Automation Overview</h1>
          <p className="text-sm text-gray-600">
            Orchestrates validation → crawl → signals → feeds → WebSub → IndexNow → search intelligence → analytics.
            Does not guarantee indexing.
          </p>
        </div>
        <button
          onClick={runNow}
          disabled={busy}
          className="border px-4 py-2 text-sm bg-black text-white disabled:opacity-50"
        >
          {busy ? "Running…" : "Run workflow now"}
        </button>
      </div>
      <nav className="flex flex-wrap gap-2 text-sm">
        {NAV.map(([href, label]) => (
          <a key={href} href={href} className="border px-3 py-1.5">
            {label}
          </a>
        ))}
      </nav>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card label="Workflows" value={overview.total_workflows} />
        <Card label="Enabled" value={overview.enabled_workflows} />
        <Card label="Running" value={overview.running_jobs} />
        <Card label="Queued" value={overview.queued_jobs} />
        <Card label="Failed" value={overview.failed_jobs} />
        <Card label="Scheduled" value={overview.scheduled_jobs} />
        <Card label="Success rate" value={`${overview.success_rate.toFixed(1)}%`} />
        <Card label="Avg duration" value={`${Math.round(overview.avg_duration_ms)} ms`} />
        <Card label="Retry success" value={`${overview.retry_success_rate.toFixed(1)}%`} />
        <Card label="Open failures" value={overview.open_failures} />
      </div>
      <section>
        <h2 className="font-semibold mb-2">Execution graph (pipeline stages)</h2>
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            "Detect",
            "Validate",
            "Crawl",
            "Signals",
            "Feeds",
            "WebSub",
            "IndexNow",
            "Search Intel",
            "Analytics",
            "Complete",
          ].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span className="border px-2 py-1 bg-white">{s}</span>
              {i < 9 ? <span className="text-gray-400">→</span> : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white border p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

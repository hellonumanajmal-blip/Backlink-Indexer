"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type GroupRow = {
  label: string;
  eligible: number;
  indexed: number;
  not_indexed: number;
  unknown: number;
  crawl_evidence: number;
  median_time_to_index_days: number | null;
  average_time_to_index_days: number | null;
  verified_index_rate: number | null;
  sample_status: string;
};

type ExperimentReport = {
  totals: {
    submitted_in_study: number;
    eligible: number;
    baseline_already_indexed_excluded: number;
    verified_indexed: number;
    unknown: number;
    not_indexed: number;
  };
  groups: Record<string, GroupRow>;
  funnel: {
    discovery_signal_accepted: number;
    target_url_discovered: number;
    target_url_crawled: number;
    target_url_indexed: number;
    note: string;
  };
  cumulative_verified_index_rate: Array<{
    day: number;
    indexed: number;
    eligible: number;
    verified_index_rate: number | null;
  }>;
  verdict: {
    answer: string;
    question: string;
    reason: string;
    min_n: number;
    preferred_n: number;
  };
  disclaimer: string;
};

function pct(rate: number | null, n: number) {
  if (rate == null || n <= 0) return "n/a";
  return `${(rate * 100).toFixed(1)}%`;
}

export default function ExperimentPage() {
  const [report, setReport] = useState<ExperimentReport | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [urls, setUrls] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/indexing/engine/experiment", { credentials: "include" });
      if (res.status === 401) {
        setError("Sign in required");
        return;
      }
      if (!res.ok) throw new Error("Failed to load experiment");
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onEnroll(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const list = urls
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const res = await fetch("/api/indexing/engine/experiment/enroll", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: list, target_url: targetUrl.trim(), run: true }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(JSON.stringify(body.detail || body));
      return;
    }
    const body = await res.json();
    setMessage(`Enrolled ${body.created} new URL(s), reused ${body.reused}.`);
    await load();
  }

  async function downloadJson() {
    const res = await fetch("/api/indexing/engine/experiment/export.json", { credentials: "include" });
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "indexing-experiment.json";
    a.click();
  }

  async function downloadCsv() {
    const res = await fetch("/api/indexing/engine/experiment/export.json", { credentials: "include" });
    const data = await res.json();
    const items: Array<Record<string, unknown>> = data.items || [];
    const keys = [
      "url",
      "domain",
      "experiment_group",
      "quality_score",
      "priority",
      "backlink_type",
      "discovery_channels",
      "discovery_accepted",
      "crawl_evidence",
      "verification_result",
      "indexed_at",
      "time_to_index_seconds",
      "attempts",
      "final_status",
    ];
    const lines = [
      keys.join(","),
      ...items.map((row) =>
        keys.map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`).join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "indexing-experiment.csv";
    a.click();
  }

  const groups = report?.groups || {};

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white px-4 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="font-semibold">Indexing experiment</h1>
          <a href="/internal/backlinks" className="text-sm text-[var(--moss-deep)]">
            ← Backlinks
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <p className="text-sm text-[var(--muted)]">
          Measures whether owned discovery signals change verified Google indexing vs a no-signal
          control. This is not a Google Indexing API. Rates stay blank until verification evidence
          exists. Do not enroll URLs you created as spam or link farms.
        </p>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {message ? <p className="text-sm">{message}</p> : null}

        <form onSubmit={onEnroll} className="space-y-3 border border-[var(--line)] bg-white p-4">
          <p className="font-semibold">Enroll existing third-party URLs</p>
          <p className="text-xs text-[var(--muted)]">
            One source URL per line. Each page must already contain a real backlink to the target.
            Group assignment is hash(url) % 4 and never shuffled by hand.
          </p>
          <label className="block text-sm">
            Target URL (your site)
            <input
              className="mt-1 w-full border border-[var(--line)] px-3 py-2"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Source URLs
            <textarea
              className="mt-1 h-32 w-full border border-[var(--line)] px-3 py-2 font-mono text-sm"
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="border border-[var(--moss)] px-3 py-2 text-sm">
            Enroll (max 40)
          </button>
        </form>

        {loading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

        {report ? (
          <>
            <section className="border border-[var(--line)] bg-white p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Verdict</p>
              <p className="mt-2 text-2xl font-semibold">{report.verdict.answer}</p>
              <p className="mt-2 text-sm">{report.verdict.question}</p>
              <p className="mt-2 text-sm text-[var(--muted)]">{report.verdict.reason}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Minimum n={report.verdict.min_n} per group (preferred {report.verdict.preferred_n}).
              </p>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-[var(--line)] bg-white p-3">
                <p className="text-xs text-[var(--muted)]">Eligible URLs</p>
                <p className="mt-1 text-2xl font-semibold">{report.totals.eligible}</p>
              </div>
              <div className="border border-[var(--line)] bg-white p-3">
                <p className="text-xs text-[var(--muted)]">Verified indexed</p>
                <p className="mt-1 text-2xl font-semibold">{report.totals.verified_indexed}</p>
              </div>
              <div className="border border-[var(--line)] bg-white p-3">
                <p className="text-xs text-[var(--muted)]">Unknown</p>
                <p className="mt-1 text-2xl font-semibold">{report.totals.unknown}</p>
              </div>
              <div className="border border-[var(--line)] bg-white p-3">
                <p className="text-xs text-[var(--muted)]">Baseline indexed excluded</p>
                <p className="mt-1 text-2xl font-semibold">
                  {report.totals.baseline_already_indexed_excluded}
                </p>
              </div>
            </section>

            <section className="border border-[var(--line)] bg-white p-4">
              <p className="font-semibold">Groups (real counts only)</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                    <tr>
                      <th className="py-2 pr-2">Group</th>
                      <th className="py-2 pr-2">Eligible</th>
                      <th className="py-2 pr-2">Indexed</th>
                      <th className="py-2 pr-2">Not indexed</th>
                      <th className="py-2 pr-2">Unknown</th>
                      <th className="py-2 pr-2">Crawl evidence</th>
                      <th className="py-2 pr-2">Median days</th>
                      <th className="py-2 pr-2">Average days</th>
                      <th className="py-2 pr-2">Sample</th>
                    </tr>
                  </thead>
                  <tbody>
                    {["A", "B", "C", "D"].map((key) => {
                      const row = groups[key];
                      if (!row) return null;
                      return (
                        <tr key={key} className="border-b border-[var(--line)]">
                          <td className="py-2 pr-2">
                            {key}: {row.label}
                          </td>
                          <td className="py-2 pr-2">{row.eligible}</td>
                          <td className="py-2 pr-2">{row.indexed}</td>
                          <td className="py-2 pr-2">{row.not_indexed}</td>
                          <td className="py-2 pr-2">{row.unknown}</td>
                          <td className="py-2 pr-2">{row.crawl_evidence}</td>
                          <td className="py-2 pr-2">{row.median_time_to_index_days ?? "n/a"}</td>
                          <td className="py-2 pr-2">{row.average_time_to_index_days ?? "n/a"}</td>
                          <td className="py-2 pr-2">{row.sample_status}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="border border-[var(--line)] bg-white p-4">
              <p className="font-semibold">Funnel (do not merge these layers)</p>
              <ul className="mt-3 space-y-1 text-sm">
                <li>Discovery signal accepted: {report.funnel.discovery_signal_accepted}</li>
                <li>Target URL discovered: {report.funnel.target_url_discovered}</li>
                <li>Target URL crawled: {report.funnel.target_url_crawled}</li>
                <li>Target URL indexed: {report.funnel.target_url_indexed}</li>
              </ul>
              <p className="mt-2 text-xs text-[var(--muted)]">{report.funnel.note}</p>
            </section>

            <section className="border border-[var(--line)] bg-white p-4">
              <p className="font-semibold">Cumulative verified index rate</p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Indexed / eligible by day since experiment start. 0% with n=0 is not a success rate.
              </p>
              <ul className="mt-4 space-y-2">
                {report.cumulative_verified_index_rate.map((row) => (
                  <li key={row.day} className="text-sm">
                    <div className="flex justify-between">
                      <span>Day {row.day}</span>
                      <span>
                        {row.indexed}/{row.eligible} · {pct(row.verified_index_rate, row.eligible)}
                      </span>
                    </div>
                    <div className="mt-1 h-2 bg-[var(--line)]">
                      <div
                        className="h-2 bg-[var(--moss)]"
                        style={{
                          width: `${Math.min(100, (row.verified_index_rate || 0) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-xs text-[var(--muted)]">{report.disclaimer}</p>
            <div className="flex gap-2">
              <button type="button" className="border border-[var(--line)] px-3 py-2 text-sm" onClick={() => void downloadJson()}>
                Export JSON
              </button>
              <button type="button" className="border border-[var(--line)] px-3 py-2 text-sm" onClick={() => void downloadCsv()}>
                Export CSV
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}

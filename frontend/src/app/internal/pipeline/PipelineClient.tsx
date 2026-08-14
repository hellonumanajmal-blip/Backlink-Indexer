"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Job = {
  id: string;
  trigger: string;
  status: string;
  backlink_id: string | null;
  duration_ms: number | null;
  retry_count: number;
  failed_stages: string[];
  stages: Array<{ stage: string; ok: boolean; duration_ms: number }>;
  created_at: string | null;
  error_message: string | null;
  disclaimer: string;
};

type Stats = {
  total: number;
  by_status: Record<string, number>;
  avg_duration_ms: number | null;
  recent_failures: number;
  feed_ok_rate: number | null;
  disclaimer: string;
};

export default function PipelineClient() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setError("");
    const me = await fetch("/api/auth/me", { credentials: "include" });
    if (me.status === 401) {
      router.push("/internal/login");
      return;
    }
    const q = filter ? `?status=${encodeURIComponent(filter)}` : "";
    const [j, s] = await Promise.all([
      fetch(`/api/pipeline/jobs${q}`, { credentials: "include" }),
      fetch("/api/pipeline/stats", { credentials: "include" }),
    ]);
    if (!j.ok || !s.ok) {
      setError("Failed to load pipeline data");
      return;
    }
    const jd = await j.json();
    setJobs(jd.items || []);
    setStats(await s.json());
  }, [filter, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runNow() {
    const res = await fetch("/api/pipeline/run", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trigger: "manual-ui" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError("Failed to queue pipeline");
      return;
    }
    setMessage(`Queued task ${data.task_id || "eager"}`);
    setTimeout(() => void load(), 1000);
  }

  async function retry(id: string) {
    const res = await fetch(`/api/pipeline/retry/${id}`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) {
      setError("Retry failed");
      return;
    }
    setMessage(`Retry queued for ${id}`);
    setTimeout(() => void load(), 1000);
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/80">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--moss-deep)]">PintDown</p>
            <p className="text-sm text-[var(--muted)]">Discovery Pipeline</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/internal/backlinks" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Backlinks
            </a>
            <a href="/internal/analytics" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Analytics
            </a>
            <button
              type="button"
              onClick={() => void runNow()}
              className="bg-[var(--moss)] px-3 py-1.5 text-sm font-semibold text-white"
            >
              Run pipeline
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <aside className="border border-[var(--alert)]/30 bg-[#fff7f0] px-4 py-3 text-sm text-[var(--alert)]">
          Pipeline jobs generate feeds, sitemaps, WebSub pings, and IndexNow notifications for{" "}
          <strong>owned</strong> URLs only. They do not guarantee Google indexing.
        </aside>

        {error ? <p className="text-sm text-[var(--alert)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--moss-deep)]">{message}</p> : null}

        {stats ? (
          <section className="grid gap-3 sm:grid-cols-4">
            <div className="border border-[var(--line)] bg-white p-4">
              <p className="text-sm text-[var(--muted)]">Total jobs</p>
              <p className="text-2xl font-semibold">{stats.total}</p>
            </div>
            <div className="border border-[var(--line)] bg-white p-4">
              <p className="text-sm text-[var(--muted)]">Avg duration</p>
              <p className="text-2xl font-semibold">
                {stats.avg_duration_ms != null ? `${Math.round(stats.avg_duration_ms)} ms` : "—"}
              </p>
            </div>
            <div className="border border-[var(--line)] bg-white p-4">
              <p className="text-sm text-[var(--muted)]">Failures / partial</p>
              <p className="text-2xl font-semibold">{stats.recent_failures}</p>
            </div>
            <div className="border border-[var(--line)] bg-white p-4">
              <p className="text-sm text-[var(--muted)]">Feed OK rate</p>
              <p className="text-2xl font-semibold">
                {stats.feed_ok_rate != null ? `${Math.round(stats.feed_ok_rate * 100)}%` : "—"}
              </p>
            </div>
            <div className="border border-[var(--line)] bg-white p-4 sm:col-span-4">
              <p className="text-sm text-[var(--muted)]">By status</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {Object.entries(stats.by_status).map(([k, v]) => (
                  <span key={k} className="border border-[var(--line)] px-2 py-1">
                    {k}: {v}
                  </span>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="border border-[var(--line)] bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Jobs</h2>
            <select
              className="border border-[var(--line)] px-2 py-1 text-sm"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">All</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="partial">partial</option>
              <option value="failed">failed</option>
              <option value="queued">queued</option>
            </select>
            <button type="button" className="border border-[var(--line)] px-2 py-1 text-sm" onClick={() => void load()}>
              Refresh
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-2">When</th>
                  <th className="py-2 pr-2">Status</th>
                  <th className="py-2 pr-2">Trigger</th>
                  <th className="py-2 pr-2">Duration</th>
                  <th className="py-2 pr-2">Stages</th>
                  <th className="py-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-[var(--muted)]">
                      No pipeline jobs yet.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job) => (
                    <tr key={job.id} className="border-b border-[var(--line)] align-top">
                      <td className="py-3 pr-2">
                        {job.created_at ? new Date(job.created_at).toLocaleString() : "—"}
                        <div className="text-xs text-[var(--muted)]">{job.id.slice(0, 8)}…</div>
                      </td>
                      <td className="py-3 pr-2">{job.status}</td>
                      <td className="py-3 pr-2">{job.trigger}</td>
                      <td className="py-3 pr-2">{job.duration_ms != null ? `${job.duration_ms} ms` : "—"}</td>
                      <td className="py-3 pr-2">
                        <div className="flex flex-wrap gap-1">
                          {(job.stages || []).map((s) => (
                            <span
                              key={s.stage}
                              className="border border-[var(--line)] px-1.5 py-0.5 text-xs"
                              title={`${s.duration_ms}ms`}
                            >
                              {s.ok ? "✓" : "✗"} {s.stage}
                            </span>
                          ))}
                        </div>
                        {job.failed_stages?.length ? (
                          <p className="mt-1 text-xs text-[var(--alert)]">
                            Failed: {job.failed_stages.join(", ")}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3 pr-2">
                        {(job.status === "failed" || job.status === "partial") && (
                          <button
                            type="button"
                            className="border border-[var(--line)] px-2 py-1 text-xs"
                            onClick={() => void retry(job.id)}
                          >
                            Retry
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {stats ? <p className="mt-3 text-xs text-[var(--muted)]">{stats.disclaimer}</p> : null}
        </section>
      </div>
    </main>
  );
}

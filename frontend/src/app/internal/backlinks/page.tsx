"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PropertyBadge, StatusBadge, VisibilityBadge } from "@/components/StatusBadge";

type Backlink = {
  id: string;
  url: string;
  title: string;
  description: string;
  platform: string;
  domain: string;
  country: string | null;
  language: string | null;
  anchor_text: string | null;
  rel_type: string;
  status: string;
  index_status?: string;
  indexed_status: string;
  dispatch_status: string;
  dispatch_method: string | null;
  authority_score: number | null;
  notes: string | null;
  date_added: string;
  status_history?: Array<{
    id: string;
    old_status: string | null;
    new_status: string;
    changed_at: string;
    note: string | null;
  }>;
};

type EngineMetrics = {
  urls_submitted: number;
  urls_successfully_discovered: number;
  discovery_success_rate: number;
  urls_verified_indexed: number;
  urls_still_unknown: number;
  urls_verified_not_indexed: number;
  average_attempts: number;
  verified_index_rate: number;
  verified_index_rate_note: string;
  engine_class: string[];
  average_indexing_days?: number | null;
  best_performing_domains?: Array<{
    domain: string;
    submitted: number;
    verified_indexed: number;
    success_rate?: number | null;
    average_days?: number | null;
  }>;
  insights?: string[];
};

type EngineDashboard = {
  total: number;
  validated: number;
  invalid: number;
  backlinks_found: number;
  backlinks_missing: number;
  discovery_submitted: number;
  waiting_for_crawl: number;
  crawled: number;
  indexed: number;
  not_indexed: number;
  retrying: number;
  failed: number;
  engine: string;
  disclaimer: string;
  max_discovery_mode?: boolean;
};

type EngineJob = {
  id: string;
  source_url: string;
  target_url: string | null;
  property_type: string;
  pipeline_status: string;
  visibility_status: string;
  http_status: number | null;
  crawlability_score: number | null;
  crawlability_band: string | null;
  backlink_found: boolean | null;
  discovery_status: string | null;
  discovery_stage?: string | null;
  discovery_quality?: number | null;
  channel_snapshot?: Record<string, {
    status?: string;
    accepted?: boolean;
    evidence?: string;
    signal_quality?: number;
  }>;
  verification_status: string | null;
  attempt_count: number;
  last_checked_at: string | null;
  next_retry_at: string | null;
  googlebot_visited: boolean;
  our_crawler_visited: boolean;
  quality_score?: number | null;
  quality_recommendation?: string | null;
  priority_band?: string | null;
  workflow_stage?: string | null;
  public_listed?: boolean;
  final_status?: string | null;
  max_discovery?: boolean;
  canonical_status?: string | null;
};

type EngineDetail = {
  job: EngineJob;
  timeline: Array<{ id: string; to_status: string; note: string | null; created_at: string }>;
  disclaimer: string;
  discovery?: Array<Record<string, unknown>>;
  crawl_evidence?: Array<Record<string, unknown>>;
  channel_cards?: Record<string, { status?: string; accepted?: boolean; evidence?: string }>;
};

type Analytics = {
  total: number;
  by_status: Record<string, number>;
  by_platform: Record<string, number>;
  avg_time_to_indexed_hours: number | null;
  indexed_sample_size: number;
  enough_data_for_charts: boolean;
  recent: Array<{
    id: string;
    url: string;
    title: string;
    platform: string;
    indexed_status: string;
    date_added: string | null;
  }>;
  disclaimer: string;
};

const STATUSES = [
  "pending",
  "pinged",
  "indexed",
  "not_indexed",
];

function channelMark(
  job: EngineJob,
  name: string,
  listedFallback = false,
): string {
  const card = job.channel_snapshot?.[name];
  if (card?.accepted) return "✓";
  const status = (card?.status || "").toUpperCase();
  if (status.includes("NOT_AVAILABLE") || status === "SKIPPED" || status === "N/A") return "N/A";
  if (listedFallback && job.public_listed) return "✓";
  return card?.status || "—";
}

const emptyForm = {
  url: "",
  target_url: "",
  title: "",
  description: "",
  platform: "directory",
  country: "",
  language: "",
  anchor_text: "",
  rel_type: "dofollow",
  indexed_status: "pending",
  authority_score: "",
  notes: "",
};

export default function BacklinksDashboard() {
  const router = useRouter();
  const [items, setItems] = useState<Backlink[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [platform, setPlatform] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [bulk, setBulk] = useState("");
  const [bulkPlatform, setBulkPlatform] = useState("directory");
  const [selected, setSelected] = useState<Backlink | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [engineDash, setEngineDash] = useState<EngineDashboard | null>(null);
  const [engineMetrics, setEngineMetrics] = useState<EngineMetrics | null>(null);
  const [engineJobs, setEngineJobs] = useState<EngineJob[]>([]);
  const [engineDetail, setEngineDetail] = useState<EngineDetail | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [repingId, setRepingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), page_size: "25" });
      if (q) params.set("q", q);
      if (platform) params.set("platform", platform);
      if (status) params.set("indexed_status", status);
      const res = await fetch(`/api/backlinks?${params}`, { credentials: "include" });
      if (res.status === 401) {
        router.push("/internal/login");
        return;
      }
      if (!res.ok) throw new Error("Failed to load backlinks");
      const data = await res.json();
      setItems(data.items || []);
      setTotal(data.total || 0);

      const a = await fetch("/api/analytics", { credentials: "include" });
      if (a.ok) setAnalytics(await a.json());
      const dash = await fetch("/api/indexing/engine/dashboard", { credentials: "include" });
      if (dash.ok) setEngineDash(await dash.json());
      const jobs = await fetch("/api/indexing/engine/jobs?limit=50", { credentials: "include" });
      if (jobs.ok) {
        const payload = await jobs.json();
        setEngineJobs(payload.items || []);
      }
      const metrics = await fetch("/api/indexing/engine/metrics", { credentials: "include" });
      if (metrics.ok) setEngineMetrics(await metrics.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [page, platform, q, router, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = useMemo(() => Math.max(1, Math.ceil(total / 25)), [total]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    const payload: Record<string, unknown> = {
      url: form.url.trim(),
      title: form.title,
      description: form.description,
      platform: form.platform,
      country: form.country || null,
      language: form.language || null,
      anchor_text: form.anchor_text || null,
      rel_type: form.rel_type,
      status: form.indexed_status,
      indexed_status: form.indexed_status,
      notes: form.notes || null,
    };
    if (form.authority_score !== "") {
      payload.authority_score = Number(form.authority_score);
    }
    const res = await fetch("/api/backlinks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.detail ? JSON.stringify(err.detail) : "Create failed");
      return;
    }
    await fetch("/api/indexing/engine/jobs", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source_url: form.url.trim(),
        target_url: form.target_url.trim() || null,
        project: form.platform || "default",
        run: true,
      }),
    });
    setForm(emptyForm);
    setMessage("Backlink added. Free indexing engine started (discovery + verification, not a Google index claim).");
    await load();
  }

  async function onBulk(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/backlinks/bulk-import", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ urls: bulk, platform: bulkPlatform }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError("Bulk import failed");
      return;
    }
    setBulk("");
    setMessage(`Bulk import: ${data.created || 0} created in FastAPI backend, ${data.skipped || 0} skipped.`);
    await load();
  }

  async function onCsv(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const input = formEl.elements.namedItem("csv") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/backlinks/import-csv", {
      method: "POST",
      credentials: "include",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.detail === "string" ? data.detail : "CSV import failed");
      return;
    }
    const errs: string[] = Array.isArray(data.errors) ? data.errors : [];
    let msg = `CSV import: ${data.created || 0} created, ${data.skipped || 0} skipped`;
    if (errs.length) {
      const preview = errs.slice(0, 3).join("; ");
      msg += `, ${errs.length} error${errs.length > 1 ? "s" : ""}: ${preview}${errs.length > 3 ? " …" : ""}`;
    }
    setMessage(msg);
    formEl.reset();
    await load();
  }

  async function openDetail(id: string) {
    setError("");
    const res = await fetch(`/api/backlinks/${id}`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setSelected(data);
    } else {
      setError("Failed to fetch backlink detail");
    }
  }

  async function saveDetail(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const res = await fetch(`/api/backlinks/${selected.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: selected.title,
        description: selected.description,
        platform: selected.platform,
        country: selected.country,
        language: selected.language,
        anchor_text: selected.anchor_text,
        rel_type: selected.rel_type,
        status: selected.indexed_status || selected.status,
        indexed_status: selected.indexed_status || selected.status,
        authority_score: selected.authority_score,
        notes: selected.notes,
      }),
    });
    if (!res.ok) {
      setError("Update failed");
      return;
    }
    const updated = await res.json();
    setSelected(updated);
    setMessage("Backlink record updated in FastAPI backend.");
    await load();
  }

  async function softDelete(id: string) {
    if (!confirm("Delete this backlink?")) return;
    const res = await fetch(`/api/backlinks/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) {
      setError("Delete not supported or failed on backend");
      return;
    }
    setSelected(null);
    setMessage("Backlink deleted.");
    await load();
  }

  // The row already carries the URL, so the Google query is built here rather
  // than round-tripping to the API just to look the URL back up.
  function checkNow(targetUrl: string) {
    if (!targetUrl) return;
    const query = `https://www.google.com/search?q=site:${encodeURIComponent(targetUrl)}`;
    window.open(query, "_blank", "noopener,noreferrer");
  }

  async function reping(id: string) {
    setRepingId(id);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/backlinks/${id}/reping`, {
        method: "POST",
        credentials: "include",
      });
      const data: {
        url?: string;
        error?: string;
        result?: {
          success?: boolean;
          status?: string;
          summary?: string;
          dispatch_method?: string | null;
          error?: string;
        };
      } = await res.json().catch(() => ({}));
      const result = data.result;
      if (res.ok && (result?.success || result?.status === "submitted")) {
        setMessage(
          `Re-ping dispatched for URL: ${result?.summary || "Signal sent via free discovery channels."}`
        );
        await load();
      } else {
        const detail = result?.summary || result?.error || data.error || `HTTP ${res.status}`;
        setError(`Re-ping result: ${detail}`);
      }
    } catch {
      setError("Re-ping failed: network error.");
    } finally {
      setRepingId(null);
    }
  }

  async function syncAll() {
    const res = await fetch("/api/sync", { method: "POST", credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      setMessage(`Sync complete: ${data.synced_count} backlinks dispatched/synced.`);
      await load();
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/internal/login");
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--moss-deep)]">PintDown</p>
            <p className="text-sm text-[var(--muted)]">Discovery Accelerator (internal)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/internal/backlinks/engine-test" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Engine test
            </a>
            <a href="/internal/backlinks/experiment" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Indexing experiment
            </a>
            <a href="/featured" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              /featured
            </a>
            <a href="/internal/pipeline" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Pipeline
            </a>
            <a href="/internal/analytics" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Analytics
            </a>
            <a href="/internal/search-intelligence" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Search Intel
            </a>
            <a href="/internal/intelligence" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Intelligence
            </a>
            <a href="/internal/assistant" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Assistant
            </a>
            <a href="/internal/organisations" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Orgs
            </a>
            <a href="/internal/admin" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Admin
            </a>
            <a href="/api/indexing/engine/reports?format=csv" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Engine CSV
            </a>
            <a href="/api/indexing/engine/reports?format=json" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Engine JSON
            </a>
            <button type="button" onClick={() => void syncAll()} className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Sync now
            </button>
            <button type="button" onClick={() => void logout()} className="bg-[var(--ink)] px-3 py-1.5 text-sm text-white">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <aside className="border border-[var(--alert)]/30 bg-[#fff7f0] px-4 py-3 text-sm leading-relaxed text-[var(--alert)]">
          <strong>FREE INDEXING ENGINE:</strong> Google alone decides whether a page is indexed — no
          tool, free or paid, can force it. This engine maximises discovery + crawl probability +
          verification + retry. <em>INDEXED</em> is only shown after verification evidence.{" "}
          <code>OUR_CRAWLER_VISITED ≠ GOOGLEBOT_VISITED</code>. <code>DISCOVERED ≠ CRAWLED ≠ INDEXED</code>.{" "}
          HTTP 200 is not indexed. IndexNow is owner-only; third-party URLs get{" "}
          <code>INDEXNOW_NOT_AVAILABLE</code>. Manual “Check Now” (Google <code>site:</code> search)
          remains the honest operator check.
        </aside>

        {error ? <p className="text-sm text-[var(--alert)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--moss-deep)]">{message}</p> : null}

        {engineDash ? (
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="border border-[var(--line)] bg-white p-4 sm:col-span-2 lg:col-span-4">
              <p className="text-sm font-semibold">{engineDash.engine}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{engineDash.disclaimer}</p>
              {engineDash.max_discovery_mode ? (
                <p className="mt-3 border border-[var(--moss)] bg-[var(--paper)] px-3 py-2 text-sm font-semibold text-[var(--moss-deep)]">
                  MAX DISCOVERY — eligible URLs use HTML hub, RSS, Atom, JSON Feed, and WebSub.
                  WEBSUB_ACCEPTED is not INDEXED. HTTP 200 is not INDEXED.
                </p>
              ) : null}
            </div>
            {(
              [
                ["Total URLs", engineDash.total],
                ["Validated", engineDash.validated],
                ["Invalid", engineDash.invalid],
                ["Backlinks found", engineDash.backlinks_found],
                ["Backlinks missing", engineDash.backlinks_missing],
                ["Discovery submitted", engineDash.discovery_submitted],
                ["Waiting for crawl", engineDash.waiting_for_crawl],
                ["Crawled (Googlebot evidence)", engineDash.crawled],
                ["Indexed (verified)", engineDash.indexed],
                ["Not indexed", engineDash.not_indexed],
                ["Retrying", engineDash.retrying],
                ["Failed", engineDash.failed],
              ] as Array<[string, number]>
            ).map(([label, value]) => (
              <div key={label} className="border border-[var(--line)] bg-white p-3">
                <p className="text-xs text-[var(--muted)]">{label}</p>
                <p className="mt-1 text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </section>
        ) : null}

        {engineMetrics ? (
          <section className="border border-[var(--line)] bg-white p-4 text-sm">
            <p className="font-semibold">Measured results (verification only)</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{engineMetrics.engine_class.join(" · ")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div>Submitted: {engineMetrics.urls_submitted}</div>
              <div>Discovered: {engineMetrics.urls_successfully_discovered} ({engineMetrics.discovery_success_rate}%)</div>
              <div>Verified indexed: {engineMetrics.urls_verified_indexed}</div>
              <div>Unknown: {engineMetrics.urls_still_unknown}</div>
              <div>Verified not indexed: {engineMetrics.urls_verified_not_indexed}</div>
              <div>Avg attempts: {engineMetrics.average_attempts}</div>
              <div>Verified index rate: {engineMetrics.verified_index_rate}%</div>
              <div>Avg indexing days: {engineMetrics.average_indexing_days ?? "n/a"}</div>
            </div>
            {engineMetrics.best_performing_domains && engineMetrics.best_performing_domains.length > 0 ? (
              <div className="mt-3 text-xs">
                <p className="font-semibold">Best performing domains (verified INDEXED only)</p>
                <ul className="mt-1 space-y-1">
                  {engineMetrics.best_performing_domains.slice(0, 5).map((row) => (
                    <li key={row.domain}>
                      {row.domain}: {row.verified_indexed}/{row.submitted} verified
                      {row.average_days != null ? ` · avg ${row.average_days} days` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {engineMetrics.insights && engineMetrics.insights.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-xs text-[var(--muted)]">
                {engineMetrics.insights.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs text-[var(--muted)]">{engineMetrics.verified_index_rate_note}</p>
          </section>
        ) : null}

        {analytics ? (
          <section className="grid gap-4 md:grid-cols-3">
            <div className="border border-[var(--line)] bg-white p-4">
              <p className="text-sm text-[var(--muted)]">Total tracked</p>
              <p className="mt-1 text-3xl font-semibold">{analytics.total}</p>
            </div>
            <div className="border border-[var(--line)] bg-white p-4 md:col-span-2">
              <p className="text-sm text-[var(--muted)]">By status</p>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                {Object.entries(analytics.by_status).map(([k, v]) => (
                  <span key={k} className="inline-flex items-center gap-1.5 border border-[var(--line)] px-2 py-1">
                    <StatusBadge status={k} type="index" />
                    <span className="font-semibold">{v}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="border border-[var(--line)] bg-white p-4 md:col-span-3">
              <p className="text-sm text-[var(--muted)]">Platform distribution</p>
              {!analytics.enough_data_for_charts ? (
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Not enough data yet (need ~10+ backlinks for a meaningful chart).
                </p>
              ) : (
                <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2 md:grid-cols-3">
                  {Object.entries(analytics.by_platform)
                    .sort((a, b) => b[1] - a[1])
                    .map(([k, v]) => (
                      <li key={k} className="flex justify-between border-b border-[var(--line)] py-1">
                        <span>{k}</span>
                        <span>{v}</span>
                      </li>
                    ))}
                </ul>
              )}
              <p className="mt-3 text-sm text-[var(--muted)]">
                Avg time-to-indexed:{" "}
                {analytics.avg_time_to_indexed_hours != null
                  ? `${analytics.avg_time_to_indexed_hours.toFixed(1)} hours (n=${analytics.indexed_sample_size})`
                  : "not enough indexed history yet"}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">{analytics.disclaimer}</p>
            </div>
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <form onSubmit={onCreate} className="space-y-3 border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">Add backlink</h2>
            <input
              required
              placeholder="https://… source page that contains the backlink"
              className="w-full border border-[var(--line)] px-3 py-2 text-sm"
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
            />
            <input
              placeholder="Target URL the backlink should point to (optional)"
              className="w-full border border-[var(--line)] px-3 py-2 text-sm"
              value={form.target_url}
              onChange={(e) => setForm({ ...form, target_url: e.target.value })}
            />
            <input
              placeholder="Title"
              className="w-full border border-[var(--line)] px-3 py-2 text-sm"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              placeholder="Short description (shown on /featured)"
              className="w-full border border-[var(--line)] px-3 py-2 text-sm"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                placeholder="Platform"
                className="border border-[var(--line)] px-3 py-2 text-sm"
                value={form.platform}
                onChange={(e) => setForm({ ...form, platform: e.target.value })}
              />
              <select
                className="border border-[var(--line)] px-3 py-2 text-sm"
                value={form.rel_type}
                onChange={(e) => setForm({ ...form, rel_type: e.target.value })}
              >
                <option value="dofollow">dofollow</option>
                <option value="nofollow">nofollow</option>
                <option value="ugc">ugc</option>
                <option value="sponsored">sponsored</option>
              </select>
            </div>
            <label className="block text-xs text-[var(--muted)]">
              Authority score (optional — enter manually if known)
              <input
                type="number"
                min={0}
                max={100}
                className="mt-1 w-full border border-[var(--line)] px-3 py-2 text-sm"
                value={form.authority_score}
                onChange={(e) => setForm({ ...form, authority_score: e.target.value })}
              />
            </label>
            <button type="submit" className="bg-[var(--moss)] px-4 py-2 text-sm font-semibold text-white">
              Add &amp; run pipeline
            </button>
          </form>

          <form onSubmit={onBulk} className="space-y-3 border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">Bulk add (one URL per line)</h2>
            <textarea
              className="w-full border border-[var(--line)] px-3 py-2 font-mono text-sm"
              rows={8}
              placeholder={"https://...\nhttps://..."}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
            <input
              className="w-full border border-[var(--line)] px-3 py-2 text-sm"
              value={bulkPlatform}
              onChange={(e) => setBulkPlatform(e.target.value)}
              placeholder="Shared platform tag"
            />
            <button type="submit" className="border border-[var(--moss)] px-4 py-2 text-sm font-semibold text-[var(--moss-deep)]">
              Import URLs
            </button>
          </form>
          <form onSubmit={onCsv} className="space-y-3 border border-[var(--line)] bg-white p-4 lg:col-span-2">
            <h2 className="font-semibold">Import CSV</h2>
            <p className="text-xs text-[var(--muted)]">
              Requires a <code>url</code> column. Optional: title, description, platform, country, language,
              anchor_text, rel_type, indexed_status, authority_score, notes.
            </p>
            <input name="csv" type="file" accept=".csv,text/csv" className="block w-full text-sm" />
            <button type="submit" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Import CSV
            </button>
          </form>
        </section>

        <section className="border border-[var(--line)] bg-white p-4">
          <h2 className="font-semibold">Free indexing engine jobs</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">
            Visibility INDEXED is never inferred from HTTP 200, our crawler, or a discovery POST.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-2">URL</th>
                  <th className="py-2 pr-2">Score</th>
                  <th className="py-2 pr-2">Priority</th>
                  <th className="py-2 pr-2">Workflow</th>
                  <th className="py-2 pr-2">Property</th>
                  <th className="py-2 pr-2">Backlink</th>
                  <th className="py-2 pr-2">HTTP</th>
                  <th className="py-2 pr-2">Crawlability</th>
                  <th className="py-2 pr-2">Discovery</th>
                  <th className="py-2 pr-2">Verification</th>
                  <th className="py-2 pr-2">Index</th>
                  <th className="py-2 pr-2">Attempts</th>
                  <th className="py-2 pr-2">Last / next</th>
                </tr>
              </thead>
              <tbody>
                {engineJobs.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-6 text-[var(--muted)]">
                      No engine jobs yet.
                    </td>
                  </tr>
                ) : (
                  engineJobs.map((job) => (
                    <tr key={job.id} className="border-b border-[var(--line)] align-top">
                      <td className="py-3 pr-2">
                        <button
                          type="button"
                          className="max-w-xs truncate text-left text-[var(--moss-deep)] hover:underline"
                          onClick={async () => {
                            const res = await fetch(`/api/indexing/engine/jobs/${job.id}`, {
                              credentials: "include",
                            });
                            if (res.ok) setEngineDetail(await res.json());
                          }}
                        >
                          {job.source_url}
                        </button>
                        <div className="text-[10px] text-[var(--muted)]">
                          crawler={job.our_crawler_visited ? "OUR_CRAWLER_VISITED" : "none"} ·
                          googlebot={job.googlebot_visited ? "GOOGLEBOT_VISITED" : "none"}
                        </div>
                      </td>
                      <td className="py-3 pr-2">
                        {job.quality_score != null ? `${job.quality_score}/100` : "—"}
                      </td>
                      <td className="py-3 pr-2">{job.priority_band || "—"}</td>
                      <td className="py-3 pr-2 text-xs">{job.workflow_stage || job.pipeline_status}</td>
                      <td className="py-3 pr-2">
                        <PropertyBadge propertyType={job.property_type} />
                      </td>
                      <td className="py-3 pr-2">
                        {job.backlink_found === true
                          ? "✓ Found"
                          : job.backlink_found === false
                            ? "BACKLINK_NOT_FOUND"
                            : "n/a"}
                      </td>
                      <td className="py-3 pr-2">{job.http_status ?? "—"}</td>
                      <td className="py-3 pr-2">
                        {job.crawlability_score != null
                          ? `${job.crawlability_score}/100 (${job.crawlability_band})`
                          : "—"}
                      </td>
                      <td className="py-3 pr-2 text-xs">
                        <div className="font-semibold text-[var(--moss-deep)]">MAX DISCOVERY</div>
                        <div>Validation {job.http_status === 200 ? "✓" : "—"}</div>
                        <div>Backlink {job.backlink_found === true ? "✓" : job.backlink_found === false ? "missing" : "n/a"}</div>
                        <div>Quality {job.quality_score != null ? `${job.quality_score}/100` : "—"}</div>
                        <div>Priority {job.priority_band || "—"}</div>
                        <div>HTML Discovery {channelMark(job, "html_discovery", true) === "✓" || channelMark(job, "public_hub") === "✓" ? "✓" : channelMark(job, "public_hub")}</div>
                        <div>RSS {channelMark(job, "rss", true)}</div>
                        <div>Atom {channelMark(job, "atom", true)}</div>
                        <div>JSON {channelMark(job, "json_feed", true)}</div>
                        <div>WebSub {channelMark(job, "websub")}</div>
                        <div>Retry {job.next_retry_at ? new Date(job.next_retry_at).toLocaleString() : "—"}</div>
                        <div>Google Crawl {job.googlebot_visited ? "GOOGLEBOT_VISITED" : "UNKNOWN"}</div>
                        <div>Google Index {job.visibility_status || "UNKNOWN"}</div>
                        <div>Final {job.final_status || job.pipeline_status}</div>
                      </td>
                      <td className="py-3 pr-2">{job.verification_status || "—"}</td>
                      <td className="py-3 pr-2">
                        <VisibilityBadge status={job.visibility_status} />
                      </td>
                      <td className="py-3 pr-2">{job.attempt_count}</td>
                      <td className="py-3 pr-2 text-xs">
                        <div>{job.last_checked_at ? new Date(job.last_checked_at).toLocaleString() : "—"}</div>
                        <div className="text-[var(--muted)]">
                          next {job.next_retry_at ? new Date(job.next_retry_at).toLocaleString() : "—"}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {engineDetail ? (
          <section className="border border-[var(--line)] bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold">Job timeline</h2>
                <p className="text-xs text-[var(--muted)]">{engineDetail.job.source_url}</p>
              </div>
              <button type="button" className="text-sm" onClick={() => setEngineDetail(null)}>
                Close
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--muted)]">{engineDetail.disclaimer}</p>
            <p className="mt-2 text-sm">
              Quality: {engineDetail.job.quality_score != null ? `${engineDetail.job.quality_score}/100` : "—"}
              {" · "}
              Priority: {engineDetail.job.priority_band || "—"}
            </p>
            <div className="mt-4 border border-[var(--moss)] bg-[var(--paper)] p-3 text-sm">
              <p className="font-semibold text-[var(--moss-deep)]">MAX DISCOVERY</p>
              <p>Backlink: {engineDetail.job.backlink_found === true ? "✓" : engineDetail.job.backlink_found === false ? "missing" : "n/a"}</p>
              <p>Quality: {engineDetail.job.quality_score != null ? `${engineDetail.job.quality_score}/100` : "—"}</p>
              <p>Priority: {engineDetail.job.priority_band || "—"}</p>
              <p>HTML Discovery: {channelMark(engineDetail.job, "html_discovery", true) === "✓" || channelMark(engineDetail.job, "public_hub") === "✓" ? "✓" : channelMark(engineDetail.job, "public_hub")}</p>
              <p>RSS: {channelMark(engineDetail.job, "rss", true)}</p>
              <p>Atom: {channelMark(engineDetail.job, "atom", true)}</p>
              <p>JSON: {channelMark(engineDetail.job, "json_feed", true)}</p>
              <p>WebSub: {channelMark(engineDetail.job, "websub")}</p>
              <p>Google Crawl: {engineDetail.job.googlebot_visited ? "GOOGLEBOT_VISITED" : "UNKNOWN"}</p>
              <p>Google Index: {engineDetail.job.visibility_status || "UNKNOWN"}</p>
              <p>Final status: {engineDetail.job.final_status || engineDetail.job.pipeline_status}</p>
            </div>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {[
                "SUBMITTED",
                "VALIDATED",
                "BACKLINK_FOUND",
                "DISCOVERY_PUBLISHED",
                "WAITING",
                "CRAWLED_EVIDENCE",
                "INDEXED",
              ].map((step) => (
                <li
                  key={step}
                  className={engineDetail.job.workflow_stage === step ? "font-semibold" : "text-[var(--muted)]"}
                >
                  {step.replaceAll("_", " ")}
                </li>
              ))}
            </ol>
            <div className="mt-3 text-xs text-[var(--muted)]">
              GOOGLE CRAWL: {engineDetail.job.googlebot_visited ? "GOOGLEBOT_VISITED" : "Unknown"} · GOOGLE INDEX: {engineDetail.job.visibility_status}
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {engineDetail.timeline.map((event) => (
                <li key={event.id} className="border-b border-[var(--line)] py-2">
                  <span className="font-medium">{new Date(event.created_at).toLocaleString()}</span>{" "}
                  {event.to_status}
                  {event.note ? <div className="text-xs text-[var(--muted)]">{event.note}</div> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="border border-[var(--line)] bg-white p-4">
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[200px] flex-1 border border-[var(--line)] px-3 py-2 text-sm"
              placeholder="Search url, title, domain…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <input
              className="border border-[var(--line)] px-3 py-2 text-sm"
              placeholder="Platform filter"
              value={platform}
              onChange={(e) => {
                setPage(1);
                setPlatform(e.target.value);
              }}
            />
            <select
              className="border border-[var(--line)] px-3 py-2 text-sm"
              value={status}
              onChange={(e) => {
                setPage(1);
                setStatus(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void load()} className="border border-[var(--line)] px-3 py-2 text-sm">
              Refresh
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--line)] text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-2">Title / URL</th>
                  <th className="py-2 pr-2">Platform</th>
                  <th className="py-2 pr-2">Index Status</th>
                  <th className="py-2 pr-2">Dispatch Status</th>
                  <th className="py-2 pr-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-[var(--muted)]">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-[var(--muted)]">
                      No backlinks yet.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => (
                    <tr key={row.id} className="border-b border-[var(--line)] align-top">
                      <td className="py-3 pr-2">
                        <button
                          type="button"
                          className="text-left font-medium text-[var(--moss-deep)] hover:underline"
                          onClick={() => void openDetail(row.id)}
                        >
                          {row.title || row.url}
                        </button>
                        <div className="mt-1 max-w-md truncate text-xs text-[var(--muted)]">{row.url}</div>
                      </td>
                      <td className="py-3 pr-2">{row.platform}</td>
                      <td className="py-3 pr-2">
                        <StatusBadge status={row.indexed_status || row.status} type="index" />
                      </td>
                      <td className="py-3 pr-2">
                        <StatusBadge status={row.dispatch_status} type="dispatch" method={row.dispatch_method} />
                      </td>
                      <td className="py-3 pr-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="border border-[var(--line)] px-2 py-1 text-xs"
                            onClick={() => checkNow(row.url)}
                            title="Opens Google site: search in a new tab"
                          >
                            Check Now
                          </button>
                          <button
                            type="button"
                            disabled={repingId === row.id}
                            className="border border-[var(--moss)] px-2 py-1 text-xs text-[var(--moss-deep)] disabled:opacity-40"
                            onClick={() => void reping(row.id)}
                            title="Re-submit this URL through the FastAPI dispatch pipeline"
                          >
                            {repingId === row.id ? "Pinging…" : "Re-ping"}
                          </button>
                          <a
                            href={`/internal/validator?id=${row.id}`}
                            className="border border-[var(--line)] px-2 py-1 text-xs"
                          >
                            Health
                          </a>
                          <button
                            type="button"
                            className="border border-[var(--line)] px-2 py-1 text-xs"
                            onClick={() => void openDetail(row.id)}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-[var(--muted)]">
              {total} total · page {page}/{pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                className="border border-[var(--line)] px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= pages}
                className="border border-[var(--line)] px-3 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </section>

        {selected ? (
          <section className="border border-[var(--line)] bg-white p-4 shadow-md">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] pb-3">
              <div>
                <h2 className="font-semibold text-lg">Edit Backlink ({selected.id})</h2>
                <p className="text-xs text-[var(--muted)]">{selected.url}</p>
              </div>
              <button type="button" className="text-sm font-semibold text-[var(--muted)] hover:text-black" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <form onSubmit={saveDetail} className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-sm md:col-span-2">
                Title
                <input
                  className="mt-1 w-full border border-[var(--line)] px-3 py-2"
                  value={selected.title || ""}
                  onChange={(e) => setSelected({ ...selected, title: e.target.value })}
                />
              </label>
              <label className="text-sm md:col-span-2">
                Description
                <textarea
                  className="mt-1 w-full border border-[var(--line)] px-3 py-2"
                  rows={2}
                  value={selected.description || ""}
                  onChange={(e) => setSelected({ ...selected, description: e.target.value })}
                />
              </label>
              <label className="text-sm">
                Platform
                <input
                  className="mt-1 w-full border border-[var(--line)] px-3 py-2"
                  value={selected.platform || ""}
                  onChange={(e) => setSelected({ ...selected, platform: e.target.value })}
                />
              </label>
              <div className="text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">Index Status</span>
                  <StatusBadge
                    status={selected.index_status || selected.indexed_status || selected.status}
                    type="index"
                  />
                </div>
                <select
                  className="w-full border border-[var(--line)] px-3 py-2 font-medium"
                  value={selected.index_status || selected.indexed_status || selected.status || "pending"}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      index_status: e.target.value,
                      status: e.target.value,
                      indexed_status: e.target.value,
                    })
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-sm flex flex-col justify-end">
                <span className="font-medium text-[var(--muted)] mb-1">Dispatch Status</span>
                <div className="flex items-center gap-2 py-2">
                  <StatusBadge
                    status={selected.dispatch_status}
                    type="dispatch"
                    method={selected.dispatch_method}
                  />
                  {selected.dispatch_method && (
                    <span className="text-xs text-[var(--muted)]">({selected.dispatch_method})</span>
                  )}
                </div>
              </div>
              <label className="text-sm">
                Authority score (manual only)
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="mt-1 w-full border border-[var(--line)] px-3 py-2"
                  value={selected.authority_score ?? ""}
                  onChange={(e) =>
                    setSelected({
                      ...selected,
                      authority_score: e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                />
              </label>
              <label className="text-sm">
                Rel Type
                <select
                  className="mt-1 w-full border border-[var(--line)] px-3 py-2"
                  value={selected.rel_type || "dofollow"}
                  onChange={(e) => setSelected({ ...selected, rel_type: e.target.value })}
                >
                  <option value="dofollow">dofollow</option>
                  <option value="nofollow">nofollow</option>
                  <option value="ugc">ugc</option>
                  <option value="sponsored">sponsored</option>
                </select>
              </label>
              <label className="text-sm md:col-span-2">
                Notes
                <textarea
                  className="mt-1 w-full border border-[var(--line)] px-3 py-2"
                  rows={2}
                  value={selected.notes || ""}
                  onChange={(e) => setSelected({ ...selected, notes: e.target.value })}
                />
              </label>
              <div className="flex flex-wrap items-center gap-2 md:col-span-2 mt-2">
                <button type="submit" className="bg-[var(--moss)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--moss-deep)]">
                  Save Changes
                </button>
                <button
                  type="button"
                  className="border border-[var(--line)] px-4 py-2 text-sm font-medium"
                  onClick={() => checkNow(selected.url)}
                >
                  Check Google Index
                </button>
                <button
                  type="button"
                  className="border border-[var(--alert)] px-4 py-2 text-sm font-medium text-[var(--alert)] hover:bg-red-50"
                  onClick={() => void softDelete(selected.id)}
                >
                  Delete Backlink
                </button>
              </div>
            </form>

            <h3 className="mt-6 text-sm font-semibold">Status &amp; Ping History</h3>
            <ul className="mt-2 space-y-2 text-sm">
              {(selected.status_history || []).length === 0 ? (
                <li className="text-[var(--muted)]">No history recorded yet.</li>
              ) : (
                selected.status_history?.map((h) => (
                  <li key={h.id} className="border-b border-[var(--line)] py-2">
                    <span className="font-medium text-[var(--moss-deep)]">
                      {h.new_status}
                    </span>
                    <span className="ml-2 text-[var(--muted)]">
                      {new Date(h.changed_at).toLocaleString()}
                    </span>
                    {h.note ? <div className="text-[var(--muted)] text-xs mt-0.5">{h.note}</div> : null}
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

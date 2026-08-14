"use client";

import { FormEvent, useState } from "react";
import { PropertyBadge, VisibilityBadge } from "@/components/StatusBadge";

type JobDetail = {
  job: {
    id: string;
    source_url: string;
    target_url: string | null;
    property_type: string;
    pipeline_status: string;
    visibility_status: string;
    http_status: number | null;
    http_class: string | null;
    crawlability_score: number | null;
    crawlability_band: string | null;
    backlink_found: boolean | null;
    discovery_status: string | null;
    discovery_stage: string | null;
    discovery_quality: number | null;
    channel_snapshot: Record<string, ChannelCard>;
    verification_status: string | null;
    verification_method: string | null;
    googlebot_visited: boolean;
    our_crawler_visited: boolean;
    attempt_count: number;
    next_retry_at: string | null;
    last_error: string | null;
    quality_score?: number | null;
    quality_recommendation?: string | null;
    priority_band?: string | null;
    workflow_stage?: string | null;
  };
  timeline: Array<{ id: string; to_status: string; note: string | null; created_at: string }>;
  site_search_url: string;
  validations: Array<Record<string, unknown>>;
  inspections: Array<Record<string, unknown>>;
  crawlability: Array<Record<string, unknown>>;
  discovery: Array<Record<string, unknown>>;
  verification: Array<Record<string, unknown>>;
  crawl_evidence: Array<Record<string, unknown>>;
  channel_cards: Record<string, ChannelCard>;
  disclaimer: string;
};

type ChannelCard = {
  channel?: string;
  status?: string;
  accepted?: boolean;
  evidence?: string;
  signal_quality?: number;
  error?: string;
  payload?: Record<string, unknown>;
};

function card(snapshot: Record<string, ChannelCard> | undefined, name: string): ChannelCard | undefined {
  return snapshot?.[name];
}

function channelLine(label: string, c: ChannelCard | undefined, thirdPartyNa?: string) {
  if (!c) {
    return (
      <div className="flex justify-between gap-4 border-b border-[var(--line)] py-2">
        <span className="font-medium">{label}</span>
        <span className="text-[var(--muted)]">{thirdPartyNa || "—"}</span>
      </div>
    );
  }
  const na = c.status === "INDEXNOW_NOT_AVAILABLE" || c.status === "SITEMAP_NOT_AVAILABLE" || c.status === "WEBSUB_UNAVAILABLE";
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--line)] py-2">
      <span className="font-medium">{label}</span>
      <span>
        {na ? `N/A — ${c.evidence || c.status}` : c.accepted ? `✓ ${c.status}` : c.status}
        {typeof c.signal_quality === "number" && c.accepted ? (
          <span className="ml-2 text-xs text-[var(--muted)]">signal {c.signal_quality.toFixed(2)}</span>
        ) : null}
      </span>
    </div>
  );
}

export default function EngineTestPage() {
  const [sourceUrl, setSourceUrl] = useState("https://en.wikipedia.org/wiki/Example.com");
  const [targetUrl, setTargetUrl] = useState("https://example.com/");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<JobDetail | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    setDetail(null);
    try {
      const created = await fetch("/api/indexing/engine/jobs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: sourceUrl.trim(),
          target_url: targetUrl.trim() || null,
          project: "engine-test",
          run: true,
        }),
      });
      if (created.status === 401) {
        setError("Sign in required");
        return;
      }
      if (!created.ok) {
        const body = await created.json().catch(() => ({}));
        setError(JSON.stringify(body.detail || body));
        return;
      }
      const job = await created.json();
      const res = await fetch(`/api/indexing/engine/jobs/${job.id}`, { credentials: "include" });
      if (!res.ok) {
        setError("Created the job but failed to load evidence");
        return;
      }
      setDetail(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  const job = detail?.job;
  const snapshot = job?.channel_snapshot || detail?.channel_cards || {};

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <h1 className="font-semibold">Engine test</h1>
          <a href="/internal/backlinks" className="text-sm text-[var(--moss-deep)]">
            ← Backlinks
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <p className="text-sm text-[var(--muted)]">
          Runs the real discovery pipeline against a URL. INDEXED is never inferred from HTTP 200,
          hub listing, WebSub 202, or our crawler. This is a discovery + crawl-monitoring +
          verification tool, not a Google indexing API.
        </p>
        <form onSubmit={onSubmit} className="space-y-3 border border-[var(--line)] bg-white p-4">
          <label className="block text-sm">
            Source URL (page to fetch)
            <input
              className="mt-1 w-full border border-[var(--line)] px-3 py-2"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm">
            Target URL (optional backlink href)
            <input
              className="mt-1 w-full border border-[var(--line)] px-3 py-2"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="bg-[var(--moss)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Running…" : "Run pipeline"}
          </button>
        </form>
        {error ? <p className="text-sm text-[var(--alert)]">{error}</p> : null}

        {job ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <div className="flex flex-wrap items-center gap-2">
              <PropertyBadge propertyType={job.property_type} />
              <VisibilityBadge status={job.visibility_status} />
              <span className="text-sm">pipeline {job.pipeline_status}</span>
            </div>
            <p className="break-all text-sm">{job.source_url}</p>
            <div className="text-sm">
              {channelLine(
                "QUALITY",
                undefined,
                job.quality_score != null ? `${job.quality_score}/100` : "—"
              )}
              {channelLine("PRIORITY", undefined, job.priority_band || "—")}
              {channelLine("WORKFLOW", undefined, job.workflow_stage || job.pipeline_status)}
              {channelLine("BACKLINK", undefined, job.backlink_found === true ? "✓ Found" : job.backlink_found === false ? "Not found" : "n/a")}
              {channelLine(
                "CRAWLABILITY",
                undefined,
                job.crawlability_score != null ? `${job.crawlability_score}/100 (${job.crawlability_band})` : "—"
              )}
              {channelLine("PUBLIC HUB", card(snapshot, "public_hub"))}
              {channelLine("WEBSUB", card(snapshot, "websub"))}
              {channelLine("INDEXNOW", card(snapshot, "indexnow"), "N/A — Third-party host")}
              {channelLine("SITEMAP", card(snapshot, "sitemap"), "N/A — Third-party host")}
              {channelLine("GOOGLE CRAWL", undefined, job.googlebot_visited ? "GOOGLEBOT_VISITED" : "Unknown")}
              {channelLine("GOOGLE INDEX", undefined, job.visibility_status)}
            </div>
            <p className="text-xs text-[var(--muted)]">{detail?.disclaimer}</p>
            <p className="text-xs">
              Manual site: check:{" "}
              <a className="underline" href={detail?.site_search_url} target="_blank" rel="noreferrer">
                {detail?.site_search_url}
              </a>
            </p>
          </section>
        ) : null}

        {detail ? (
          <section className="grid gap-4 md:grid-cols-2">
            {(
              [
                ["Validation", detail.validations],
                ["Backlink", detail.inspections],
                ["Robots / crawlability", detail.crawlability],
                ["Discovery", detail.discovery],
                ["Retry / timeline", detail.timeline],
                ["Verification", detail.verification],
                ["Crawl evidence", detail.crawl_evidence],
              ] as Array<[string, unknown[]]>
            ).map(([title, rows]) => (
              <div key={title} className="border border-[var(--line)] bg-white p-3">
                <h2 className="font-semibold">{title}</h2>
                <pre className="mt-2 max-h-80 overflow-auto text-[11px] leading-relaxed">
                  {JSON.stringify(rows, null, 2)}
                </pre>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </main>
  );
}

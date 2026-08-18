"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Radar, Globe2, Timer, RefreshCw, Eye, ShieldAlert } from "lucide-react";
import {
  Card,
  StatCard,
  EmptyState,
  Skeleton,
  TableWrap,
  Th,
  Td,
  Pill,
  PipelinePill,
  PageError,
} from "@/components/ui";
import { listJobs, EngineJob } from '@/lib/dashboard';

function HttpPill({ status }: { status?: number | null }) {
  if (status == null) return <Pill tone="neutral">—</Pill>;
  if (status >= 200 && status < 300) return <Pill tone="success">{status}</Pill>;
  if (status >= 300 && status < 400) return <Pill tone="info">{status}</Pill>;
  if (status >= 400 && status < 500) return <Pill tone="warning">{status}</Pill>;
  return <Pill tone="danger">{status}</Pill>;
}

export default function CrawlMonitoringPage() {
  const [jobs, setJobs] = useState<EngineJob[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await listJobs({ limit: 50 });
    if (res.ok) {
      setJobs(res.data.items);
      setError("");
    } else {
      setJobs([]);
      setError(res.status === 401 ? "Authentication required." : res.error || "Failed to load crawl evidence.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const crawled = jobs?.filter((j) => j.our_crawler_visited || j.http_status != null) || [];
  const blocked = jobs?.filter((j) => ["ROBOTS_BLOCKED", "NOINDEX", "URL_UNREACHABLE"].includes((j.pipeline_status || "").toUpperCase())) || [];
  const redirects = jobs?.filter((j) => j.http_status != null && j.http_status >= 300 && j.http_status < 400) || [];

  return (
    <div className="space-y-6">
      {error ? <PageError message={error} onRetry={() => void load()} /> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="URLs Crawled" value={jobs === null ? "—" : crawled.length} icon={<Globe2 className="h-4 w-4" />} tone="info" loading={jobs === null} />
        <StatCard label="Blocked / Noindex" value={jobs === null ? "—" : blocked.length} icon={<ShieldAlert className="h-4 w-4" />} tone="danger" loading={jobs === null} />
        <StatCard label="Redirects (3xx)" value={jobs === null ? "—" : redirects.length} icon={<RefreshCw className="h-4 w-4" />} tone="warning" loading={jobs === null} />
        <StatCard label="Avg Crawlability" value={jobs === null || crawled.length === 0 ? "—" : `${Math.round(crawled.reduce((s, j) => s + (j.crawlability_score || 0), 0) / crawled.length)}`} icon={<Timer className="h-4 w-4" />} tone="violet" loading={jobs === null} />
      </div>

      <Card className="p-5">
        <h3 className="mb-1 text-sm font-semibold text-foreground">How crawl evidence is collected</h3>
        <p className="text-xs leading-6 text-muted">
          The engine crawls with its own user-agent and records HTTP status, robots.txt verdicts,
          canonical status, redirect chains, and crawlability — never impersonating Googlebot.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Crawl Evidence</h3>
        </div>
        {jobs === null ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Radar className="h-8 w-8" />}
            title="No crawl evidence yet"
            description="Crawl evidence appears once URLs are submitted to the engine."
          />
        ) : (
          <TableWrap className="border-0">
            <thead>
              <tr>
                <Th>URL</Th>
                <Th>Pipeline</Th>
                <Th>HTTP</Th>
                <Th>Crawlability</Th>
                <Th>Canonical</Th>
                <Th>Googlebot Visited</Th>
                <Th>Last Crawl</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-surface-2">
                  <Td className="max-w-[240px]">
                    <p className="truncate text-sm font-medium text-foreground">{j.source_url}</p>
                  </Td>
                  <Td><PipelinePill status={j.pipeline_status} /></Td>
                  <Td><HttpPill status={j.http_status} /></Td>
                  <Td>
                    {j.crawlability_score == null ? (
                      <span className="text-xs text-muted">—</span>
                    ) : (
                      <span className="text-sm text-foreground">
                        {j.crawlability_score}
                        <span className="ml-1.5 text-xs text-muted">{j.crawlability_band || ""}</span>
                      </span>
                    )}
                  </Td>
                  <Td className="text-xs text-muted">{j.canonical_status || "—"}</Td>
                  <Td>
                    <Pill tone={j.googlebot_visited ? "success" : "neutral"}>
                      {j.googlebot_visited ? "Yes" : "No / Unknown"}
                    </Pill>
                  </Td>
                  <Td className="text-xs text-muted">
                    {j.last_checked_at ? new Date(j.last_checked_at).toLocaleString() : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  Zap,
  Globe2,
  Rss,
  Atom,
  FileJson,
  Webhook,
  Network,
  Gauge,
  Target,
  FlaskConical,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  Card,
  StatCard,
  EmptyState,
  Skeleton,
  TableWrap,
  Th,
  Td,
  PipelinePill,
  Drawer,
  Button,
  useToast,
} from "@/components/ui";
import { listJobs, getJobDetail, EngineJob, JobDetail } from "@/lib/dashboard";

const CHANNELS = [
  { icon: <Globe2 className="h-4 w-4" />, name: "HTML", note: "Crawlable hub" },
  { icon: <Rss className="h-4 w-4" />, name: "RSS", note: "Feed" },
  { icon: <Atom className="h-4 w-4" />, name: "Atom", note: "Feed" },
  { icon: <FileJson className="h-4 w-4" />, name: "JSON Feed", note: "Feed" },
  { icon: <Webhook className="h-4 w-4" />, name: "WebSub", note: "Hub ping" },
  { icon: <Network className="h-4 w-4" />, name: "Crawl graph", note: "Internal" },
];

const STAGES = [
  "Submitted",
  "Validated",
  "Backlink Found",
  "Discovery Published",
  "Waiting",
  "Crawled Evidence",
  "Index Verification",
];

export default function DiscoveryPage() {
  const toast = useToast();
  const [jobs, setJobs] = useState<EngineJob[] | null>(null);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<JobDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const res = await listJobs({ limit: 25, pipeline_status: filter || undefined });
    if (res.ok) {
      setJobs(res.data.items);
      setTotal(res.data.total);
    } else {
      setJobs([]);
      if (res.status === 401) toast.push("error", "Backend requires authentication for job data.");
    }
  }, [filter, toast]);

  useEffect(() => {
    setJobs(null);
    void load();
  }, [load]);

  async function openDetail(job: EngineJob) {
    setDetailLoading(true);
    const res = await getJobDetail(job.id);
    setDetailLoading(false);
    if (res.ok) setDetail(res.data);
    else toast.push("error", res.error);
  }

  const counts = {
    total: total,
    validated: jobs?.filter((j) => ["VALIDATED", "BACKLINK_VERIFIED", "CRAWLABILITY_CHECK"].includes((j.pipeline_status || "").toUpperCase())).length || 0,
    waiting: jobs?.filter((j) => ["DISCOVERY_QUEUED", "DISCOVERY_SUBMITTED", "WAITING_FOR_CRAWL"].includes((j.pipeline_status || "").toUpperCase())).length || 0,
    failed: jobs?.filter((j) => ["URL_UNREACHABLE", "INVALID_URL", "BACKLINK_NOT_FOUND", "DISCOVERY_FAILED"].includes((j.pipeline_status || "").toUpperCase())).length || 0,
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Jobs" value={jobs === null ? "—" : counts.total} icon={<Zap className="h-4 w-4" />} tone="violet" loading={jobs === null} />
        <StatCard label="Validated" value={jobs === null ? "—" : counts.validated} icon={<CheckCircle2 className="h-4 w-4" />} tone="info" loading={jobs === null} />
        <StatCard label="Waiting / Discovery" value={jobs === null ? "—" : counts.waiting} icon={<Clock className="h-4 w-4" />} tone="warning" loading={jobs === null} />
        <StatCard label="Failed" value={jobs === null ? "—" : counts.failed} icon={<FlaskConical className="h-4 w-4" />} tone="danger" loading={jobs === null} />
      </div>

      {/* Channels */}
      <Card className="p-5">
        <h3 className="mb-1 text-sm font-semibold text-white">Legitimate Discovery Channels</h3>
        <p className="mb-4 text-xs text-slate-500">Discovery signals ≠ indexing. None of these guarantee indexing.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CHANNELS.map((c) => (
            <div key={c.name} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
              <div className="mx-auto mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-500/10 text-indigo-300">
                {c.icon}
              </div>
              <p className="text-xs font-semibold text-white">{c.name}</p>
              <p className="text-[10px] text-slate-500">{c.note}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Workflow stages */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-white">Pipeline Stages</h3>
        <div className="flex flex-wrap items-center gap-2">
          {STAGES.map((s, i) => (
            <React.Fragment key={s}>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-medium text-slate-300">{s}</span>
              {i < STAGES.length - 1 ? <span className="text-slate-700">→</span> : null}
            </React.Fragment>
          ))}
        </div>
      </Card>

      {/* Jobs */}
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Indexing Jobs</h3>
          <select
            className="h-9 rounded-md border border-border bg-surface-2 px-3 text-xs text-foreground focus:border-primary focus:outline-none"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">All pipeline states</option>
            <option value="RECEIVED">Received</option>
            <option value="VALIDATING">Validating</option>
            <option value="VALIDATED">Validated</option>
            <option value="BACKLINK_CHECK">Backlink Check</option>
            <option value="DISCOVERY_QUEUED">Discovery Queued</option>
            <option value="WAITING_FOR_CRAWL">Waiting For Crawl</option>
            <option value="VERIFICATION_PENDING">Verification Pending</option>
            <option value="RETRY_PENDING">Retry Pending</option>
            <option value="URL_UNREACHABLE">URL Unreachable</option>
          </select>
        </div>
        {jobs === null ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Zap className="h-8 w-8" />}
            title="No indexing jobs yet"
            description="Submit a backlink to start the discovery pipeline. Every stage is recorded as real evidence."
          />
        ) : (
          <TableWrap className="border-0">
            <thead>
              <tr>
                <Th>URL</Th>
                <Th>Pipeline</Th>
                <Th>HTTP</Th>
                <Th>Quality</Th>
                <Th>Discovery</Th>
                <Th>Visibility</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr key={j.id} className="cursor-pointer hover:bg-white/[0.03]" onClick={() => openDetail(j)}>
                  <Td className="max-w-[240px]">
                    <p className="truncate text-sm font-medium text-white">{j.source_url}</p>
                    <p className="text-xs text-slate-500">{j.project || "—"}</p>
                  </Td>
                  <Td><PipelinePill status={j.pipeline_status} /></Td>
                  <Td className="text-xs text-slate-400">{j.http_status ?? "—"}</Td>
                  <Td className="text-xs text-slate-300">{j.quality_score ?? "—"}</Td>
                  <Td className="text-xs text-slate-300">{j.discovery_score ?? "—"}</Td>
                  <Td className="text-xs text-slate-400">{(j.visibility_status || "UNKNOWN").toLowerCase()}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {/* Job detail drawer */}
      <Drawer open={detail !== null || detailLoading} onClose={() => setDetail(null)} title="Job Timeline">
        {detailLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : detail ? (
          <div className="space-y-5">
            <div>
              <p className="break-all text-sm font-medium text-white">{detail.job.source_url}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <PipelinePill status={detail.job.pipeline_status} />
                {detail.job.http_status ? (
                  <span className="rounded-full border border-border bg-surface-2 px-2.5 py-0.5 text-xs text-slate-300">
                    HTTP {detail.job.http_status}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="space-y-3">
              {detail.timeline.length === 0 ? (
                <p className="text-sm text-slate-500">No timeline events recorded yet.</p>
              ) : (
                detail.timeline.map((ev, i) => (
                  <div key={ev.id} className="relative flex gap-3">
                    {i < detail.timeline.length - 1 ? (
                      <span className="absolute left-[9px] top-6 h-full w-px bg-white/10" />
                    ) : null}
                    <span className="relative z-10 mt-1.5 h-[10px] w-[10px] shrink-0 rounded-full border-2 border-indigo-400 bg-[#0b1022]" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">{ev.to_status.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase())}</p>
                      {ev.note ? <p className="text-xs text-slate-500">{ev.note}</p> : null}
                      <p className="text-[11px] text-slate-600">
                        {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
            {detail.job.last_error ? (
              <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                {detail.job.last_error}
              </div>
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

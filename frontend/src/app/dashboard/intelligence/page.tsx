"use client";

import React, { useCallback, useEffect, useState } from "react";
import { LineChart, Gauge, Target, Globe2, Clock, TrendingUp } from "lucide-react";
import {
  Card,
  StatCard,
  EmptyState,
  Skeleton,
  TableWrap,
  Th,
  Td,
  ProgressBar,
  Pill,
} from "@/components/ui";
import { listJobs, getIntelligence, EngineJob } from '@/lib/dashboard';

export default function IntelligencePage() {
  const [jobs, setJobs] = useState<EngineJob[] | null>(null);
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    const [res, intel] = await Promise.all([listJobs({ limit: 200 }), getIntelligence()]);
    if (res.ok) setJobs(res.data.items);
    else setJobs([]);
    if (intel.ok) setSnapshot(intel.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Domain stats computed from real job data.
  const domains = React.useMemo(() => {
    if (!jobs) return [];
    const byDomain = new Map<string, EngineJob[]>();
    for (const j of jobs) {
      const d = j.source_domain || j.source_url.split("/")[2] || "unknown";
      if (!byDomain.has(d)) byDomain.set(d, []);
      byDomain.get(d)!.push(j);
    }
    return [...byDomain.entries()]
      .map(([domain, list]) => {
        const submitted = list.length;
        const indexed = list.filter((j) => (j.visibility_status || "").toUpperCase() === "INDEXED").length;
        const successRate = submitted ? Math.round((indexed / submitted) * 100) : 0;
        const avgTime = list.reduce((s, j) => s + (j.quality_score || 0), 0);
        return { domain, submitted, indexed, successRate, avgQuality: submitted ? Math.round(avgTime / submitted) : 0 };
      })
      .sort((a, b) => b.submitted - a.submitted);
  }, [jobs]);

  const total = jobs?.length || 0;
  const indexed = jobs?.filter((j) => (j.visibility_status || "").toUpperCase() === "INDEXED").length || 0;
  const successRate = total ? Math.round((indexed / total) * 100) : 0;

  const topDomains = [...domains].sort((a, b) => b.successRate - a.successRate).slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Quality Score (avg)" value={jobs === null || total === 0 ? "—" : Math.round(jobs.reduce((s, j) => s + (j.quality_score || 0), 0) / total)} icon={<Gauge className="h-4 w-4" />} tone="violet" loading={jobs === null} />
        <StatCard label="Submitted" value={jobs === null ? "—" : total} icon={<Target className="h-4 w-4" />} tone="info" loading={jobs === null} />
        <StatCard label="Success Rate" value={jobs === null ? "—" : `${successRate}%`} icon={<TrendingUp className="h-4 w-4" />} tone="success" loading={jobs === null} />
        <StatCard label="Domains Tracked" value={jobs === null ? "—" : domains.length} icon={<Globe2 className="h-4 w-4" />} tone="warning" loading={jobs === null} />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-white">Engine Snapshot</h3>
          {snapshot?.recalculated_at ? (
            <span className="text-xs text-slate-500">Recalculated {new Date(snapshot.recalculated_at as string).toLocaleString()}</span>
          ) : null}
        </div>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Historical insights are descriptive, not predictions. Every number here is derived from
          observed operational data — backlinks, jobs, crawls, and verification evidence.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Risk Score", value: snapshot?.risk_score },
            { label: "Opportunity Score", value: snapshot?.opportunity_score },
            { label: "Priority Score", value: snapshot?.priority_score },
            { label: "Health Score", value: snapshot?.health_score },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-white">{s.value == null ? "—" : String(s.value)}</p>
            </div>
          ))}
        </div>
        {snapshot?.recommended_next_action ? (
          <div className="mt-4 rounded-lg border border-indigo-400/20 bg-indigo-500/[0.06] px-3 py-2 text-xs text-indigo-200">
            Recommended next action: {String(snapshot.recommended_next_action)}
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Best Performing Domains</h3>
        </div>
        {jobs === null ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : topDomains.length === 0 ? (
          <EmptyState
            icon={<Globe2 className="h-8 w-8" />}
            title="No domain intelligence yet"
            description="Domain insights appear once URLs are processed by the engine."
          />
        ) : (
          <TableWrap className="border-0">
            <thead>
              <tr>
                <Th>Domain</Th>
                <Th>Submissions</Th>
                <Th>Verified Indexed</Th>
                <Th>Success Rate</Th>
                <Th>Avg Quality</Th>
              </tr>
            </thead>
            <tbody>
              {topDomains.map((d) => (
                <tr key={d.domain} className="hover:bg-white/[0.02]">
                  <Td>
                    <span className="flex items-center gap-2 text-sm font-medium text-white">
                      <Globe2 className="h-4 w-4 text-indigo-300" /> {d.domain}
                    </span>
                  </Td>
                  <Td className="text-sm text-slate-300">{d.submitted}</Td>
                  <Td className="text-sm text-slate-300">{d.indexed}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={d.successRate} tone={d.successRate >= 50 ? "success" : d.successRate >= 25 ? "warning" : "danger"} className="w-24" />
                      <span className="text-xs text-slate-400">{d.successRate}%</span>
                    </div>
                  </Td>
                  <Td className="text-sm text-slate-300">{d.avgQuality}</Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <Clock className="h-4 w-4 shrink-0 text-indigo-300" />
        <p className="text-xs leading-5 text-slate-500">
          Average indexing time and historical trends are only computed from verified evidence —
          never estimated to make the numbers look better.
        </p>
      </div>
    </div>
  );
}

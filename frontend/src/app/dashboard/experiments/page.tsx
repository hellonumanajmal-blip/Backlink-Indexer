"use client";

import React, { useCallback, useEffect, useState } from "react";
import { FlaskConical, TrendingUp, Scale, AlertTriangle } from "lucide-react";
import {
  Card,
  StatCard,
  EmptyState,
  Skeleton,
  TableWrap,
  Th,
  Td,
  Pill,
  ProgressBar,
} from "@/components/ui";
import { getExperiments, ExperimentReport } from "@/lib/dashboard";

const GROUP_ORDER = ["A", "B", "C", "D"];

export default function ExperimentsPage() {
  const [report, setReport] = useState<ExperimentReport | null>(null);
  const [authError, setAuthError] = useState("");

  const load = useCallback(async () => {
    const res = await getExperiments();
    if (res.ok) setReport(res.data);
    else {
      setReport({});
      if (res.status === 401) setAuthError("Experiment data requires backend authentication.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = report?.groups || {};
  const totals = report?.totals;
  const funnel = report?.funnel;

  const rows = GROUP_ORDER.filter((g) => groups[g]).map((g) => {
    const grp = groups[g]!;
    const n = grp.eligible || grp.n || 0;
    const rate = n ? Math.round(((grp.indexed || 0) / n) * 100) : 0;
    return { key: g, ...grp, n, rate };
  });

  return (
    <div className="space-y-6">
      {authError ? (
        <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">{authError}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Submitted (in study)" value={totals?.submitted_in_study ?? "—"} icon={<FlaskConical className="h-4 w-4" />} tone="violet" loading={report === null} />
        <StatCard label="Verified Indexed" value={totals?.verified_indexed ?? "—"} icon={<TrendingUp className="h-4 w-4" />} tone="success" loading={report === null} />
        <StatCard label="Unknown" value={totals?.unknown ?? "—"} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" loading={report === null} />
        <StatCard label="Excluded (already indexed)" value={totals?.baseline_already_indexed_excluded ?? "—"} icon={<Scale className="h-4 w-4" />} tone="neutral" loading={report === null} />
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-white">How experiments work</h3>
        <p className="mt-2 text-xs leading-6 text-slate-500">
          Only jobs with an experiment start time are included. BASELINE_ALREADY_INDEXED URLs are
          excluded from rate denominators. No experiment is called a winner unless the data
          supports it — with minimum sample sizes and significance checks on the backend.
        </p>
      </Card>

      {funnel ? (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-white">Discovery Funnel</h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Signal Accepted", value: funnel.discovery_signal_accepted ?? "—" },
              { label: "URL Discovered", value: funnel.target_url_discovered ?? "—" },
              { label: "URL Crawled", value: funnel.target_url_crawled ?? "—" },
              { label: "URL Indexed", value: funnel.target_url_indexed ?? "—" },
            ].map((f) => (
              <div key={f.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
                <p className="text-2xl font-bold text-white">{f.value}</p>
                <p className="mt-1 text-xs text-slate-500">{f.label}</p>
              </div>
            ))}
          </div>
          {funnel.note ? (
            <p className="mt-3 text-xs text-amber-300/80">{funnel.note}</p>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-white">Experiment Groups</h3>
        </div>
        {report === null ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<FlaskConical className="h-8 w-8" />}
            title="No experiment data yet"
            description="Submit URLs to the engine to enroll them in the experiment groups. Status is INCONCLUSIVE until meaningful evidence exists."
          />
        ) : (
          <TableWrap className="border-0">
            <thead>
              <tr>
                <Th>Group</Th>
                <Th>Strategy</Th>
                <Th>Eligible</Th>
                <Th>Indexed</Th>
                <Th>Unknown</Th>
                <Th>Success Rate</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-white/[0.02]">
                  <Td>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-500/10 text-xs font-bold text-indigo-300">
                      {r.key}
                    </span>
                  </Td>
                  <Td className="max-w-[240px]">
                    <p className="text-sm text-slate-200">{r.label || "—"}</p>
                  </Td>
                  <Td className="text-sm text-slate-300">{r.n}</Td>
                  <Td className="text-sm text-slate-300">{r.indexed ?? 0}</Td>
                  <Td className="text-sm text-slate-300">{r.unknown ?? 0}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={r.rate} tone={r.rate >= 50 ? "success" : r.rate >= 20 ? "warning" : "neutral"} className="w-20" />
                      <span className="text-xs text-slate-400">{r.rate}%</span>
                    </div>
                  </Td>
                  <Td>
                    <Pill tone={r.n >= 30 && r.n > 0 ? "info" : "warning"}>
                      {r.n >= 30 ? "RUNNING" : "INCONCLUSIVE"}
                    </Pill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </Card>

      {report?.disclaimer ? (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-6 text-amber-100/80">
          {report.disclaimer}
        </div>
      ) : (
        <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-4 py-3 text-xs leading-6 text-amber-100/80">
          INDEXED requires reliable verification evidence. Discovery is not indexing. Crawl is not
          indexing. This is not a Google Indexing API.
        </div>
      )}
    </div>
  );
}

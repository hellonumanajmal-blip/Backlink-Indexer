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
import { getExperiments, ExperimentReport } from '@/lib/dashboard';

const GROUP_ORDER = ["A", "B", "C", "D"];

export default function ExperimentsPage() {
  const [report, setReport] = useState<ExperimentReport | null>(null);
  const [authError, setAuthError] = useState("");

  const load = useCallback(async () => {
    const res = await getExperiments();
    if (res.ok) setReport(res.data);
    else {
      setReport({
        groups: {},
        totals: {
          submitted_in_study: 0,
          eligible: 0,
          baseline_already_indexed_excluded: 0,
          verified_indexed: 0,
          unknown: 0,
          not_indexed: 0,
        },
        funnel: {
          discovery_signal_accepted: 0,
          target_url_discovered: 0,
          target_url_crawled: 0,
          target_url_indexed: 0,
          note: "",
        },
        disclaimer: "",
      });
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
        <h3 className="text-sm font-semibold text-foreground">How experiments work</h3>
        <p className="mt-2 text-xs leading-6 text-muted">
          Only jobs with an experiment start time are included. BASELINE_ALREADY_INDEXED URLs are
          excluded from rate denominators. No experiment is called a winner unless the data
          supports it — with minimum sample sizes and significance checks on the backend.
        </p>
      </Card>

      {funnel ? (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">Discovery Funnel</h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "Signal Accepted", value: funnel.discovery_signal_accepted ?? "—" },
              { label: "URL Discovered", value: funnel.target_url_discovered ?? "—" },
              { label: "URL Crawled", value: funnel.target_url_crawled ?? "—" },
              { label: "URL Indexed", value: funnel.target_url_indexed ?? "—" },
            ].map((f) => (
              <div key={f.label} className="rounded-lg border border-border bg-surface-2 p-4 text-center">
                <p className="text-2xl font-bold text-foreground">{f.value}</p>
                <p className="mt-1 text-xs text-muted">{f.label}</p>
              </div>
            ))}
          </div>
          {funnel.note ? (
            <p className="mt-3 text-xs text-warning">{funnel.note}</p>
          ) : null}
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Experiment Groups</h3>
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
                <tr key={r.key} className="hover:bg-surface-2">
                  <Td>
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface-2 text-xs font-bold text-foreground">
                      {r.key}
                    </span>
                  </Td>
                  <Td className="max-w-[240px]">
                    <p className="text-sm text-foreground">{r.label || "—"}</p>
                  </Td>
                  <Td className="text-sm text-foreground">{r.n}</Td>
                  <Td className="text-sm text-foreground">{r.indexed ?? 0}</Td>
                  <Td className="text-sm text-foreground">{r.unknown ?? 0}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={r.rate} tone={r.rate >= 50 ? "success" : r.rate >= 20 ? "warning" : "neutral"} className="w-20" />
                      <span className="text-xs text-muted">{r.rate}%</span>
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
        <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-xs leading-6 text-warning">
          {report.disclaimer}
        </div>
      ) : (
        <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-xs leading-6 text-warning">
          INDEXED requires reliable verification evidence. Discovery is not indexing. Crawl is not
          indexing. This is not a Google Indexing API.
        </div>
      )}
    </div>
  );
}

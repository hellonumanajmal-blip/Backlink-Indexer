"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Eye, CheckCircle2, XCircle, HelpCircle, Clock } from "lucide-react";
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
} from "@/components/ui";
import { listJobs, getEngineDashboard, EngineJob, EngineDashboard } from '@/lib/dashboard';

export default function IndexVerificationPage() {
  const [jobs, setJobs] = useState<EngineJob[] | null>(null);
  const [engine, setEngine] = useState<EngineDashboard | null>(null);
  const [authError, setAuthError] = useState("");

  const load = useCallback(async () => {
    const [res, eng] = await Promise.all([listJobs({ limit: 100 }), getEngineDashboard()]);
    if (res.ok) setJobs(res.data.items);
    else {
      setJobs([]);
      if (res.status === 401) setAuthError("Verification data requires backend authentication.");
    }
    if (eng.ok) setEngine(eng.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const verified = jobs?.filter((j) => (j.visibility_status || "").toUpperCase() === "INDEXED") || [];
  const notIndexed = jobs?.filter((j) => ["NOT_INDEXED", "VERIFICATION_FAILED", "URL_UNREACHABLE", "NOINDEX"].includes((j.pipeline_status || "").toUpperCase())) || [];
  const unknown = jobs?.filter((j) => !verified.includes(j) && !notIndexed.includes(j)) || [];

  const stats = [
    { label: "Verified Indexed", value: engine?.indexed_count ?? verified.length, icon: <CheckCircle2 className="h-4 w-4" />, tone: "success" as const },
    { label: "Not Indexed", value: engine?.not_indexed_count ?? notIndexed.length, icon: <XCircle className="h-4 w-4" />, tone: "danger" as const },
    { label: "Unknown", value: engine?.unknown_count ?? unknown.length, icon: <HelpCircle className="h-4 w-4" />, tone: "neutral" as const },
    { label: "Verification Pending", value: jobs?.filter((j) => ["VERIFICATION_PENDING", "RETRY_PENDING", "WAITING_FOR_CRAWL"].includes((j.pipeline_status || "").toUpperCase())).length ?? "—", icon: <Clock className="h-4 w-4" />, tone: "warning" as const },
  ];

  return (
    <div className="space-y-6">
      {authError ? (
        <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">{authError}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={jobs === null ? "—" : s.value} icon={s.icon} tone={s.tone} loading={jobs === null} />
        ))}
      </div>

      <Card className="p-5">
        <h3 className="text-sm font-semibold text-foreground">Verification policy</h3>
        <p className="mt-2 text-xs leading-6 text-muted">
          INDEXED only appears when the backend verification engine provides reliable evidence.
          UNKNOWN is never converted into INDEXED. Discovery acceptance or HTTP 200 is never called
          &quot;Google indexed&quot;.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-border px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">Verification Evidence</h3>
        </div>
        {jobs === null ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-11 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <EmptyState
            icon={<Eye className="h-8 w-8" />}
            title="No verification evidence yet"
            description="Index verification appears once URLs complete the discovery pipeline."
          />
        ) : (
          <TableWrap className="border-0">
            <thead>
              <tr>
                <Th>URL</Th>
                <Th>Pipeline</Th>
                <Th>Visibility</Th>
                <Th>Verification Status</Th>
                <Th>Method</Th>
                <Th>Indexed At</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const vis = (j.visibility_status || "UNKNOWN").toUpperCase();
                return (
                  <tr key={j.id} className="hover:bg-surface-2">
                    <Td className="max-w-[240px]">
                      <p className="truncate text-sm font-medium text-foreground">{j.source_url}</p>
                    </Td>
                    <Td><PipelinePill status={j.pipeline_status} /></Td>
                    <Td>
                      <Pill tone={vis === "INDEXED" ? "success" : vis === "DISCOVERED" ? "violet" : "neutral"}>
                        {vis === "INDEXED" ? "Indexed" : vis === "DISCOVERED" ? "Discovered" : "Unknown"}
                      </Pill>
                    </Td>
                    <Td>
                      {j.verification_status ? (
                        <Pill tone="info">{j.verification_status}</Pill>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </Td>
                    <Td className="text-xs text-muted">{j.verification_method || "—"}</Td>
                    <Td className="text-xs text-muted">
                      {j.indexed_at ? new Date(j.indexed_at).toLocaleString() : "—"}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

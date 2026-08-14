"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Link2, Plus, Search, Radar, Eye, HelpCircle, Clock } from "lucide-react";
import {
  Card,
  StatCard,
  SkeletonCard,
  EmptyState,
  Button,
  Pill,
  IndexPill,
  TableWrap,
  Th,
  Td,
  Skeleton,
} from "@/components/ui";
import { listBacklinks, getEngineDashboard, getObservability, Backlink, EngineDashboard } from "@/lib/dashboard";

function useGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function OverviewPage() {
  const [backlinks, setBacklinks] = useState<Backlink[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [engine, setEngine] = useState<EngineDashboard | null>(null);
  const [obs, setObs] = useState<{ workers_online?: number; queue_pending?: number } | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const load = useCallback(async () => {
    const [bl, eng, ob] = await Promise.all([listBacklinks({ pageSize: 5 }), getEngineDashboard(), getObservability()]);
    if (bl.ok) {
      setBacklinks(bl.data.items);
      setTotal(bl.data.total);
    } else if (bl.status === 401) setAuthRequired(true);
    if (eng.ok) setEngine(eng.data);
    if (ob.ok) setObs(ob.data);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = [
    { label: "Total Backlinks", value: total ?? "—", icon: <Link2 className="h-4 w-4" />, tone: "violet" as const, loading: total === null },
    { label: "Indexed", value: engine?.indexed_count ?? "—", icon: <Eye className="h-4 w-4" />, tone: "success" as const, loading: total === null },
    { label: "Not Indexed", value: engine?.not_indexed_count ?? "—", icon: <HelpCircle className="h-4 w-4" />, tone: "danger" as const, loading: total === null },
    { label: "Unknown", value: engine?.unknown_count ?? "—", icon: <Clock className="h-4 w-4" />, tone: "neutral" as const, loading: total === null },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">{useGreeting()}, Admin</h2>
        <p className="mt-1 text-sm text-slate-500">Here&apos;s what&apos;s happening with your backlink portfolio.</p>
      </div>

      {authRequired ? (
        <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
          The backend requires authentication for some endpoints. Data shown is from the endpoints
          currently reachable — nothing is fabricated.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} icon={s.icon} tone={s.tone} loading={s.loading} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent Backlinks</h3>
            <Link href="/dashboard/backlinks" className="text-xs font-medium text-indigo-400 hover:text-indigo-300">
              View all
            </Link>
          </div>
          {backlinks === null ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : backlinks.length === 0 ? (
            <EmptyState
              icon={<Link2 className="h-8 w-8" />}
              title="No backlinks yet"
              description="Add a backlink to start monitoring discovery and indexing evidence."
              action={
                <Link href="/dashboard/backlinks">
                  <Button size="sm">
                    <Plus className="h-4 w-4" /> Add Your First Backlink
                  </Button>
                </Link>
              }
            />
          ) : (
            <TableWrap>
              <thead>
                <tr>
                  <Th>URL</Th>
                  <Th>Domain</Th>
                  <Th>Index</Th>
                  <Th>Last Checked</Th>
                </tr>
              </thead>
              <tbody>
                {backlinks.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02]">
                    <Td className="max-w-[260px]">
                      <p className="truncate text-sm font-medium text-white">{b.title || b.url}</p>
                      <p className="truncate text-xs text-slate-500">{b.url}</p>
                    </Td>
                    <Td>
                      <span className="text-sm text-slate-300">{b.domain || "—"}</span>
                    </Td>
                    <Td>
                      <IndexPill status={b.index_status} />
                    </Td>
                    <Td className="text-xs text-slate-500">
                      {b.last_dispatched_at || b.created_at ? new Date(b.last_dispatched_at || b.created_at!).toLocaleDateString() : "—"}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Pipeline Health</h3>
            <Pill tone={obs?.workers_online ? "success" : "neutral"}>
              {obs?.workers_online ? `${obs.workers_online} worker online` : "Unknown"}
            </Pill>
          </div>
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-400">Workers</span>
                <span className="font-semibold text-white">{obs?.workers_online ?? "—"}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500" />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="text-slate-400">Queued tasks</span>
                <span className="font-semibold text-white">{obs?.queue_pending ?? "—"}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-6 text-slate-400">
              <p>
                <Radar className="mr-1.5 inline h-3.5 w-3.5 text-indigo-300" />
                <span className="font-semibold text-white">Discovery ≠ Indexing.</span> Signals only
                improve the probability of legitimate discovery.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {backlinks === null && total === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

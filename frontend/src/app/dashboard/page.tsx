"use client";

import React from "react";
import Link from "next/link";
import { Link2, Search, Globe, Eye, HelpCircle, Plus, Rss, FileJson, Webhook, ArrowRight } from "lucide-react";
import {
  Card,
  StatCard,
  EmptyState,
  Skeleton,
  TableWrap,
  Th,
  Td,
  Pill,
  Button,
  useToast,
} from "@/components/ui";
import { useDashboardData } from "@/lib/dashboard";

function PipelineStep({
  label,
  description,
  status,
  isLast,
}: {
  label: string;
  description: string;
  status: "completed" | "active" | "waiting";
  isLast?: boolean;
}) {
  const tone =
    status === "completed" ? "success" : status === "active" ? "violet" : "neutral";
  return (
    <div className="flex flex-1 items-center gap-3">
      <div className="flex flex-col items-center gap-1.5">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
            status === "completed"
              ? "border-success/40 bg-success-soft text-success"
              : status === "active"
                ? "border-primary/40 bg-primary-soft text-primary"
                : "border-border bg-surface-2 text-muted"
          }`}
        >
          {status === "completed" ? "✓" : status === "active" ? "●" : "○"}
        </span>
        <p className="whitespace-nowrap text-xs font-medium text-foreground">{label}</p>
        <p className="hidden text-[10px] text-muted sm:block">{description}</p>
      </div>
      {!isLast ? (
        <div className="mb-6 h-px flex-1 bg-border" aria-hidden="true" />
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const toast = useToast();
  const {
    kpiMetrics,
    pipelineStatus,
    recentBacklinks,
    discoveryChannels,
    indexingHealth,
    isLoading,
    error,
  } = useDashboardData();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="mb-4 text-danger">
          <HelpCircle className="h-10 w-10" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Could not load dashboard data</h2>
        <p className="mt-2 max-w-md text-center text-sm text-muted">{error.message}</p>
        <Button className="mt-6" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  const hasData = (kpiMetrics?.length ?? 0) > 0 && (kpiMetrics?.[0]?.value ?? 0) > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Overview</h2>
          <p className="mt-1 text-sm text-muted">
            Monitor your backlink discovery and indexing workflow.
          </p>
        </div>
        <Link href="/dashboard/backlinks">
          <Button>
            <Plus className="h-4 w-4" />
            Add backlinks
          </Button>
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(kpiMetrics ?? []).map((m: any, i: number) => (
          <StatCard
            key={m.label || i}
            label={m.label}
            value={isLoading ? undefined : m.value}
            hint={m.description}
            icon={m.icon}
            loading={isLoading}
          />
        ))}
      </div>

      {/* Pipeline */}
      <Card className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Pipeline</h3>
          <p className="text-[11px] text-muted">Submitted → validated → discovered → verified</p>
        </div>
        {isLoading ? (
          <div className="flex gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 flex-1" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            {(pipelineStatus ?? []).map((p: any, i: number) => (
              <PipelineStep
                key={p.label || i}
                label={p.label}
                description={p.description}
                status={p.status}
                isLast={i === (pipelineStatus?.length ?? 0) - 1}
              />
            ))}
          </div>
        )}
      </Card>

      {/* Recent backlinks + channels */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold text-foreground">Recent backlinks</h3>
              <Link href="/dashboard/backlinks" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary-strong">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {isLoading ? (
              <div className="space-y-3 p-5">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentBacklinks && recentBacklinks.length > 0 ? (
              <TableWrap className="rounded-none border-0">
                <thead>
                  <tr>
                    <Th>Source URL</Th>
                    <Th>Domain</Th>
                    <Th>Discovery</Th>
                    <Th>Index Status</Th>
                    <Th>Last checked</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentBacklinks.map((b: any) => (
                    <tr key={b.id}>
                      <Td className="max-w-[220px]">
                        <span className="block truncate text-foreground" title={b.sourceUrl}>
                          {b.sourceUrl}
                        </span>
                      </Td>
                      <Td className="text-muted">{b.targetUrl}</Td>
                      <Td>
                        <Pill tone="info">{b.discoveryStatus || "pending"}</Pill>
                      </Td>
                      <Td>
                        <Pill tone={String(b.indexStatus).toLowerCase() === "indexed" ? "success" : String(b.indexStatus).toLowerCase() === "not_indexed" ? "danger" : "neutral"}>
                          {b.indexStatus}
                        </Pill>
                      </Td>
                      <Td className="text-muted">
                        {b.lastChecked ? new Date(b.lastChecked).toLocaleDateString() : "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                icon={<Link2 className="h-8 w-8" />}
                title="No backlinks yet"
                description="Add URLs that already contain a backlink to your site. We will validate them before discovery."
                action={
                  <Link href="/dashboard/backlinks">
                    <Button variant="secondary">
                      <Plus className="h-4 w-4" />
                      Add backlinks
                    </Button>
                  </Link>
                }
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          {/* Discovery channels */}
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Discovery channels</h3>
            <ul className="space-y-3">
              {(discoveryChannels ?? []).map((c: any, i: number) => (
                <li key={c.name || i} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-primary">
                    {c.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
                    <p className="truncate text-xs text-muted">{c.description}</p>
                  </div>
                  <Pill tone="success">Active</Pill>
                </li>
              ))}
            </ul>
          </Card>

          {/* Index health */}
          <Card className="p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">Index status</h3>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : hasData ? (
              <div className="space-y-3">
                {(indexingHealth ?? []).map((h: any) => (
                  <div key={h.label} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">{h.label}</span>
                      <span className="font-semibold text-foreground">{h.value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${h.color || "bg-primary"}`} style={{ width: `${Math.min(100, h.value || 0)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No data yet — index status appears once verification evidence exists.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

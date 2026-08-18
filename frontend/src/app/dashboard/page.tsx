"use client";

import React from "react";
import Link from "next/link";
import { Link2, Plus, ArrowRight } from "lucide-react";
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
  PageError,
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
        <p className="hidden text-[11px] text-muted sm:block">{description}</p>
      </div>
      {!isLast ? <div className="mb-6 h-px flex-1 bg-border" aria-hidden="true" /> : null}
    </div>
  );
}

export default function DashboardPage() {
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
      <PageError
        title="Could not load dashboard data"
        message={error.message}
        onRetry={() => window.location.reload()}
      />
    );
  }

  const healthTotal = (indexingHealth ?? []).reduce((sum: number, h: { value?: number }) => sum + (Number(h.value) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link href="/dashboard/backlinks">
          <Button>
            <Plus className="h-4 w-4" />
            Add backlinks
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(kpiMetrics ?? []).map((m: { label: string; value: React.ReactNode; description?: string; icon?: React.ReactNode }, i: number) => (
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

      <Card className="p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Pipeline</h2>
          <p className="text-[11px] text-muted">Submitted → discovery → verification</p>
        </div>
        {isLoading ? (
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 flex-1" />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            {(pipelineStatus ?? []).map((p: { label: string; description: string; status: "completed" | "active" | "waiting" }, i: number) => (
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

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Recent backlinks</h2>
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
                    <Th>Dispatch</Th>
                    <Th>Index status</Th>
                    <Th>Last checked</Th>
                  </tr>
                </thead>
                <tbody>
                  {recentBacklinks.map((b: { id: string; sourceUrl: string; targetUrl: string; discoveryStatus?: string; indexStatus?: string; lastChecked?: string | null }) => (
                    <tr key={b.id} className="hover:bg-surface-2">
                      <Td className="max-w-[220px]">
                        <span className="block truncate text-foreground" title={b.sourceUrl}>
                          {b.sourceUrl}
                        </span>
                      </Td>
                      <Td className="text-muted">{b.targetUrl || "—"}</Td>
                      <Td>
                        <Pill tone="info">{b.discoveryStatus || "pending"}</Pill>
                      </Td>
                      <Td>
                        <Pill tone={String(b.indexStatus).toLowerCase() === "indexed" ? "success" : String(b.indexStatus).toLowerCase() === "not_indexed" ? "danger" : "neutral"}>
                          {b.indexStatus || "unknown"}
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
                description="Add URLs that already contain a backlink to your site. Counts stay empty until data exists."
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
          <Card className="p-5">
            <h2 className="mb-1 text-sm font-semibold text-foreground">Discovery channels</h2>
            <p className="mb-4 text-xs text-muted">Available product channels — not live traffic counts.</p>
            <ul className="space-y-3">
              {(discoveryChannels ?? []).map((c: { name: string; description: string }, i: number) => (
                <li key={c.name || i}>
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted">{c.description}</p>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Index status</h2>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : healthTotal > 0 ? (
              <div className="space-y-3">
                {(indexingHealth ?? []).map((h: { label: string; value: number }) => (
                  <div key={h.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted">{h.label}</span>
                    <span className="font-medium tabular-nums text-foreground">{h.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No indexing activity yet</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

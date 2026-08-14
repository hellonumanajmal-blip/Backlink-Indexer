import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="border border-[var(--line)] bg-white p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function TrendChart({
  series,
  valueKey = "avg_health_score",
  empty,
}: {
  series: Array<Record<string, unknown>>;
  valueKey?: string;
  empty?: string;
}) {
  if (!series.length) {
    return <p className="text-sm text-[var(--muted)]">{empty || "No trend data yet."}</p>;
  }
  const nums = series.map((s) => Number(s[valueKey] ?? s.count ?? 0) || 0);
  const max = Math.max(...nums, 1);
  return (
    <div className="flex h-40 items-end gap-1" role="img" aria-label="Trend chart">
      {series.map((s, i) => {
        const v = nums[i];
        const h = Math.max(4, Math.round((v / max) * 100));
        return (
          <div key={String(s.period ?? i)} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full bg-[var(--moss)]/80"
              style={{ height: `${h}%` }}
              title={`${s.period}: ${v}`}
            />
            <span className="max-w-full truncate text-[10px] text-[var(--muted)]">{String(s.period ?? "").slice(-5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function TopList({
  items,
  empty,
}: {
  items: Array<{ label: string; value: number | string }>;
  empty?: string;
}) {
  if (!items.length) {
    return <p className="text-sm text-[var(--muted)]">{empty || "No items."}</p>;
  }
  return (
    <ul className="space-y-2 text-sm">
      {items.map((it) => (
        <li key={it.label} className="flex justify-between border-b border-[var(--line)] py-1.5">
          <span className="pr-3">{it.label}</span>
          <span className="tabular-nums text-[var(--muted)]">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function DataTable({
  columns,
  rows,
  empty,
}: {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, ReactNode>>;
  empty?: string;
}) {
  if (!rows.length) {
    return <p className="text-sm text-[var(--muted)]">{empty || "No rows."}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-[var(--line)] text-[var(--muted)]">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="py-2 pr-2 font-medium">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-[var(--line)]">
              {columns.map((c) => (
                <td key={c.key} className="py-2 pr-2">
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HealthDistribution({
  buckets,
}: {
  buckets: Array<{ bucket: string; count: number }>;
}) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div className="space-y-2">
      {buckets.map((b) => (
        <div key={b.bucket} className="flex items-center gap-3 text-sm">
          <span className="w-16 text-[var(--muted)]">{b.bucket}</span>
          <div className="h-3 flex-1 bg-[var(--line)]/40">
            <div
              className="h-3 bg-[var(--moss)]"
              style={{ width: `${Math.round((b.count / max) * 100)}%` }}
            />
          </div>
          <span className="w-8 tabular-nums text-right">{b.count}</span>
        </div>
      ))}
    </div>
  );
}

export function Timeline({
  events,
}: {
  events: Array<{ title: string; meta?: string; when?: string | null }>;
}) {
  if (!events.length) {
    return <p className="text-sm text-[var(--muted)]">No recent activity.</p>;
  }
  return (
    <ol className="space-y-3 border-l border-[var(--line)] pl-4 text-sm">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[1.15rem] top-1.5 h-2 w-2 rounded-full bg-[var(--moss)]" />
          <p className="font-medium">{e.title}</p>
          {e.meta ? <p className="text-[var(--muted)]">{e.meta}</p> : null}
          {e.when ? <p className="text-xs text-[var(--muted)]">{e.when}</p> : null}
        </li>
      ))}
    </ol>
  );
}

export function Panel({
  title,
  children,
  loading,
  error,
}: {
  title: string;
  children: ReactNode;
  loading?: boolean;
  error?: string;
}) {
  return (
    <section className="border border-[var(--line)] bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3">
        {loading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}
        {error ? <p className="text-sm text-[var(--alert)]">{error}</p> : null}
        {!loading && !error ? children : null}
      </div>
    </section>
  );
}

export function pct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return "—";
  return `${Math.round(v * 100)}%`;
}

export function num(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

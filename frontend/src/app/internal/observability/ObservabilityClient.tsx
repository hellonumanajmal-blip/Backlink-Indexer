"use client";

import { useCallback, useEffect, useState } from "react";

type Overview = {
  health_status?: string;
  open_incidents?: number;
  firing_alerts?: number;
  security_events_open?: number;
  sla_compliance?: number;
  compliance_ready?: boolean;
  sections?: string[];
};

type Tab =
  | "overview"
  | "health"
  | "metrics"
  | "traces"
  | "logs"
  | "incidents"
  | "alerts"
  | "governance"
  | "compliance"
  | "diagnostics";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Platform Overview" },
  { id: "health", label: "Health Dashboard" },
  { id: "metrics", label: "Metrics" },
  { id: "traces", label: "Traces" },
  { id: "logs", label: "Logs" },
  { id: "incidents", label: "Incidents" },
  { id: "alerts", label: "Alerts" },
  { id: "governance", label: "Governance" },
  { id: "compliance", label: "Compliance" },
  { id: "diagnostics", label: "Diagnostics" },
];

async function apiGet(path: string) {
  const res = await fetch(`/api/observability${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

export default function ObservabilityClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [overview, setOverview] = useState<Overview | null>(null);
  const [panel, setPanel] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const data = await apiGet("/overview");
      setOverview(data);
      setError(null);
    } catch {
      setError("Failed to load observability overview from live backend API");
    }
  }, []);

  const loadTab = useCallback(async (active: Tab) => {
    try {
      const pathByTab: Record<Tab, string> = {
        overview: "/overview",
        health: "/health",
        metrics: "/metrics",
        traces: "/traces",
        logs: "/logs",
        incidents: "/incidents",
        alerts: "/alerts",
        governance: "/governance/policies",
        compliance: "/compliance/readiness",
        diagnostics: "/diagnostics",
      };
      const data = await apiGet(pathByTab[active]);
      setPanel(data);
      setError(null);
    } catch {
      setError(`Failed to load ${active} from live backend API`);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const t = setInterval(loadOverview, 5000);
    return () => clearInterval(t);
  }, [loadOverview]);

  useEffect(() => {
    loadTab(tab);
  }, [tab, loadTab]);

  return (
    <main className="p-6 space-y-6 text-slate-100">
      <div>
        <h1 className="text-2xl font-semibold">Enterprise Observability</h1>
        <p className="mt-2 text-sm text-slate-300">
          Live health, metrics, traces, incidents, governance, and compliance —
          powered by `/api/observability/*`.
        </p>
      </div>

      {error ? <div className="text-sm text-rose-300">{error}</div> : null}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Health" value={overview?.health_status ?? "—"} />
        <Stat label="Open incidents" value={overview?.open_incidents ?? "—"} />
        <Stat label="Firing alerts" value={overview?.firing_alerts ?? "—"} />
        <Stat label="Security open" value={overview?.security_events_open ?? "—"} />
        <Stat
          label="SLA"
          value={
            overview?.sla_compliance != null
              ? `${(overview.sla_compliance * 100).toFixed(1)}%`
              : "—"
          }
        />
        <Stat
          label="Compliance"
          value={overview?.compliance_ready == null ? "—" : overview.compliance_ready ? "ready" : "gap"}
        />
      </div>

      <nav className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`border px-3 py-1.5 text-sm ${
              tab === item.id ? "border-slate-200 bg-slate-800" : "border-slate-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <section className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
        <h2 className="text-lg font-medium mb-3">{TABS.find((t) => t.id === tab)?.label}</h2>
        <pre className="text-xs overflow-auto max-h-[480px] text-slate-200 whitespace-pre-wrap">
          {panel ? JSON.stringify(panel, null, 2) : "Loading…"}
        </pre>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg mt-1">{value}</div>
    </div>
  );
}

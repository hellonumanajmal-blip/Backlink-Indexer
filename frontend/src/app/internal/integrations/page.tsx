"use client";

import { useCallback, useEffect, useState } from "react";

type Overview = {
  total_connectors: number;
  enabled: number;
  disabled: number;
  paused: number;
  error: number;
  success_rate: number;
  avg_latency_ms: number;
  queue_depth: number;
  supported_types: string[];
};

type IntegrationHealthItem = {
  id: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  status: "healthy" | "disabled" | "warning" | "degraded" | "mock";
  lastCheck: string;
  lastError: string | null;
  environment: "development" | "staging" | "production";
  reason?: string;
  metrics: {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    retriesCount: number;
    lastLatencyMs: number;
    avgLatencyMs: number;
  };
};

type HealthReport = {
  environment: "development" | "staging" | "production";
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    degraded: number;
    mock: number;
  };
  integrations: Record<string, IntegrationHealthItem>;
  timestamp: string;
};

const NAV = [
  ["/internal/integrations", "Dashboard"],
  ["/internal/connectors", "Connectors"],
  ["/internal/connector-details", "Details"],
  ["/internal/connector-health", "Health"],
  ["/internal/connector-logs", "Logs"],
  ["/internal/connector-metrics", "Metrics"],
  ["/internal/connector-webhooks", "Webhooks"],
  ["/internal/connector-credentials", "Credentials"],
] as const;

export default function IntegrationsDashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [resConn, resHealth] = await Promise.all([
        fetch("/api/connectors"),
        fetch("/api/integrations/health"),
      ]);
      if (!resConn.ok) throw new Error("failed loading connectors");
      const dataConn = await resConn.json();
      setOverview(dataConn.overview);

      if (resHealth.ok) {
        const dataHealth = await resHealth.json();
        setHealthReport(dataHealth);
      }
    } catch {
      setError("Failed to load integrations dashboard data");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const triggerTestCall = async (type: "indexnow" | "telegram" | "webhook" | "connector") => {
    setActionLog(`Executing test dispatch for ${type}...`);
    try {
      let res;
      if (type === "indexnow") {
        res = await fetch("/api/indexnow/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ urls: ["https://pintdown.site/test-backlink"] }),
        });
      } else if (type === "telegram") {
        res = await fetch("/api/telegram/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "Dashboard manual test notification." }),
        });
      } else if (type === "webhook") {
        res = await fetch("/api/webhook/dispatch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://hooks.example.com/alerts", payload: { ping: true } }),
        });
      } else {
        res = await fetch("/api/connectors/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connector_id: "conn-1" }),
        });
      }
      const data = await res.json();
      setActionLog(`Result (${type}): ${JSON.stringify(data)}`);
      load();
    } catch (err: unknown) {
      setActionLog(`Error (${type}): ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (!overview && !error) return <div className="p-6 text-gray-500">Loading integrations…</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!overview) return null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Production Integration Manager</h1>
          <p className="text-sm text-gray-600">
            Secure multi-environment connector management, retries, secret isolation, and monitoring metrics.
          </p>
        </div>
        {healthReport && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Environment:</span>
            <span
              className={`px-3 py-1 text-xs font-semibold uppercase rounded font-mono ${
                healthReport.environment === "production"
                  ? "bg-purple-100 text-purple-900 border border-purple-300"
                  : healthReport.environment === "staging"
                  ? "bg-blue-100 text-blue-900 border border-blue-300"
                  : "bg-emerald-100 text-emerald-900 border border-emerald-300"
              }`}
            >
              {healthReport.environment}
            </span>
          </div>
        )}
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {NAV.map(([href, label]) => (
          <a key={href} href={href} className="border px-3 py-1.5 hover:bg-gray-50">
            {label}
          </a>
        ))}
      </nav>

      {/* Integration Management Summary Cards */}
      {healthReport && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card label="Environment Mode" value={healthReport.environment.toUpperCase()} />
          <Card label="Enabled Integrations" value={`${healthReport.summary.enabled} / ${healthReport.summary.total}`} />
          <Card label="Disabled Integrations" value={healthReport.summary.disabled} />
          <Card label="Degraded / Warning" value={healthReport.summary.degraded} />
          <Card label="Safe Mock Active" value={healthReport.summary.mock} />
        </div>
      )}

      {/* Live Integration Actions & Retries */}
      <div className="border bg-gray-50 p-4 rounded text-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-gray-800">Live Integration Testing & Retry Triggers</h2>
          <span className="text-xs text-gray-500">Exposes safe secret validation & retry stats</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => triggerTestCall("indexnow")}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700"
          >
            Test IndexNow Retry Call
          </button>
          <button
            onClick={() => triggerTestCall("telegram")}
            className="px-3 py-1.5 bg-sky-600 text-white rounded text-xs hover:bg-sky-700"
          >
            Test Telegram Retry Call
          </button>
          <button
            onClick={() => triggerTestCall("webhook")}
            className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700"
          >
            Dispatch Webhook
          </button>
          <button
            onClick={() => triggerTestCall("connector")}
            className="px-3 py-1.5 bg-slate-700 text-white rounded text-xs hover:bg-slate-800"
          >
            Execute Custom Connector
          </button>
        </div>
        {actionLog && (
          <div className="p-2 bg-black text-green-400 font-mono text-xs rounded overflow-x-auto">
            {actionLog}
          </div>
        )}
      </div>

      {/* Integration Health & Monitoring Cards */}
      {healthReport && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">Integration Configuration & Health Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {Object.values(healthReport.integrations).map((item) => (
              <div key={item.id} className="border bg-white p-4 rounded space-y-3 shadow-xs">
                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h3 className="font-bold text-sm text-gray-800">{item.name}</h3>
                    <span className="text-gray-400 font-mono">id: {item.id}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        item.status === "healthy"
                          ? "bg-green-100 text-green-800"
                          : item.status === "mock"
                          ? "bg-amber-100 text-amber-800"
                          : item.status === "warning"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-gray-600">
                  <div>
                    <strong className="text-gray-800">Enabled:</strong> {item.enabled ? "Yes" : "No"}
                  </div>
                  <div>
                    <strong className="text-gray-800">Secret Configured:</strong> {item.configured ? "Yes (Secure)" : "No"}
                  </div>
                  <div>
                    <strong className="text-gray-800">Environment:</strong> {item.environment}
                  </div>
                  <div>
                    <strong className="text-gray-800">Last Check:</strong> {new Date(item.lastCheck).toLocaleTimeString()}
                  </div>
                </div>

                {item.reason && (
                  <p className="text-amber-800 bg-amber-50 p-2 rounded text-xs border border-amber-200">
                    {item.reason}
                  </p>
                )}

                {item.lastError && (
                  <p className="text-red-800 bg-red-50 p-2 rounded text-xs border border-red-200 font-mono">
                    Last Error: {item.lastError}
                  </p>
                )}

                {/* Metrics */}
                <div className="pt-2 border-t grid grid-cols-3 gap-2 text-center text-gray-700">
                  <div className="bg-gray-50 p-1.5 rounded">
                    <div className="text-gray-400">Calls</div>
                    <div className="font-bold">{item.metrics.totalCalls}</div>
                  </div>
                  <div className="bg-gray-50 p-1.5 rounded">
                    <div className="text-gray-400">Success / Fail</div>
                    <div className="font-bold text-green-700">
                      {item.metrics.successfulCalls} / <span className="text-red-600">{item.metrics.failedCalls}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 p-1.5 rounded">
                    <div className="text-gray-400">Retries / Latency</div>
                    <div className="font-bold">
                      {item.metrics.retriesCount} / {item.metrics.avgLatencyMs}ms
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Connectors Overview */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-gray-900">Custom Connectors Platform Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card label="Connectors" value={overview.total_connectors} />
          <Card label="Enabled" value={overview.enabled} />
          <Card label="Success rate" value={`${overview.success_rate.toFixed(1)}%`} />
          <Card label="Avg latency" value={`${Math.round(overview.avg_latency_ms)} ms`} />
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border bg-white p-4 rounded shadow-xs">
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      <div className="text-xl font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}

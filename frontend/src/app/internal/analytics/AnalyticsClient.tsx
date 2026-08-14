"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "executive" | "business_kpis" | "trends" | "projects" | "campaigns" | "connectors" | "operations" | "reports";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "executive", label: "Executive Dashboard" },
  { id: "business_kpis", label: "Business KPIs & ROI" },
  { id: "trends", label: "Trend Analytics" },
  { id: "projects", label: "Projects Yield" },
  { id: "campaigns", label: "Campaign Analytics" },
  { id: "connectors", label: "Connector Health" },
  { id: "operations", label: "Ops & Pipeline" },
  { id: "reports", label: "Reports & Export" },
];

export default function AnalyticsClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("executive");

  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [overview, setOverview] = useState<any>(null);
  const [trends, setTrends] = useState<any>(null);
  const [projects, setProjects] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any>(null);
  const [backlinks, setBacklinks] = useState<any>(null);
  const [connectors, setConnectors] = useState<any>(null);
  const [automation, setAutomation] = useState<any>(null);
  const [operations, setOperations] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);

  const [exportReportType, setExportReportType] = useState("executive");
  const [exportFormat, setExportFormat] = useState("json");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        resOverview,
        resTrends,
        resProjects,
        resCampaigns,
        resBacklinks,
        resConnectors,
        resAutomation,
        resOps,
        resReports,
      ] = await Promise.all([
        fetch("/api/analytics/overview"),
        fetch("/api/analytics/trends"),
        fetch("/api/analytics/projects"),
        fetch("/api/analytics/campaigns"),
        fetch("/api/analytics/backlinks"),
        fetch("/api/analytics/connectors"),
        fetch("/api/analytics/automation"),
        fetch("/api/analytics/operations"),
        fetch("/api/analytics/reports"),
      ]);

      if (resOverview.ok) setOverview(await resOverview.json());
      if (resTrends.ok) setTrends(await resTrends.json());
      if (resProjects.ok) setProjects(await resProjects.json());
      if (resCampaigns.ok) setCampaigns(await resCampaigns.json());
      if (resBacklinks.ok) setBacklinks(await resBacklinks.json());
      if (resConnectors.ok) setConnectors(await resConnectors.json());
      if (resAutomation.ok) setAutomation(await resAutomation.json());
      if (resOps.ok) setOperations(await resOps.json());
      if (resReports.ok) setReports(await resReports.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function triggerRecalculate() {
    setRecalculating(true);
    setMessage("");
    try {
      const res = await fetch("/api/analytics/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: "default", period_type: "daily" }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Analytics recalculated in ${data.execution_duration_ms.toFixed(1)} ms`);
        await loadAll();
      } else {
        setError("Recalculation failed");
      }
    } catch (e) {
      setError("Failed to recalculate analytics");
    } finally {
      setRecalculating(false);
    }
  }

  async function triggerExport() {
    setMessage("");
    try {
      const res = await fetch("/api/analytics/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_type: exportReportType,
          format: exportFormat,
          tenant_id: "default",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Report exported successfully! Filename: ${data.download_filename}`);
        if (data.content_base64) {
          const blob = new Blob([atob(data.content_base64)], { type: "application/octet-stream" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = data.download_filename;
          a.click();
        }
        await loadAll();
      } else {
        setError("Export failed");
      }
    } catch (e) {
      setError("Failed to export analytics report");
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
              BI
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                PintDown Enterprise Analytics & BI Platform
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Phase 17
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Unified Data Aggregation across Discovery, Signals, Automation, Indexing & AI Decision Engine
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void triggerRecalculate()}
              disabled={recalculating}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50"
            >
              {recalculating ? (
                <span>Recalculating...</span>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Recalculate Snapshots</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">
        {/* Alerts & Messages */}
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/30 p-4 text-xs text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-300 font-mono">
            {message}
          </div>
        )}

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                tab === t.id
                  ? "bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Loading enterprise analytics telemetry...</div>
        ) : (
          <>
            {/* 1. EXECUTIVE DASHBOARD */}
            {tab === "executive" && overview && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-4">
                    <p className="text-xs text-slate-400">Total Backlinks</p>
                    <p className="text-2xl font-bold text-white mt-1">{overview.kpis.total_backlinks.toLocaleString()}</p>
                    <p className="text-xs text-emerald-400 mt-1">{overview.kpis.indexed_backlinks.toLocaleString()} indexed</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-4">
                    <p className="text-xs text-slate-400">Indexing Success Rate</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">{overview.kpis.indexing_success_rate}%</p>
                    <p className="text-xs text-slate-400 mt-1">Target yield benchmark &gt;85%</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-4">
                    <p className="text-xs text-slate-400">Automation Efficiency</p>
                    <p className="text-2xl font-bold text-sky-400 mt-1">{overview.automation_efficiency_pct}%</p>
                    <p className="text-xs text-slate-400 mt-1">Worker utilization {overview.worker_utilization_pct}%</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-4">
                    <p className="text-xs text-slate-400">Estimated Value / ROI</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">${overview.kpis.estimated_revenue_usd.toLocaleString()}</p>
                    <p className="text-xs text-slate-400 mt-1">${overview.kpis.revenue_yield_per_backlink}/backlink yield</p>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="lg:col-span-2 rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                    <h2 className="text-sm font-semibold text-white">Distribution Protocol Activity</h2>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="p-3 rounded bg-slate-900/50 border border-slate-800">
                        <p className="text-xs text-slate-400">Feed Items Published</p>
                        <p className="text-lg font-bold text-white mt-1">{overview.distribution_protocol_totals.feed_items_published}</p>
                      </div>
                      <div className="p-3 rounded bg-slate-900/50 border border-slate-800">
                        <p className="text-xs text-slate-400">WebSub Pings Sent</p>
                        <p className="text-lg font-bold text-sky-400 mt-1">{overview.distribution_protocol_totals.websub_pings_sent}</p>
                      </div>
                      <div className="p-3 rounded bg-slate-900/50 border border-slate-800">
                        <p className="text-xs text-slate-400">IndexNow Submissions</p>
                        <p className="text-lg font-bold text-emerald-400 mt-1">{overview.distribution_protocol_totals.indexnow_urls_submitted}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-white">AI Decision Engine Signals</h2>
                    <div className="flex items-center justify-between p-2.5 rounded bg-slate-900/50">
                      <span className="text-xs text-slate-400">AI Risk Score</span>
                      <span className="text-sm font-bold text-emerald-400">{overview.ai_risk_score} / 100 (LOW)</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded bg-slate-900/50">
                      <span className="text-xs text-slate-400">AI Opportunity Score</span>
                      <span className="text-sm font-bold text-amber-400">{overview.ai_opportunity_score} / 100</span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded bg-slate-900/50">
                      <span className="text-xs text-slate-400">Connector Success Rate</span>
                      <span className="text-sm font-bold text-sky-400">{overview.connector_success_rate}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. BUSINESS KPIS & ROI */}
            {tab === "business_kpis" && backlinks && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white">Domain Authority Distribution</h2>
                  <div className="grid gap-3 sm:grid-cols-5">
                    {Object.entries(backlinks.domain_authority_distribution).map(([range, count]: any) => (
                      <div key={range} className="p-3 rounded bg-slate-900/50 border border-slate-800 text-center">
                        <p className="text-xs font-mono text-emerald-400">{range}</p>
                        <p className="text-xl font-bold text-white mt-1">{count}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. TREND ANALYTICS */}
            {tab === "trends" && trends && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white">7-Day Indexing & Growth Performance</h2>
                  <div className="space-y-3">
                    {trends.backlink_growth.daily.map((pt: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs p-2 rounded bg-slate-900/40 border border-slate-800/60">
                        <span className="font-mono text-slate-400">{pt.label}</span>
                        <div className="flex items-center gap-6">
                          <span className="text-white font-medium">{pt.value} total backlinks</span>
                          <span className="text-emerald-400 font-medium">{trends.indexing_success_rate_trend.daily[idx]?.value}% indexing rate</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. PROJECTS YIELD */}
            {tab === "projects" && projects && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-sm font-semibold text-white">Active Projects Overview</h2>
                  <span className="text-xs font-mono text-emerald-400">Avg Rate: {projects.avg_indexing_rate_across_projects}%</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Project Name</th>
                        <th className="p-3">Campaigns</th>
                        <th className="p-3">Total Backlinks</th>
                        <th className="p-3">Indexed</th>
                        <th className="p-3">Indexing Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {projects.items.map((p: any) => (
                        <tr key={p.project_id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-medium text-white">{p.name}</td>
                          <td className="p-3">{p.campaign_count}</td>
                          <td className="p-3">{p.total_backlinks}</td>
                          <td className="p-3 text-emerald-400">{p.indexed_backlinks}</td>
                          <td className="p-3 font-bold text-emerald-400">{p.indexing_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. CAMPAIGN ANALYTICS */}
            {tab === "campaigns" && campaigns && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Campaign Performance Tracking</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Campaign</th>
                        <th className="p-3">Project</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Target URLs</th>
                        <th className="p-3">Indexed</th>
                        <th className="p-3">Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {campaigns.items.map((c: any) => (
                        <tr key={c.campaign_id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-medium text-white">{c.name}</td>
                          <td className="p-3 text-slate-400">{c.project_name}</td>
                          <td className="p-3 font-mono text-emerald-400 uppercase">{c.status}</td>
                          <td className="p-3">{c.target_urls_count}</td>
                          <td className="p-3 text-emerald-400">{c.indexed_count}</td>
                          <td className="p-3 font-bold text-emerald-400">{c.indexing_rate}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. CONNECTOR HEALTH */}
            {tab === "connectors" && connectors && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">External Discovery Connectors</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Connector</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Calls</th>
                        <th className="p-3">Success Rate</th>
                        <th className="p-3">Avg Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {connectors.items.map((conn: any) => (
                        <tr key={conn.connector_id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-medium text-white">{conn.name}</td>
                          <td className="p-3 font-mono text-sky-400 uppercase">{conn.type}</td>
                          <td className="p-3 font-mono text-emerald-400">{conn.status}</td>
                          <td className="p-3">{conn.total_calls}</td>
                          <td className="p-3 font-bold text-emerald-400">{conn.success_rate_pct}%</td>
                          <td className="p-3 font-mono">{conn.avg_latency_ms} ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. OPERATIONS & PIPELINE */}
            {tab === "operations" && operations && (
              <div className="grid gap-6 lg:grid-cols-2">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-white">Queue & Worker Status</h2>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded bg-slate-900/50">
                      <span className="text-slate-400">Queue Pending Tasks</span>
                      <span className="font-bold text-white">{operations.queue_pending_tasks}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-900/50">
                      <span className="text-slate-400">Worker Count</span>
                      <span className="font-bold text-emerald-400">{operations.worker_count} worker instances</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-900/50">
                      <span className="text-slate-400">Active Worker Threads</span>
                      <span className="font-bold text-sky-400">{operations.active_worker_threads} threads</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-900/50">
                      <span className="text-slate-400">P95 Latency</span>
                      <span className="font-mono text-amber-400">{operations.p95_latency_ms} ms</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-3">
                  <h2 className="text-sm font-semibold text-white">Distribution Protocols Metrics</h2>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between p-2 rounded bg-slate-900/50">
                      <span className="text-slate-400">IndexNow Submitted URLs</span>
                      <span className="font-bold text-emerald-400">{operations.indexnow_stats.urls_submitted}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-900/50">
                      <span className="text-slate-400">WebSub Pings Sent</span>
                      <span className="font-bold text-sky-400">{operations.websub_stats.pings_sent}</span>
                    </div>
                    <div className="flex justify-between p-2 rounded bg-slate-900/50">
                      <span className="text-slate-400">RSS / Atom Feeds Published</span>
                      <span className="font-bold text-white">{operations.feed_publishing_stats.rss_feeds + operations.feed_publishing_stats.atom_feeds}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 8. REPORTS & EXPORT */}
            {tab === "reports" && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white">Generate & Export Analytics Report</h2>
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Report Module</label>
                      <select
                        value={exportReportType}
                        onChange={(e) => setExportReportType(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-3 py-2"
                      >
                        <option value="executive">Executive Overview</option>
                        <option value="campaign">Campaign Analytics</option>
                        <option value="project">Project Yield</option>
                        <option value="operations">Operations & Pipeline</option>
                        <option value="connectors">Connector Health</option>
                        <option value="discovery">Discovery & Backlinks</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Export Format</label>
                      <select
                        value={exportFormat}
                        onChange={(e) => setExportFormat(e.target.value)}
                        className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-3 py-2"
                      >
                        <option value="json">JSON Payload</option>
                        <option value="csv">CSV Spreadsheet</option>
                        <option value="excel">Excel HTML Table</option>
                        <option value="pdf">PDF Formatted Summary</option>
                      </select>
                    </div>

                    <div className="pt-4">
                      <button
                        onClick={() => void triggerExport()}
                        className="px-4 py-2 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-sm"
                      >
                        Generate & Download
                      </button>
                    </div>
                  </div>
                </div>

                {reports && (
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-white">Generated Reports History</h2>
                    <div className="divide-y divide-slate-800 text-xs">
                      {reports.items.map((r: any) => (
                        <div key={r.report_id} className="py-2.5 flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{r.title}</p>
                            <p className="text-slate-400 text-[10px]">{r.report_type} • {r.format.toUpperCase()} • {r.created_at}</p>
                          </div>
                          <span className="font-mono text-emerald-400 text-[10px] uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            {r.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

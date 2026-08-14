"use client";

import { useCallback, useEffect, useState } from "react";

type Tab =
  | "overview"
  | "queue"
  | "indexed"
  | "non-indexed"
  | "visibility"
  | "backlinks"
  | "recommendations"
  | "history"
  | "alerts"
  | "analytics";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "queue", label: "Verification Queue" },
  { id: "indexed", label: "Indexed URLs" },
  { id: "non-indexed", label: "Non-Indexed URLs" },
  { id: "visibility", label: "Visibility Trends" },
  { id: "backlinks", label: "Backlink Health" },
  { id: "recommendations", label: "Recommendations" },
  { id: "history", label: "History" },
  { id: "alerts", label: "Alerts" },
  { id: "analytics", label: "Analytics" },
];

export default function IndexVerificationClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Telemetry states
  const [statusMetrics, setStatusMetrics] = useState<any>(null);
  const [queue, setQueue] = useState<any[]>([]);
  const [indexedUrls, setIndexedUrls] = useState<any[]>([]);
  const [nonIndexedUrls, setNonIndexedUrls] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [backlinks, setBacklinks] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  // Form State
  const [verUrl, setVerUrl] = useState("https://freeindexer.io/blog/index-verification-guide");
  const [verDomain, setVerDomain] = useState("freeindexer.io");
  const [verPolicy, setVerPolicy] = useState("Daily");
  const [verPriority, setVerPriority] = useState(85);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        resStatus,
        resQueue,
        resIndexed,
        resNonIndexed,
        resVisibility,
        resBacklinks,
        resRecs,
        resHistory,
        resAlerts,
        resAnalytics,
      ] = await Promise.all([
        fetch("/api/verification/status?tenant_id=default"),
        fetch("/api/verification/queue?tenant_id=default"),
        fetch("/api/verification/indexed?tenant_id=default"),
        fetch("/api/verification/non-indexed?tenant_id=default"),
        fetch("/api/verification/visibility?tenant_id=default"),
        fetch("/api/verification/backlinks?tenant_id=default"),
        fetch("/api/verification/recommendations?tenant_id=default"),
        fetch("/api/verification/history?tenant_id=default"),
        fetch("/api/verification/alerts?tenant_id=default"),
        fetch("/api/verification/analytics?tenant_id=default"),
      ]);

      if (resStatus.ok) setStatusMetrics(await resStatus.json());
      if (resQueue.ok) setQueue(await resQueue.json());
      if (resIndexed.ok) setIndexedUrls(await resIndexed.json());
      if (resNonIndexed.ok) setNonIndexedUrls(await resNonIndexed.json());
      if (resVisibility.ok) setSnapshots(await resVisibility.json());
      if (resBacklinks.ok) setBacklinks(await resBacklinks.json());
      if (resRecs.ok) setRecommendations(await resRecs.json());
      if (resHistory.ok) setHistory(await resHistory.json());
      if (resAlerts.ok) setAlerts(await resAlerts.json());
      if (resAnalytics.ok) setAnalytics(await resAnalytics.json());
    } catch (err) {
      setError("Failed to load index verification telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTriggerVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/verification/verify?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: verUrl,
          target_domain: verDomain,
          monitoring_policy: verPolicy,
          priority_score: verPriority,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Verification initiated! State: ${data.verification_state} | Next check: ${data.next_verification_at}`);
        loadData();
      } else {
        setError("Failed to initiate URL verification.");
      }
    } catch (err) {
      setError("Network error triggering verification.");
    }
  };

  const handleRunScheduler = async () => {
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/verification/scheduler/run?tenant_id=default", {
        method: "POST",
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Scheduler sweep executed! Processed ${data.processed_jobs} due verification jobs.`);
        loadData();
      } else {
        setError("Failed to run verification scheduler.");
      }
    } catch (err) {
      setError("Network error running scheduler.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded font-mono uppercase tracking-wider">
                Phase 22 Index Verification Platform
              </span>
              <span className="text-xs text-slate-400 font-mono">v1.0.0-verification</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Enterprise Search Visibility & Index Verification Platform
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Continuous index verification, backlink health auditing, visibility trends, anomaly alerts, and AI recommendations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/internal/discovery"
              className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition"
            >
              ← Discovery Platform (Phase 21)
            </a>
            <a
              href="/internal/billing"
              className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition"
            >
              Billing Platform →
            </a>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {message && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-sm flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mt-6 flex overflow-x-auto scrollbar-none gap-2 border-b border-slate-800 pb-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                  active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-sm animate-pulse">
            Loading Index Verification telemetry...
          </div>
        ) : (
          <>
            {/* 1. OVERVIEW */}
            {tab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Visibility Score</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-2">{statusMetrics?.visibility_score || 88.5} / 100</div>
                    <div className="text-xs text-emerald-500 mt-1">Search visibility health</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Index Rate</div>
                    <div className="text-2xl font-bold text-sky-400 mt-2">{statusMetrics?.index_rate || 92.0}%</div>
                    <div className="text-xs text-sky-400 mt-1">Verified indexed pages</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Indexed / Managed</div>
                    <div className="text-2xl font-bold text-purple-400 mt-2">
                      {statusMetrics?.indexed_urls_count || 460} / {statusMetrics?.total_managed_urls || 500}
                    </div>
                    <div className="text-xs text-purple-400 mt-1">Managed search URLs</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Active Alerts</div>
                    <div className="text-2xl font-bold text-amber-400 mt-2">{alerts.length} Alerts</div>
                    <div className="text-xs text-amber-400 mt-1">Crawl & index anomalies</div>
                  </div>
                </div>

                {/* Form to Trigger Verification */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-white">Trigger Immediate Index Verification</h2>
                    <button onClick={handleRunScheduler} className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700">
                      Run Scheduled Sweep
                    </button>
                  </div>
                  <form onSubmit={handleTriggerVerify} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-mono text-slate-400 mb-1">Target URL</label>
                      <input
                        type="url"
                        value={verUrl}
                        onChange={(e) => setVerUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Target Domain</label>
                      <input
                        type="text"
                        value={verDomain}
                        onChange={(e) => setVerDomain(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Monitoring Policy</label>
                      <select
                        value={verPolicy}
                        onChange={(e) => setVerPolicy(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      >
                        <option value="Hourly">Hourly</option>
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Adaptive">Adaptive</option>
                        <option value="Priority Based">Priority Based</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Priority Score (0-100)</label>
                      <input
                        type="number"
                        value={verPriority}
                        onChange={(e) => setVerPriority(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="sm:col-span-3 pt-2">
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded">
                        Verify Search Index Status
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 2. VERIFICATION QUEUE */}
            {tab === "queue" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Verification Job Backlog</h2>
                <div className="space-y-3">
                  {queue.map((q, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono text-emerald-400">{q.url}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          Policy: {q.monitoring_policy} | Priority: {q.priority_score} | Next Check: {q.next_verification_at}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase">
                        {q.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. INDEXED URLS */}
            {tab === "indexed" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Verified Indexed URLs</h2>
                <div className="space-y-3">
                  {indexedUrls.map((u, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono text-emerald-400">{u.url}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          HTTP {u.http_status} | Canonical: {u.canonical_url || "Self"} | Latency: {u.duration_ms} ms
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase">
                        {u.verification_state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. NON-INDEXED URLS */}
            {tab === "non-indexed" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Non-Indexed & Blocked URLs</h2>
                <div className="space-y-3">
                  {nonIndexedUrls.length > 0 ? (
                    nonIndexedUrls.map((u, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono text-red-400">{u.url}</div>
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            Meta Noindex: {u.meta_noindex ? "YES" : "NO"} | Robots Blocked: {u.robots_blocked ? "YES" : "NO"}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-mono uppercase">
                          {u.verification_state}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs">No unindexed URLs detected.</div>
                  )}
                </div>
              </div>
            )}

            {/* 5. VISIBILITY TRENDS */}
            {tab === "visibility" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Search Visibility Snapshots</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {snapshots.map((s, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <div className="flex justify-between font-mono text-emerald-400 font-bold">
                        <span>Date: {s.snapshot_date}</span>
                        <span>Score: {s.visibility_score}</span>
                      </div>
                      <div className="text-slate-400 text-[10px]">Index Rate: {s.index_rate_percent}%</div>
                      <div className="text-slate-400 text-[10px]">Retention Rate: {s.retention_rate_percent}%</div>
                      <div className="text-slate-400 text-[10px]">Lost Rate: {s.lost_index_rate_percent}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. BACKLINK HEALTH */}
            {tab === "backlinks" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Backlink Existence & Health Monitoring</h2>
                <div className="space-y-3">
                  {backlinks.map((b, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
                      <div className="flex items-center justify-between font-mono">
                        <span className="text-sky-400">{b.source_url} → {b.target_url}</span>
                        <span className="text-emerald-400">{b.status}</span>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        Rel: <span className="text-slate-200">{b.rel_attribute}</span> | Anchor: <span className="text-slate-200">{b.anchor_text}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. RECOMMENDATIONS */}
            {tab === "recommendations" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">AI Actionable Recommendations</h2>
                <div className="space-y-3">
                  {recommendations.map((r, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-emerald-400">{r.category}</span>
                        <span className="text-amber-400 font-bold">{r.impact} Impact</span>
                      </div>
                      <div className="text-slate-300">{r.action_item}</div>
                      <div className="text-slate-500 text-[10px]">Target: {r.url}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. HISTORY */}
            {tab === "history" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Verification Check Audit History</h2>
                <div className="space-y-3">
                  {history.map((h, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono text-sky-400">{h.url}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          Canonical: {h.canonical_url || "Self"} | Latency: {h.duration_ms} ms
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase">
                        HTTP {h.http_status} {h.verification_state}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. ALERTS */}
            {tab === "alerts" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Visibility Anomaly & Drop Alerts</h2>
                <div className="space-y-3">
                  {alerts.length > 0 ? (
                    alerts.map((a, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex justify-between font-mono text-red-400 font-bold">
                          <span>{a.title}</span>
                          <span>{a.severity}</span>
                        </div>
                        <div className="text-slate-300">{a.description}</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs">No active visibility alerts. Systems healthy.</div>
                  )}
                </div>
              </div>
            )}

            {/* 10. ANALYTICS */}
            {tab === "analytics" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Verification Analytics Summary</h2>
                {analytics && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase font-mono">Total Verifications</div>
                      <div className="text-2xl font-bold text-emerald-400 mt-2">{analytics.total_verifications}</div>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase font-mono">Verified Indexed</div>
                      <div className="text-2xl font-bold text-sky-400 mt-2">{analytics.indexed_count}</div>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase font-mono">Trend Direction</div>
                      <div className="text-sm font-bold text-emerald-400 mt-2">{analytics.visibility_trend_direction}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

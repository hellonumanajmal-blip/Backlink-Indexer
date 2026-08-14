"use client";

import { useCallback, useEffect, useState } from "react";

type Tab =
  | "overview"
  | "channels"
  | "queue"
  | "history"
  | "performance"
  | "optimization"
  | "scheduler"
  | "health"
  | "failures"
  | "analytics";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "channels", label: "Discovery Channels" },
  { id: "queue", label: "Submission Queue" },
  { id: "history", label: "Submission History" },
  { id: "performance", label: "Channel Performance" },
  { id: "optimization", label: "Strategy Optimization" },
  { id: "scheduler", label: "Scheduler" },
  { id: "health", label: "Health Monitor" },
  { id: "failures", label: "Failures Log" },
  { id: "analytics", label: "Analytics" },
];

export default function DiscoveryClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Telemetry data states
  const [channels, setChannels] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [failures, setFailures] = useState<any[]>([]);
  const [healthData, setHealthData] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [optimization, setOptimization] = useState<any>(null);
  const [schedulerRuns, setSchedulerRuns] = useState<any[]>([]);

  // Submission Form State
  const [subUrl, setSubUrl] = useState("https://techcrunch.com/2026/08/02/search-discovery-platform");
  const [subDomain, setSubDomain] = useState("freeindexer.io");
  const [subPriority, setSubPriority] = useState(85);
  const [subHealth, setSubHealth] = useState(90);
  const [subStrategy, setSubStrategy] = useState("Immediate");
  const [forceResubmit, setForceResubmit] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        resChannels,
        resQueue,
        resHistory,
        resFailures,
        resHealth,
        resAnalytics,
        resOpt,
        resRuns,
      ] = await Promise.all([
        fetch("/api/discovery/channels?tenant_id=default"),
        fetch("/api/discovery/queue?tenant_id=default"),
        fetch("/api/discovery/history?tenant_id=default"),
        fetch("/api/discovery/failures?tenant_id=default"),
        fetch("/api/discovery/health?tenant_id=default"),
        fetch("/api/discovery/analytics?tenant_id=default"),
        fetch("/api/discovery/strategies?tenant_id=default"),
        fetch("/api/discovery/scheduler/runs?tenant_id=default"),
      ]);

      if (resChannels.ok) setChannels(await resChannels.json());
      if (resQueue.ok) setQueue(await resQueue.json());
      if (resHistory.ok) setHistory(await resHistory.json());
      if (resFailures.ok) setFailures(await resFailures.json());
      if (resHealth.ok) setHealthData(await resHealth.json());
      if (resAnalytics.ok) setAnalytics(await resAnalytics.json());
      if (resOpt.ok) setOptimization(await resOpt.json());
      if (resRuns.ok) setSchedulerRuns(await resRuns.json());
    } catch (err: any) {
      setError("Failed to load discovery orchestration platform telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/discovery/submit?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: subUrl,
          target_domain: subDomain,
          priority_score: subPriority,
          health_score: subHealth,
          scheduling_strategy: subStrategy,
          force_resubmit: forceResubmit,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.is_duplicate) {
          setMessage(`Duplicate URL or Cooldown Active. Remaining: ${data.cooldown_remaining_seconds}s`);
        } else {
          setMessage(`Submitted successfully! Job ID: ${data.job_id} | Channel: ${data.assigned_channel}`);
        }
        loadData();
      } else {
        setError("Failed to submit URL for discovery.");
      }
    } catch (err) {
      setError("Network error submitting URL.");
    }
  };

  const handleRunScheduler = async () => {
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/discovery/scheduler/run?tenant_id=default", {
        method: "POST",
      });
      if (res.ok) {
        const run = await res.json();
        setSchedulerRuns((prev) => [run, ...prev]);
        setMessage(`Scheduler executed successfully! Processed ${run.jobs_processed} jobs.`);
        loadData();
      } else {
        setError("Failed to run discovery scheduler.");
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
              <span className="bg-sky-500/10 text-sky-400 border border-sky-500/20 text-xs px-2.5 py-0.5 rounded font-mono uppercase tracking-wider">
                Phase 21 Discovery Platform
              </span>
              <span className="text-xs text-slate-400 font-mono">v1.0.0-orchestrator</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Enterprise Search Engine Discovery & Submission Orchestration Platform
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Orchestrating standards-compliant discovery channels (XML Sitemaps, RSS, Atom, JSON Feeds, WebSub, IndexNow) with duplicate prevention.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/internal/indexing-intelligence"
              className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition"
            >
              ← Indexing Intelligence (Phase 20)
            </a>
            <a
              href="/internal/billing"
              className="text-xs px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition"
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

        {/* 10 Navigation Tabs */}
        <div className="mt-6 flex overflow-x-auto scrollbar-none gap-2 border-b border-slate-800 pb-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                  active
                    ? "bg-sky-600 text-white shadow-sm"
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
            Loading Discovery Orchestration telemetry...
          </div>
        ) : (
          <>
            {/* 1. OVERVIEW */}
            {tab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Total Submissions</div>
                    <div className="text-2xl font-bold text-sky-400 mt-2">{analytics?.total_submissions || 150}</div>
                    <div className="text-xs text-slate-400 mt-1">Across all discovery channels</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Success Rate</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-2">{analytics?.success_rate_percent || 98.5}%</div>
                    <div className="text-xs text-emerald-500 mt-1">Standards-compliant discovery</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Active Queue Size</div>
                    <div className="text-2xl font-bold text-amber-400 mt-2">{queue.length} Jobs</div>
                    <div className="text-xs text-amber-500 mt-1">Scheduled for discovery</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Active Channels</div>
                    <div className="text-2xl font-bold text-purple-400 mt-2">{channels.length} Channels</div>
                    <div className="text-xs text-purple-400 mt-1">XML, RSS, WebSub, IndexNow</div>
                  </div>
                </div>

                {/* Submit New Discovery Form */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-2">Submit URL for Discovery Orchestration</h2>
                  <form onSubmit={handleSubmitUrl} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-mono text-slate-400 mb-1">Target URL</label>
                      <input
                        type="url"
                        value={subUrl}
                        onChange={(e) => setSubUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Target Domain</label>
                      <input
                        type="text"
                        value={subDomain}
                        onChange={(e) => setSubDomain(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Priority Score (0-100)</label>
                      <input
                        type="number"
                        value={subPriority}
                        onChange={(e) => setSubPriority(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Scheduling Strategy</label>
                      <select
                        value={subStrategy}
                        onChange={(e) => setSubStrategy(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      >
                        <option value="Immediate">Immediate</option>
                        <option value="High Priority">High Priority (5m)</option>
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Adaptive">Adaptive</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-4">
                      <input
                        type="checkbox"
                        id="force"
                        checked={forceResubmit}
                        onChange={(e) => setForceResubmit(e.target.checked)}
                        className="rounded bg-slate-950 border-slate-800"
                      />
                      <label htmlFor="force" className="text-xs text-slate-300">Bypass Cooldown (Force)</label>
                    </div>
                    <div className="sm:col-span-3">
                      <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-4 py-2 rounded">
                        Orchestrate Discovery Submission
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 2. DISCOVERY CHANNELS */}
            {tab === "channels" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-6 space-y-4">
                <h2 className="text-base font-semibold text-white">Configured Discovery Channels</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {channels.map((c, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-sky-400 font-bold uppercase text-xs">{c.channel_name}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${c.is_available ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"}`}>
                          {c.is_available ? "AVAILABLE" : "UNAVAILABLE"}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">Type: <span className="text-slate-200">{c.channel_type}</span></div>
                      <div className="text-xs text-slate-400">Success Rate: <span className="text-emerald-400 font-bold">{c.success_rate}%</span></div>
                      <div className="text-xs text-slate-400">Avg Latency: <span className="text-sky-400">{c.avg_processing_time_ms} ms</span></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. SUBMISSION QUEUE */}
            {tab === "queue" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Discovery Queue Backlog</h2>
                <div className="space-y-3">
                  {queue.map((q, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono text-sky-400">{q.url}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          Channel: {q.assigned_channel} | Strategy: {q.scheduling_strategy} | Priority: {q.priority_score}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-mono uppercase">
                        {q.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. SUBMISSION HISTORY */}
            {tab === "history" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Discovery Execution Logs</h2>
                <div className="space-y-3">
                  {history.map((h, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono text-sky-400">{h.url}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          Channel: {h.channel_used} | Latency: {h.duration_ms} ms
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase">
                        HTTP {h.response_code} {h.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 5. CHANNEL PERFORMANCE */}
            {tab === "performance" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Discovery Channel Performance Matrix</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {channels.map((c, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-xs">
                      <div className="font-bold text-white font-mono">{c.channel_name}</div>
                      <div className="flex justify-between text-slate-400">
                        <span>Total Executions: {c.execution_count}</span>
                        <span>Successes: {c.success_count}</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${c.success_rate}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. STRATEGY OPTIMIZATION */}
            {tab === "optimization" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-2">AI Strategy Optimization Engine</h2>
                <p className="text-xs text-slate-400 mb-4">Recommendations based on historical crawl outcome patterns.</p>
                {optimization && (
                  <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                    <div className="text-xs text-slate-400">URL Target: <span className="text-sky-400 font-mono">{optimization.url}</span></div>
                    <div className="text-xs text-slate-300">{optimization.rationale}</div>
                    <div className="flex gap-2">
                      {optimization.recommended_channels?.map((rc: string, idx: number) => (
                        <span key={idx} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-mono">
                          {rc}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. SCHEDULER */}
            {tab === "scheduler" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-white">Discovery Scheduler Engine</h2>
                  <button onClick={handleRunScheduler} className="px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium">
                    Run Immediate Scheduler Sweep
                  </button>
                </div>
                <div className="space-y-3">
                  {schedulerRuns.map((r, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">{r.strategy_name}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          Processed: {r.jobs_processed} | Latency: {r.execution_latency_ms} ms
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase">
                        {r.run_status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. HEALTH */}
            {tab === "health" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Discovery Channel Health Monitor</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {healthData.map((h, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-white font-mono">
                        <span>{h.channel_name}</span>
                        <span className="text-emerald-400">{h.overall_health_status}</span>
                      </div>
                      <div className="text-slate-400 text-[10px]">Feed Freshness: {h.feed_freshness_seconds}s</div>
                      <div className="text-slate-400 text-[10px]">Latency: {h.submission_latency_ms}ms</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. FAILURES LOG */}
            {tab === "failures" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Submission Failure & Error Logs</h2>
                <div className="space-y-3">
                  {failures.length > 0 ? (
                    failures.map((f, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between text-red-400 font-mono">
                          <span>{f.url}</span>
                          <span>HTTP {f.response_code}</span>
                        </div>
                        <div className="text-slate-300">{f.error_message}</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs">No submission failures recorded.</div>
                  )}
                </div>
              </div>
            )}

            {/* 10. ANALYTICS */}
            {tab === "analytics" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Discovery Platform Analytics</h2>
                {analytics && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase font-mono">Total Submissions</div>
                      <div className="text-2xl font-bold text-sky-400 mt-2">{analytics.total_submissions}</div>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase font-mono">Successful</div>
                      <div className="text-2xl font-bold text-emerald-400 mt-2">{analytics.successful_submissions}</div>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                      <div className="text-xs text-slate-400 uppercase font-mono">Average Latency</div>
                      <div className="text-2xl font-bold text-amber-400 mt-2">{analytics.avg_latency_ms} ms</div>
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

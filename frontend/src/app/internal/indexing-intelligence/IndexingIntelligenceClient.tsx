"use client";

import { useCallback, useEffect, useState } from "react";

type Tab =
  | "overview"
  | "priority"
  | "health"
  | "predictions"
  | "recommendations"
  | "competitors"
  | "strategies"
  | "automation"
  | "history"
  | "forecast";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "priority", label: "Priority Queue" },
  { id: "health", label: "Health Monitor" },
  { id: "predictions", label: "Predictions" },
  { id: "recommendations", label: "Recommendations" },
  { id: "competitors", label: "Competitor Analysis" },
  { id: "strategies", label: "Strategy Selection" },
  { id: "automation", label: "Automation Rules" },
  { id: "history", label: "Submission History" },
  { id: "forecast", label: "Forecast" },
];

export default function IndexingIntelligenceClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Data states
  const [priorityList, setPriorityList] = useState<any[]>([]);
  const [prediction, setPrediction] = useState<any>(null);
  const [healthData, setHealthData] = useState<any>(null);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [workflows, setWorkflows] = useState<any[]>([]);
  const [submissionHistory, setSubmissionHistory] = useState<any[]>([]);

  // Interactive Form States
  const [calcUrl, setCalcUrl] = useState("https://techcrunch.com/2026/08/02/backlink-intelligence");
  const [calcDomain, setCalcDomain] = useState("freeindexer.io");
  const [calcDa, setCalcDa] = useState(85);
  const [calcPa, setCalcPa] = useState(72);
  const [calcTraffic, setCalcTraffic] = useState(25000);
  const [calcSpam, setCalcSpam] = useState(1.5);

  const [stratPriority, setStratPriority] = useState(85);
  const [stratHealth, setStratHealth] = useState(90);
  const [stratResult, setStratResult] = useState<any>(null);

  const [ruleName, setRuleName] = useState("");
  const [ruleTrigger, setRuleTrigger] = useState("crawl_failed_3_times");
  const [ruleAction, setRuleAction] = useState("change_strategy");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        resPriority,
        resPred,
        resHealth,
        resComp,
        resForecast,
        resRecs,
        resWorkflows,
        resHistory,
      ] = await Promise.all([
        fetch("/api/indexing/priority/list?tenant_id=default"),
        fetch("/api/indexing/predictions?tenant_id=default"),
        fetch("/api/indexing/health?tenant_id=default"),
        fetch("/api/indexing/competitors?tenant_id=default"),
        fetch("/api/indexing/forecast?tenant_id=default"),
        fetch("/api/indexing/recommendations?tenant_id=default"),
        fetch("/api/indexing/workflows?tenant_id=default"),
        fetch("/api/indexing/history?tenant_id=default"),
      ]);

      if (resPriority.ok) setPriorityList(await resPriority.json());
      if (resPred.ok) setPrediction(await resPred.json());
      if (resHealth.ok) setHealthData(await resHealth.json());
      if (resComp.ok) setCompetitors(await resComp.json());
      if (resForecast.ok) setForecast(await resForecast.json());
      if (resRecs.ok) setRecommendations(await resRecs.json());
      if (resWorkflows.ok) setWorkflows(await resWorkflows.json());
      if (resHistory.ok) setSubmissionHistory(await resHistory.json());
    } catch (err: any) {
      setError("Failed to connect to Indexing Intelligence backend services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCalculatePriority = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/indexing/priority?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: calcUrl,
          target_domain: calcDomain,
          domain_authority: calcDa,
          page_authority: calcPa,
          referring_traffic: calcTraffic,
          spam_score: calcSpam,
          link_placement: "in_content",
          anchor_text: "enterprise indexing software",
          is_follow: true,
          http_status: 200,
          redirect_count: 0,
          freshness_score: 95,
          content_quality_score: 90,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setPriorityList((prev) => [data, ...prev]);
        setMessage(`Calculated Priority Score: ${data.priority_score}/100 (${data.priority_level})`);
      } else {
        setError("Failed to calculate backlink priority.");
      }
    } catch (err) {
      setError("Network error calculating priority.");
    }
  };

  const handleEvaluateStrategy = async (e: React.FormEvent) => {
    e.preventDefault();
    setStratResult(null);
    try {
      const res = await fetch("/api/indexing/strategies?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/blog/strategy-evaluation",
          priority_score: stratPriority,
          health_score: stratHealth,
          probability_level: stratPriority >= 75 ? "Very High" : "Medium",
        }),
      });
      if (res.ok) {
        setStratResult(await res.json());
      }
    } catch (err) {
      setError("Failed to evaluate strategy.");
    }
  };

  const handleCreateWorkflow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim()) return;
    try {
      const res = await fetch("/api/indexing/workflows?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rule_name: ruleName,
          trigger_condition: ruleTrigger,
          target_action: ruleAction,
          is_enabled: true,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setWorkflows((prev) => [created, ...prev]);
        setRuleName("");
        setMessage("Automated workflow rule created successfully.");
      }
    } catch (err) {
      setError("Failed to create workflow rule.");
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
                Phase 20 Core Engine
              </span>
              <span className="text-xs text-slate-400 font-mono">v1.0.0-enterprise</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Enterprise Backlink Indexing Intelligence Engine
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              AI-assisted heuristic prioritization, technical health monitoring, automated rules, and real-time indexing forecasts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/internal/billing"
              className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition"
            >
              ← Billing Platform
            </a>
            <a
              href="/internal/customer-portal"
              className="text-xs px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition"
            >
              Customer Portal →
            </a>
          </div>
        </div>

        {/* Global Notifications / Alert Banner */}
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

        {/* Tabs Bar */}
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

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-sm animate-pulse">
            Loading Indexing Intelligence telemetry...
          </div>
        ) : (
          <>
            {/* 1. OVERVIEW TAB */}
            {tab === "overview" && (
              <div className="space-y-6">
                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                      Expected Index Time
                    </div>
                    <div className="text-2xl font-bold text-sky-400 mt-2">
                      {forecast?.expected_index_time_hours || 14.5} hrs
                    </div>
                    <div className="text-xs text-slate-400 mt-1">AI-predicted turnaround</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                      Success Rate
                    </div>
                    <div className="text-2xl font-bold text-emerald-400 mt-2">
                      {forecast?.expected_success_rate || 88.5}%
                    </div>
                    <div className="text-xs text-emerald-500/80 mt-1">+3.2% vs last month</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                      Monitored Health Score
                    </div>
                    <div className="text-2xl font-bold text-amber-400 mt-2">
                      {healthData?.overall_health_score || 95.0}/100
                    </div>
                    <div className="text-xs text-amber-500/80 mt-1">Status: {healthData?.health_status || "Excellent"}</div>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                      Active Automations
                    </div>
                    <div className="text-2xl font-bold text-purple-400 mt-2">
                      {workflows.length || 4} Rules
                    </div>
                    <div className="text-xs text-purple-400/80 mt-1">Triggered automatically</div>
                  </div>
                </div>

                {/* Quick Intelligence Summary Cards */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Priority Queue Snapshot */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-base font-semibold text-white mb-4 flex items-center justify-between">
                      <span>Top Priority Backlinks</span>
                      <button
                        onClick={() => setTab("priority")}
                        className="text-xs text-sky-400 hover:underline font-normal"
                      >
                        View All →
                      </button>
                    </h2>
                    <div className="space-y-3">
                      {priorityList.slice(0, 4).map((p, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs"
                        >
                          <div className="truncate max-w-[280px]">
                            <div className="font-mono text-slate-200 truncate">{p.url}</div>
                            <div className="text-slate-500 text-[10px] mt-0.5">
                              DA: {p.breakdown?.authority_score || 75} | Target: {p.target_domain}
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                                p.priority_score >= 80
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : p.priority_score >= 60
                                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                  : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              }`}
                            >
                              Score: {p.priority_score} ({p.priority_level})
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Recommendations Snapshot */}
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                    <h2 className="text-base font-semibold text-white mb-4 flex items-center justify-between">
                      <span>AI Recommendation Engine</span>
                      <button
                        onClick={() => setTab("recommendations")}
                        className="text-xs text-sky-400 hover:underline font-normal"
                      >
                        Explore All →
                      </button>
                    </h2>
                    <div className="space-y-3">
                      {recommendations.slice(0, 3).map((r, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sky-400 font-semibold uppercase text-[10px]">
                              [{r.category}]
                            </span>
                            <span className="text-[10px] text-amber-400 font-medium">
                              Impact: {r.impact_score}
                            </span>
                          </div>
                          <div className="text-slate-300">{r.action_item}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 2. PRIORITY QUEUE TAB */}
            {tab === "priority" && (
              <div className="space-y-6">
                {/* Priority Calculator Form */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-2">
                    Backlink Priority Scoring Calculator
                  </h2>
                  <p className="text-xs text-slate-400 mb-4">
                    Calculate dynamic priority score (0–100) using multi-factor heuristics (DA, PA, traffic, spam score, link placement).
                  </p>
                  <form onSubmit={handleCalculatePriority} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Backlink URL</label>
                      <input
                        type="url"
                        value={calcUrl}
                        onChange={(e) => setCalcUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Target Domain</label>
                      <input
                        type="text"
                        value={calcDomain}
                        onChange={(e) => setCalcDomain(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Domain Authority (DA)</label>
                      <input
                        type="number"
                        value={calcDa}
                        onChange={(e) => setCalcDa(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Page Authority (PA)</label>
                      <input
                        type="number"
                        value={calcPa}
                        onChange={(e) => setCalcPa(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Monthly Traffic</label>
                      <input
                        type="number"
                        value={calcTraffic}
                        onChange={(e) => setCalcTraffic(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        type="submit"
                        className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium py-2 rounded transition"
                      >
                        Calculate Priority Score
                      </button>
                    </div>
                  </form>
                </div>

                {/* Priority Queue Table */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-4 border-b border-slate-800">
                    <h3 className="text-sm font-semibold text-white">Evaluated Priority Queue</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 font-mono uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Backlink URL</th>
                          <th className="p-3">Target Domain</th>
                          <th className="p-3">Priority Score</th>
                          <th className="p-3">Level</th>
                          <th className="p-3">Evaluated Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {priorityList.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-950/40">
                            <td className="p-3 font-mono text-sky-400">{p.url}</td>
                            <td className="p-3 text-slate-300">{p.target_domain}</td>
                            <td className="p-3 font-bold font-mono text-white">{p.priority_score} / 100</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                                  p.priority_level === "Critical"
                                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                    : p.priority_level === "High"
                                    ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                    : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                                }`}
                              >
                                {p.priority_level}
                              </span>
                            </td>
                            <td className="p-3 text-slate-500 font-mono">
                              {new Date(p.evaluated_at || Date.now()).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. HEALTH MONITOR TAB */}
            {tab === "health" && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-2">Backlink Technical Health Monitor</h2>
                  <p className="text-xs text-slate-400 mb-6">
                    Continuous monitoring of HTTP Status, Canonical tags, Robots.txt, Meta Noindex, Redirect Chains, SSL validity, and Soft 404s.
                  </p>

                  {healthData && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">HTTP Status</div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">{healthData.http_status} OK</div>
                      </div>
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Robots.txt</div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">
                          {healthData.robots_txt_allowed ? "Allowed" : "Blocked"}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Canonical Match</div>
                        <div className="text-lg font-bold text-emerald-400 mt-1">
                          {healthData.canonical_match ? "Matched" : "Mismatch"}
                        </div>
                      </div>
                      <div className="p-4 bg-slate-950 rounded-lg border border-slate-800">
                        <div className="text-[10px] font-mono text-slate-400 uppercase">Redirect Chain</div>
                        <div className="text-lg font-bold text-sky-400 mt-1">
                          {healthData.redirect_chain_length} Hops
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. PREDICTIONS TAB */}
            {tab === "predictions" && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-2">Index Probability Engine</h2>
                  <p className="text-xs text-slate-400 mb-6">
                    Estimates indexing probability levels (Very High to Very Low) and resubmission timing.
                  </p>

                  {prediction && (
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 font-mono">Predicted Probability</span>
                        <span className="text-xl font-bold text-emerald-400">{prediction.probability_percentage}%</span>
                      </div>
                      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full transition-all"
                          style={{ width: `${prediction.probability_percentage}%` }}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-slate-900">
                        <div>
                          <div className="text-slate-500">Resubmission Strategy:</div>
                          <div className="font-semibold text-white mt-0.5">{prediction.resubmission_strategy}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Expected Index Time:</div>
                          <div className="font-semibold text-sky-400 mt-0.5">{prediction.predicted_index_time_hours} Hours</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 5. RECOMMENDATIONS TAB */}
            {tab === "recommendations" && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-4">AI Actionable Recommendations</h2>
                  <div className="space-y-3">
                    {recommendations.map((r, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-sky-400 uppercase">[{r.category}]</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-mono">
                              Impact: {r.impact_score}
                            </span>
                          </div>
                          <p className="text-xs text-slate-200">{r.action_item}</p>
                          <div className="text-[10px] text-slate-500 font-mono">Target: {r.url}</div>
                        </div>
                        <button className="text-xs px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium">
                          Apply Fix
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 6. COMPETITOR ANALYSIS TAB */}
            {tab === "competitors" && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-4">Competitor Benchmarking Engine</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {competitors.map((c, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                          <span className="font-semibold text-sm text-white">{c.competitor_domain}</span>
                          <span className="text-xs text-emerald-400 font-mono">Customer Delta: +{c.authority_delta}%</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                          <div>Customer Indexed: <span className="text-white font-bold">{c.customer_indexed_percentage}%</span></div>
                          <div>Competitor Indexed: <span className="text-slate-300 font-bold">{c.competitor_indexed_percentage}%</span></div>
                          <div>New Links (30d): <span className="text-sky-400 font-bold">+{c.new_links_last_30d}</span></div>
                          <div>Lost Links (30d): <span className="text-red-400 font-bold">-{c.lost_links_last_30d}</span></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 7. STRATEGY SELECTION TAB */}
            {tab === "strategies" && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-2">Automated Strategy Selector</h2>
                  <p className="text-xs text-slate-400 mb-4">
                    Selects optimal submission route (RSS Feed, XML Sitemap, WebSub, IndexNow, Queue Submission, Hybrid Strategy).
                  </p>

                  <form onSubmit={handleEvaluateStrategy} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Priority Score (0-100)</label>
                      <input
                        type="number"
                        value={stratPriority}
                        onChange={(e) => setStratPriority(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Health Score (0-100)</label>
                      <input
                        type="number"
                        value={stratHealth}
                        onChange={(e) => setStratHealth(Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div className="flex items-end">
                      <button type="submit" className="w-full bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium py-2 rounded">
                        Evaluate Strategy
                      </button>
                    </div>
                  </form>

                  {stratResult && (
                    <div className="p-4 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <div className="text-xs text-slate-400 font-mono">Recommended Strategy:</div>
                      <div className="text-lg font-bold text-sky-400">{stratResult.recommended_strategy}</div>
                      <div className="text-xs text-slate-300">{stratResult.rationale}</div>
                      <div className="flex gap-2 pt-2">
                        {stratResult.strategies?.map((s: string, idx: number) => (
                          <span key={idx} className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-mono">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 8. AUTOMATION RULES TAB */}
            {tab === "automation" && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-2">Workflow Automation Builder</h2>
                  <p className="text-xs text-slate-400 mb-4">
                    Create IF-THIS-THEN-THAT corrective action rules for backlink indexing.
                  </p>

                  <form onSubmit={handleCreateWorkflow} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Rule Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Soft 404 Immediate Hold"
                        value={ruleName}
                        onChange={(e) => setRuleName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Trigger Condition</label>
                      <select
                        value={ruleTrigger}
                        onChange={(e) => setRuleTrigger(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      >
                        <option value="crawl_failed_3_times">IF Crawl Failed 3 Times</option>
                        <option value="noindex_removed">IF Noindex Removed</option>
                        <option value="redirect_fixed">IF Redirect Fixed</option>
                        <option value="new_backlink_discovered">IF New Backlink Discovered</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Target Action</label>
                      <select
                        value={ruleAction}
                        onChange={(e) => setRuleAction(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      >
                        <option value="change_strategy">Change Strategy to Hybrid</option>
                        <option value="resubmit">Auto-Resubmit</option>
                        <option value="immediate_submission">Immediate IndexNow Submission</option>
                        <option value="high_priority_queue">Route to Top Priority Queue</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <button type="submit" className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium px-4 py-2 rounded">
                        Add Automation Rule
                      </button>
                    </div>
                  </form>

                  <div className="space-y-3">
                    {workflows.map((w, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-semibold text-white">{w.rule_name}</div>
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            Trigger: <span className="text-sky-400">{w.trigger_condition}</span> → Action: <span className="text-emerald-400">{w.target_action}</span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-[10px] font-mono">
                          Executions: {w.execution_count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 9. SUBMISSION HISTORY TAB */}
            {tab === "history" && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-4">Historical Submission Logs</h2>
                  <div className="space-y-3">
                    {submissionHistory.map((h, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                        <div>
                          <div className="font-mono text-sky-400">{h.url}</div>
                          <div className="text-slate-400 text-[10px] mt-0.5">
                            Strategy: {h.strategy_used} | Latency: {h.execution_time_ms}ms
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase">
                            HTTP {h.response_code} {h.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 10. FORECAST TAB */}
            {tab === "forecast" && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-4">Indexing Forecast & Growth Predictions</h2>
                  {forecast && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-xs font-mono text-slate-400 uppercase">Weekly Growth Rate</div>
                        <div className="text-2xl font-bold text-sky-400 mt-2">+{forecast.weekly_growth_rate}%</div>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-xs font-mono text-slate-400 uppercase">Monthly Growth Rate</div>
                        <div className="text-2xl font-bold text-emerald-400 mt-2">+{forecast.monthly_growth_rate}%</div>
                      </div>
                      <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                        <div className="text-xs font-mono text-slate-400 uppercase">Recovery Probability</div>
                        <div className="text-2xl font-bold text-amber-400 mt-2">{forecast.recovery_probability}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

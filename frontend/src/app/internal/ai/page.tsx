"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

interface AIOverview {
  snapshot_id: string | null;
  tenant_id: string;
  risk_score: number;
  opportunity_score: number;
  priority_score: number;
  predicted_success_pct: number;
  expected_completion_time_seconds: number;
  expected_completion_time_formatted: string;
  health_score: number;
  recommended_next_action: string;
  recalculated_at: string;
  automation_suggestions: string[];
  health_recommendations: string[];
  optimization_recommendations: string[];
  history_trend: Array<{
    snapshot_id: string;
    risk_score: number;
    opportunity_score: number;
    priority_score: number;
    predicted_success_pct: number;
    recalculated_at: string;
  }>;
}

interface RiskFactor {
  factor_name: string;
  score: number;
  weight: number;
  severity: string;
  details: string;
}

interface RiskData {
  overall_risk_score: number;
  risk_level: string;
  factors: RiskFactor[];
  evaluated_at: string;
}

interface OpportunityItem {
  target_name: string;
  opportunity_type: string;
  score: number;
  estimated_gain_pct: number;
  recommendation_text: string;
}

interface OpportunityData {
  overall_opportunity_score: number;
  items: OpportunityItem[];
  generated_at: string;
}

interface PredictionItem {
  entity_type: string;
  entity_id: string | null;
  metric_name: string;
  current_value: number;
  predicted_value: number;
  confidence: number;
  time_horizon_minutes: number;
}

interface PredictionData {
  predicted_success_pct: number;
  expected_completion_time_seconds: number;
  expected_completion_time_formatted: string;
  items: PredictionItem[];
  generated_at: string;
}

interface RecommendationItem {
  id: string;
  category: string;
  priority: string;
  title: string;
  description: string;
  impact_score: number;
  action_payload: Record<string, unknown>;
}

interface RecommendationData {
  total_count: number;
  items: RecommendationItem[];
  automation_suggestions: string[];
  health_recommendations: string[];
  optimization_recommendations: string[];
}

export default function AIDecisionEnginePage() {
  const [overview, setOverview] = useState<AIOverview | null>(null);
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [opportunities, setOpportunities] = useState<OpportunityData | null>(null);
  const [predictions, setPredictions] = useState<PredictionData | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"overview" | "risk" | "opportunities" | "predictions" | "recommendations" | "history">("overview");
  const [message, setMessage] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [ovRes, rkRes, opRes, prRes, rcRes] = await Promise.all([
        fetch("/api/ai/overview"),
        fetch("/api/ai/risk"),
        fetch("/api/ai/opportunities"),
        fetch("/api/ai/predictions"),
        fetch("/api/ai/recommendations"),
      ]);

      if (ovRes.ok) setOverview(await ovRes.json());
      if (rkRes.ok) setRisk(await rkRes.json());
      if (opRes.ok) setOpportunities(await opRes.json());
      if (prRes.ok) setPredictions(await prRes.json());
      if (rcRes.ok) setRecommendations(await rcRes.json());
    } catch {
      setMessage("Error loading AI Decision Engine telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    setMessage("Running deterministic AI engine recalculation...");
    try {
      const res = await fetch("/api/ai/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger_source: "manual_dashboard" }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Recalculation complete in ${data.execution_duration_ms.toFixed(1)}ms. Snapshot ID: ${data.snapshot_id}`);
        await fetchAll();
      } else {
        setMessage("Recalculation request failed.");
      }
    } catch {
      setMessage("Error communicating with AI Decision Engine API.");
    } finally {
      setRecalculating(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="p-6 space-y-4">
        <OpsNav />
        <div className="text-gray-500 animate-pulse">Loading AI Decision Engine Telemetry...</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Enterprise AI Decision Engine</h1>
          <p className="text-sm text-gray-600">
            Deterministic weighted scoring, risk analysis, predictions, and automated optimization.
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-medium text-sm transition-colors disabled:opacity-50"
        >
          {recalculating ? "Recalculating..." : "Recalculate Engine Scores"}
        </button>
      </div>

      <OpsNav />

      {message && (
        <div className="p-3 bg-indigo-50 text-indigo-900 border border-indigo-200 rounded text-sm">
          {message}
        </div>
      )}

      {/* Key Metric Score Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <ScoreCard
          label="Risk Score"
          value={overview?.risk_score.toFixed(1) ?? "0.0"}
          sub={`Level: ${risk?.risk_level ?? "LOW"}`}
          color={
            (overview?.risk_score ?? 0) > 50
              ? "text-red-600"
              : (overview?.risk_score ?? 0) > 25
              ? "text-amber-600"
              : "text-emerald-600"
          }
        />
        <ScoreCard
          label="Opportunity Score"
          value={overview?.opportunity_score.toFixed(1) ?? "0.0"}
          sub="Indexed Gain Potential"
          color="text-indigo-600"
        />
        <ScoreCard
          label="Priority Score"
          value={overview?.priority_score.toFixed(1) ?? "0.0"}
          sub="Authority Weighted"
          color="text-blue-600"
        />
        <ScoreCard
          label="Predicted Success"
          value={`${overview?.predicted_success_pct.toFixed(1) ?? "100"}%`}
          sub="Historical Crawl Yield"
          color="text-emerald-600"
        />
        <ScoreCard
          label="Completion Time"
          value={overview?.expected_completion_time_formatted ?? "0s"}
          sub={`${overview?.expected_completion_time_seconds ?? 0}s queue drain`}
          color="text-gray-900"
        />
        <ScoreCard
          label="Health Score"
          value={overview?.health_score.toFixed(1) ?? "100.0"}
          sub="System Tolerances"
          color="text-teal-600"
        />
      </div>

      {/* Primary Recommended Next Action Banner */}
      {overview?.recommended_next_action && (
        <div className="p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-lg shadow-sm border border-indigo-800">
          <div className="text-xs uppercase tracking-wider text-indigo-300 font-semibold mb-1">
            Recommended Next Action
          </div>
          <div className="text-lg font-semibold">{overview.recommended_next_action}</div>
        </div>
      )}

      {/* Sub-engine Navigation Tabs */}
      <div className="border-b flex gap-2 overflow-x-auto text-sm font-medium">
        <TabButton id="overview" label="Overview & Suggestions" active={activeTab} onClick={setActiveTab} />
        <TabButton id="risk" label="Risk Factors" active={activeTab} onClick={setActiveTab} />
        <TabButton id="opportunities" label="Opportunities" active={activeTab} onClick={setActiveTab} />
        <TabButton id="predictions" label="Predictions" active={activeTab} onClick={setActiveTab} />
        <TabButton id="recommendations" label="Recommendations" active={activeTab} onClick={setActiveTab} />
        <TabButton id="history" label="Trend History" active={activeTab} onClick={setActiveTab} />
      </div>

      {/* Tab Panels */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SectionCard title="Automation Suggestions" items={overview?.automation_suggestions ?? []} badgeColor="bg-blue-100 text-blue-800" />
          <SectionCard title="Health Recommendations" items={overview?.health_recommendations ?? []} badgeColor="bg-emerald-100 text-emerald-800" />
          <SectionCard title="Optimization Recommendations" items={overview?.optimization_recommendations ?? []} badgeColor="bg-purple-100 text-purple-800" />
        </div>
      )}

      {activeTab === "risk" && risk && (
        <div className="space-y-4 bg-white border rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-900">Risk Factor Breakdown</h3>
            <span className="text-xs font-semibold px-2 py-1 rounded bg-gray-100 text-gray-800">
              Evaluated At: {new Date(risk.evaluated_at).toLocaleTimeString()}
            </span>
          </div>
          <div className="divide-y">
            {risk.factors.map((f, i) => (
              <div key={i} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-gray-900">{f.factor_name}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{f.details}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">Weight: {(f.weight * 100).toFixed(0)}%</span>
                  <span className="text-sm font-bold w-12 text-right">{f.score.toFixed(1)}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-semibold uppercase ${
                      f.severity === "critical" || f.severity === "high"
                        ? "bg-red-100 text-red-800"
                        : f.severity === "medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {f.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "opportunities" && opportunities && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {opportunities.items.map((o, i) => (
            <div key={i} className="border rounded-lg p-4 bg-white space-y-2">
              <div className="flex justify-between items-start">
                <div className="font-bold text-sm text-gray-900">{o.target_name}</div>
                <span className="text-xs font-bold px-2 py-0.5 bg-indigo-100 text-indigo-800 rounded">
                  +{o.estimated_gain_pct}% Yield
                </span>
              </div>
              <div className="text-xs font-semibold text-gray-500 uppercase">{o.opportunity_type}</div>
              <p className="text-xs text-gray-700">{o.recommendation_text}</p>
              <div className="text-right text-sm font-extrabold text-indigo-600">
                Score: {o.score.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "predictions" && predictions && (
        <div className="space-y-4 bg-white border rounded-lg p-4">
          <h3 className="font-bold text-gray-900">Deterministic Metric Forecasts</h3>
          <div className="divide-y">
            {predictions.items.map((p, i) => (
              <div key={i} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div>
                  <div className="font-semibold text-sm text-gray-900">{p.metric_name}</div>
                  <div className="text-xs text-gray-500">
                    Entity: {p.entity_type} ({p.entity_id ?? "system"}) | Horizon: {p.time_horizon_minutes}m
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm font-medium">
                  <div>
                    <span className="text-xs text-gray-400 block">Current</span>
                    {p.current_value.toFixed(1)}
                  </div>
                  <div className="text-indigo-600 font-bold">
                    <span className="text-xs text-gray-400 block">Predicted</span>
                    {p.predicted_value.toFixed(1)}
                  </div>
                  <div className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                    Confidence: {(p.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "recommendations" && recommendations && (
        <div className="space-y-3">
          {recommendations.items.map((r) => (
            <div key={r.id} className="border rounded-lg p-4 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-gray-900">{r.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded font-semibold uppercase bg-gray-100 text-gray-800">
                    {r.priority}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-medium bg-indigo-50 text-indigo-700">
                    {r.category}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{r.description}</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">Impact Score</div>
                <div className="text-lg font-bold text-indigo-600">{r.impact_score.toFixed(0)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "history" && overview?.history_trend && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <h3 className="font-bold text-gray-900">Historical Snapshot Trend</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 border-b font-semibold">
                <tr>
                  <th className="p-2">Snapshot ID</th>
                  <th className="p-2">Risk Score</th>
                  <th className="p-2">Opportunity Score</th>
                  <th className="p-2">Priority Score</th>
                  <th className="p-2">Predicted Success %</th>
                  <th className="p-2">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {overview.history_trend.map((h) => (
                  <tr key={h.snapshot_id}>
                    <td className="p-2 font-mono text-gray-500">{h.snapshot_id}</td>
                    <td className="p-2 font-bold text-red-600">{h.risk_score.toFixed(1)}</td>
                    <td className="p-2 font-bold text-indigo-600">{h.opportunity_score.toFixed(1)}</td>
                    <td className="p-2 font-bold text-blue-600">{h.priority_score.toFixed(1)}</td>
                    <td className="p-2 font-bold text-emerald-600">{h.predicted_success_pct.toFixed(1)}%</td>
                    <td className="p-2 text-gray-500">{new Date(h.recalculated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-white border rounded-lg p-3 space-y-1">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className={`text-xl font-extrabold ${color}`}>{value}</div>
      <div className="text-[11px] text-gray-400">{sub}</div>
    </div>
  );
}

function TabButton({ id, label, active, onClick }: { id: any; label: string; active: string; onClick: (id: any) => void }) {
  return (
    <button
      onClick={() => onClick(id)}
      className={`py-2 px-3 border-b-2 font-semibold text-xs transition-colors whitespace-nowrap ${
        active === id ? "border-indigo-600 text-indigo-600" : "border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {label}
    </button>
  );
}

function SectionCard({ title, items, badgeColor }: { title: string; items: string[]; badgeColor: string }) {
  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between border-b pb-2">
        <h3 className="font-bold text-sm text-gray-900">{title}</h3>
        <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${badgeColor}`}>{items.length} Suggestions</span>
      </div>
      <ul className="space-y-2">
        {items.map((item, idx) => (
          <li key={idx} className="text-xs text-gray-700 flex items-start gap-2">
            <span className="text-indigo-500 font-bold">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

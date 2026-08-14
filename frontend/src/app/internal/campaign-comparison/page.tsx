"use client";

import { useCallback, useEffect, useState } from "react";

type Insight = {
  id: string;
  campaign_id: string | null;
  average_discovery_score: number;
  crawl_success_rate: number;
  discovery_trend: string | null;
  fastest_improving_campaigns: string | null;
  slowest_campaigns: string | null;
  generated_at: string;
};

export default function CampaignComparisonPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/search-intelligence/portfolio");
      if (res.ok) {
        const data = await res.json();
        setInsights(data.history ?? []);
      }
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="p-6 text-gray-500">Loading campaign comparison...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Campaign Comparison</h1>

      {insights.length === 0 ? (
        <div className="text-gray-500">No campaign data available yet. Run a portfolio insight generation first.</div>
      ) : (
        <div className="bg-white rounded-lg shadow p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-2">Campaign</th>
                <th className="py-2">Avg Score</th>
                <th className="py-2">Crawl Rate</th>
                <th className="py-2">Trend</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {insights.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="py-2 font-mono text-xs">{i.campaign_id ?? "—"}</td>
                  <td className="py-2">{i.average_discovery_score.toFixed(1)}%</td>
                  <td className="py-2">{i.crawl_success_rate.toFixed(1)}%</td>
                  <td className="py-2">
                    <span className={
                      i.discovery_trend === "improving" ? "text-green-600" :
                      i.discovery_trend === "declining" ? "text-red-600" : "text-yellow-600"
                    }>
                      {i.discovery_trend ?? "stable"}
                    </span>
                  </td>
                  <td className="py-2">{new Date(i.generated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

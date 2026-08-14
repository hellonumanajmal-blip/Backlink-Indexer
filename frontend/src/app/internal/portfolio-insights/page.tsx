"use client";

import { useCallback, useEffect, useState } from "react";

type PortfolioData = {
  latest: {
    average_discovery_score: number;
    average_verification_age_hours: number;
    crawl_success_rate: number;
    retry_rate: number;
    validation_trend: string | null;
    discovery_trend: string | null;
    total_backlinks: number;
    indexed_count: number;
    not_indexed_count: number;
    generated_at: string;
  } | null;
  history: Array<{
    id: string;
    average_discovery_score: number;
    crawl_success_rate: number;
    generated_at: string;
  }>;
};

export default function PortfolioInsightsPage() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/search-intelligence/portfolio");
      if (res.ok) setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="p-6 text-gray-500">Loading portfolio insights...</div>;
  if (!data?.latest) return <div className="p-6 text-gray-500">No portfolio insights yet.</div>;

  const { latest } = data;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Portfolio Insights</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Avg Discovery Score" value={`${latest.average_discovery_score.toFixed(1)}%`} />
        <SummaryCard label="Crawl Success Rate" value={`${latest.crawl_success_rate.toFixed(1)}%`} />
        <SummaryCard label="Retry Rate" value={`${latest.retry_rate.toFixed(1)}%`} />
        <SummaryCard label="Verification Age" value={`${latest.average_verification_age_hours.toFixed(1)}h`} />
        <SummaryCard label="Total Backlinks" value={latest.total_backlinks} />
        <SummaryCard label="Indexed" value={latest.indexed_count} />
        <SummaryCard label="Not Indexed" value={latest.not_indexed_count} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <TrendBadge label="Validation Trend" value={latest.validation_trend} />
        <TrendBadge label="Discovery Trend" value={latest.discovery_trend} />
      </div>

      <div className="bg-white rounded-lg shadow p-4 mt-6">
        <h2 className="text-lg font-semibold mb-4">Historical Scores</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Date</th>
              <th className="py-2">Avg Score</th>
              <th className="py-2">Crawl Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.history.map((h) => (
              <tr key={h.id} className="border-b">
                <td className="py-2">{new Date(h.generated_at).toLocaleDateString()}</td>
                <td className="py-2">{h.average_discovery_score.toFixed(1)}%</td>
                <td className="py-2">{h.crawl_success_rate.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function TrendBadge({ label, value }: { label: string; value: string | null }) {
  const color = value === "improving" ? "text-green-600" : value === "declining" ? "text-red-600" : "text-yellow-600";
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-xl font-semibold ${color}`}>{value ?? "stable"}</div>
    </div>
  );
}

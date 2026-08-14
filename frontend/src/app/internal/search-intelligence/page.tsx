"use client";

import { useCallback, useEffect, useState } from "react";

type Overview = {
  total_backlinks: number;
  with_discovery_signals: number;
  average_discovery_score: number;
  average_confidence_score: number;
  indexed_count: number;
  not_indexed_count: number;
  unknown_count: number;
  needs_recheck_count: number;
  crawl_success_rate: number;
  total_recommendations: number;
  open_recommendations: number;
};

export default function SearchIntelligencePage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search-intelligence/overview");
      if (res.ok) setOverview(await res.json());
    } catch {
      setError("Failed to load search intelligence data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="p-6 text-gray-500">Loading search intelligence...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!overview) return <div className="p-6 text-gray-500">No data available.</div>;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Search Intelligence</h1>
        <nav className="flex flex-wrap gap-2 text-sm">
          <a className="border px-3 py-1.5" href="/internal/portfolio-insights">Portfolio Insights</a>
          <a className="border px-3 py-1.5" href="/internal/discovery-trends">Discovery Trends</a>
          <a className="border px-3 py-1.5" href="/internal/campaign-comparison">Campaign Comparison</a>
          <a className="border px-3 py-1.5" href="/internal/manual-verification">Manual Verification</a>
          <a className="border px-3 py-1.5" href="/internal/recommendation-timeline">Recommendations</a>
        </nav>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Technical discovery signals and user-confirmed observations only. This does not scrape Google or guarantee indexing.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Total Backlinks" value={overview.total_backlinks} />
        <SummaryCard label="With Discovery Signals" value={overview.with_discovery_signals} />
        <SummaryCard label="Avg Discovery Score" value={`${overview.average_discovery_score.toFixed(1)}%`} />
        <SummaryCard label="Avg Confidence" value={`${overview.average_confidence_score.toFixed(1)}%`} />
        <SummaryCard label="Crawl Success Rate" value={`${overview.crawl_success_rate.toFixed(1)}%`} />
        <SummaryCard label="Open Recommendations" value={overview.open_recommendations} />
        <SummaryCard label="Total Recommendations" value={overview.total_recommendations} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatusCard label="Indexed" value={overview.indexed_count} color="text-green-600" />
        <StatusCard label="Not Indexed" value={overview.not_indexed_count} color="text-red-600" />
        <StatusCard label="Unknown" value={overview.unknown_count} color="text-yellow-600" />
        <StatusCard label="Needs Recheck" value={overview.needs_recheck_count} color="text-orange-600" />
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

function StatusCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

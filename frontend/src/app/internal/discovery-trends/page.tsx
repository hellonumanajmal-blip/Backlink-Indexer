"use client";

import { useCallback, useEffect, useState } from "react";

type Trend = {
  id: string;
  backlink_id: string;
  discovery_score: number;
  crawl_success_count: number;
  crawl_fail_count: number;
  retry_count: number;
  signal_count: number;
  recorded_at: string;
};

export default function DiscoveryTrendsPage() {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/search-intelligence/trends?limit=200");
      if (res.ok) setTrends(await res.json());
    } catch {
      setError("Failed to load trends");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) return <div className="p-6 text-gray-500">Loading discovery trends...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;

  const avgScore = trends.length > 0 ? trends.reduce((s, t) => s + t.discovery_score, 0) / trends.length : 0;
  const totalCrawlOk = trends.reduce((s, t) => s + t.crawl_success_count, 0);
  const totalCrawlFail = trends.reduce((s, t) => s + t.crawl_fail_count, 0);
  const totalRetries = trends.reduce((s, t) => s + t.retry_count, 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Discovery Trends</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Data Points</div>
          <div className="text-2xl font-semibold">{trends.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Avg Score</div>
          <div className="text-2xl font-semibold">{avgScore.toFixed(1)}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Crawl Success</div>
          <div className="text-2xl font-semibold text-green-600">{totalCrawlOk}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Crawl Failures</div>
          <div className="text-2xl font-semibold text-red-600">{totalCrawlFail}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Retries</div>
          <div className="text-2xl font-semibold text-yellow-600">{totalRetries}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold mb-4">Trend Timeline</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">Backlink</th>
              <th className="py-2">Score</th>
              <th className="py-2">Crawl OK</th>
              <th className="py-2">Crawl Fail</th>
              <th className="py-2">Retries</th>
              <th className="py-2">Signals</th>
              <th className="py-2">Recorded</th>
            </tr>
          </thead>
          <tbody>
            {trends.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2 font-mono text-xs">{t.backlink_id.substring(0, 8)}</td>
                <td className="py-2">{t.discovery_score.toFixed(1)}</td>
                <td className="py-2">{t.crawl_success_count}</td>
                <td className="py-2">{t.crawl_fail_count}</td>
                <td className="py-2">{t.retry_count}</td>
                <td className="py-2">{t.signal_count}</td>
                <td className="py-2">{new Date(t.recorded_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

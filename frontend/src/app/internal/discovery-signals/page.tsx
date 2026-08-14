"use client";

import { useCallback, useEffect, useState } from "react";

type SignalSummary = {
  total_signals: number;
  total_backlinks_with_signals: number;
  average_discovery_score: number;
  average_success_rate: number | null;
  total_pending: number;
  total_failed: number;
  total_retries: number;
  average_latency_ms: number | null;
  signal_type_summary: Record<string, number>;
  trend_data: Array<{
    window_start: string;
    total_signals: number;
    successful_signals: number;
    failed_signals: number;
    average_latency_ms: number | null;
    average_discovery_score: number | null;
  }>;
};

type Signal = {
  id: string;
  backlink_id: string;
  url: string;
  discovery_score: number;
  signal_count: number;
  last_signal_type: string | null;
  last_signal_at: string | null;
  last_signal_detail: string | null;
  pending_signals: number;
  failed_signals: number;
  retry_count: number;
  success_rate: number;
  average_latency_ms: number | null;
  created_at: string;
  updated_at: string;
};

function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatScore(score: number): string {
  return score.toFixed(1);
}

export default function DiscoverySignalsPage() {
  const [summary, setSummary] = useState<SignalSummary | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, signalsRes] = await Promise.all([
        fetch("/api/discovery-signals/dashboard/summary"),
        fetch(`/api/discovery-signals?page=${page}&page_size=${pageSize}&sort=discovery_score&order=desc`),
      ]);
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (signalsRes.ok) {
        const body = await signalsRes.json();
        setSignals(body.items ?? []);
        setTotal(body.total ?? 0);
      }
    } catch (e) {
      setError("Failed to load discovery signals data");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading && !summary) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Discovery Signals</h1>
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Discovery Signals</h1>
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded">{error}</div>
      </div>
    );
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Discovery Signals</h1>
      <p className="text-sm text-gray-500 mb-6">
        Tracks every legitimate discovery signal emitted for your backlinks. Higher discovery scores indicate more signals sent across RSS feeds, WebSub, IndexNow, and crawl validations.
      </p>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Total Signals</div>
            <div className="text-2xl font-bold">{summary.total_signals}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Backlinks Tracked</div>
            <div className="text-2xl font-bold">{summary.total_backlinks_with_signals}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Avg Discovery Score</div>
            <div className="text-2xl font-bold">{formatScore(summary.average_discovery_score)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Avg Latency</div>
            <div className="text-2xl font-bold">{formatDuration(summary.average_latency_ms)}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Pending</div>
            <div className="text-2xl font-bold text-yellow-600">{summary.total_pending}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Failed</div>
            <div className="text-2xl font-bold text-red-600">{summary.total_failed}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Retries</div>
            <div className="text-2xl font-bold">{summary.total_retries}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Success Rate</div>
            <div className="text-2xl font-bold">
              {summary.average_success_rate !== null
                ? `${(summary.average_success_rate * 100).toFixed(0)}%`
                : "—"}
            </div>
          </div>
        </div>
      )}

      {/* Signal Type Breakdown */}
      {summary && Object.keys(summary.signal_type_summary).length > 0 && (
        <div className="bg-white rounded-lg shadow p-4 mb-8">
          <h2 className="text-lg font-semibold mb-3">Signal Type Breakdown</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.entries(summary.signal_type_summary).map(([type, count]) => (
              <div key={type} className="flex justify-between px-3 py-2 bg-gray-50 rounded">
                <span className="text-sm text-gray-600">{type.replace(/_/g, " ")}</span>
                <span className="text-sm font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend Data */}
      {summary && summary.trend_data.length > 1 && (
        <div className="bg-white rounded-lg shadow p-4 mb-8">
          <h2 className="text-lg font-semibold mb-3">Score Trend</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-2 pr-4">Window</th>
                  <th className="pb-2 pr-4">Signals</th>
                  <th className="pb-2 pr-4">Success</th>
                  <th className="pb-2 pr-4">Failed</th>
                  <th className="pb-2 pr-4">Avg Score</th>
                  <th className="pb-2 pr-4">Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {summary.trend_data.map((t, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-gray-600">
                      {t.window_start ? new Date(t.window_start).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-4">{t.total_signals}</td>
                    <td className="py-2 pr-4 text-green-600">{t.successful_signals}</td>
                    <td className="py-2 pr-4 text-red-600">{t.failed_signals}</td>
                    <td className="py-2 pr-4">{t.average_discovery_score?.toFixed(1) ?? "—"}</td>
                    <td className="py-2 pr-4">{formatDuration(t.average_latency_ms)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Signal List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Signal Timeline</h2>
        </div>
        {signals.length === 0 ? (
          <div className="p-4 text-gray-500">No signals recorded yet. Signals are generated when backlinks are processed through feeds, WebSub, IndexNow, or crawl verification.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b bg-gray-50">
                  <th className="p-3">URL</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Signals</th>
                  <th className="p-3">Last Signal</th>
                  <th className="p-3">Pending</th>
                  <th className="p-3">Failed</th>
                  <th className="p-3">Retries</th>
                  <th className="p-3">Latency</th>
                  <th className="p-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {signals.map((s) => (
                  <tr key={s.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 max-w-xs truncate" title={s.url}>{s.url}</td>
                    <td className="p-3 font-semibold">{formatScore(s.discovery_score)}</td>
                    <td className="p-3">{s.signal_count}</td>
                    <td className="p-3 text-gray-600">
                      {s.last_signal_type ? (
                        <span title={s.last_signal_detail ?? undefined}>
                          {s.last_signal_type.replace(/_/g, " ")}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="p-3 text-yellow-600">{s.pending_signals}</td>
                    <td className="p-3 text-red-600">{s.failed_signals}</td>
                    <td className="p-3">{s.retry_count}</td>
                    <td className="p-3">{formatDuration(s.average_latency_ms)}</td>
                    <td className="p-3 text-gray-500 text-xs">
                      {s.updated_at ? new Date(s.updated_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 p-4 border-t">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 text-sm bg-gray-100 rounded disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mt-8 text-xs text-gray-400 border-t pt-4">
        <p className="mb-1"><strong>Signal Types:</strong> RSS / Atom / JSON Feed publication, Sitemap inclusion, WebSub publish/acknowledgement, IndexNow submission, Crawl Verification success/failure, Queue completion, Validation score changes.</p>
        <p><strong>Note:</strong> Discovery signals improve <em>discovery opportunities</em> only. This is NOT an indexing engine and does NOT guarantee search-engine indexing.</p>
      </div>
    </div>
  );
}

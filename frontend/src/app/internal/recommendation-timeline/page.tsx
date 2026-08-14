"use client";

import { useCallback, useEffect, useState } from "react";

type Recommendation = {
  id: string;
  backlink_id: string;
  category: string;
  title: string;
  description: string | null;
  priority: string;
  evidence: string | null;
  is_actioned: boolean;
  generated_at: string;
};

export default function RecommendationTimelinePage() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search-intelligence/recommendations?page=${page}&page_size=${pageSize}`);
      if (res.ok) {
        const body = await res.json();
        setRecs(body.items ?? []);
        setTotal(body.total ?? 0);
      }
    } catch {
      setError("Failed to load recommendations");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const priorityColor = (p: string) =>
    p === "high" ? "text-red-600" : p === "medium" ? "text-yellow-600" : "text-gray-600";

  const categoryLabel = (c: string) =>
    c.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  if (error) return <div className="p-6 text-red-500">{error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Recommendation Timeline</h1>

      <div className="mb-4 text-sm text-gray-500">
        Showing {recs.length} of {total} recommendations
      </div>

      {loading ? (
        <div className="text-gray-500">Loading recommendations...</div>
      ) : recs.length === 0 ? (
        <div className="text-gray-500">No recommendations yet. Run a recalculation first.</div>
      ) : (
        <div className="space-y-4">
          {recs.map((r) => (
            <div key={r.id} className="bg-white rounded-lg shadow p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded ${priorityColor(r.priority)} bg-opacity-10`}>
                    {r.priority.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    {categoryLabel(r.category)}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(r.generated_at).toLocaleDateString()}
                </span>
              </div>
              <div className="font-medium">{r.title}</div>
              {r.description && <div className="text-sm text-gray-600 mt-1">{r.description}</div>}
              {r.evidence && <div className="text-xs text-gray-400 mt-1">Evidence: {r.evidence}</div>}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-mono text-gray-400">{r.backlink_id.substring(0, 8)}</span>
                {r.is_actioned && <span className="text-xs text-green-600">Actioned</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-center gap-4 mt-6">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-4 py-2 bg-white border rounded text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-600">Page {page}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={page * pageSize >= total}
          className="px-4 py-2 bg-white border rounded text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

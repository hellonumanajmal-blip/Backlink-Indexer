"use client";

import { useCallback, useEffect, useState } from "react";

type Overview = {
  indexed_count: number;
  not_indexed_count: number;
  unknown_count: number;
  needs_recheck_count: number;
};

export default function ManualVerificationPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [backlinkId, setBacklinkId] = useState("");
  const [status, setStatus] = useState("indexed");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/search-intelligence/overview");
      if (res.ok) {
        const data = await res.json();
        setOverview({
          indexed_count: data.indexed_count,
          not_indexed_count: data.not_indexed_count,
          unknown_count: data.unknown_count,
          needs_recheck_count: data.needs_recheck_count,
        });
      }
    } catch {
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/search-intelligence/manual-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ backlink_id: backlinkId, status, notes }),
      });
      if (res.ok) {
        setResult("Verification recorded successfully");
        setBacklinkId("");
        setNotes("");
        fetchOverview();
      } else {
        const err = await res.json();
        setResult(`Error: ${err.detail ?? res.statusText}`);
      }
    } catch {
      setResult("Failed to submit verification");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Manual Verification</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Indexed</div>
          <div className="text-2xl font-semibold text-green-600">{overview?.indexed_count ?? 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Not Indexed</div>
          <div className="text-2xl font-semibold text-red-600">{overview?.not_indexed_count ?? 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Unknown</div>
          <div className="text-2xl font-semibold text-yellow-600">{overview?.unknown_count ?? 0}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Needs Recheck</div>
          <div className="text-2xl font-semibold text-orange-600">{overview?.needs_recheck_count ?? 0}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Record Observation</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Backlink ID</label>
            <input
              type="text"
              value={backlinkId}
              onChange={(e) => setBacklinkId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="indexed">Indexed</option>
              <option value="not_indexed">Not Indexed</option>
              <option value="unknown">Unknown</option>
              <option value="needs_recheck">Needs Recheck</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              rows={3}
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !backlinkId}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Verification"}
          </button>
          {result && (
            <div className={`text-sm mt-2 ${result.startsWith("Error") ? "text-red-600" : "text-green-600"}`}>
              {result}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

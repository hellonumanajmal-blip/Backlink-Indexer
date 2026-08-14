"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

export default function QueuesPage() {
  const [queues, setQueues] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/queues");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setQueues(data.queues || []);
      setError(null);
    } catch {
      setError("Failed to load queues");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  if (!queues.length && !error) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error && !queues.length) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Queues</h1>
        <p className="text-sm text-gray-600">
          Pending, running, completed, retrying, failed, and cancelled depths.
        </p>
      </div>
      <OpsNav />
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2">Queue</th>
            <th className="p-2">Pending</th>
            <th className="p-2">Running</th>
            <th className="p-2">Completed</th>
            <th className="p-2">Retrying</th>
            <th className="p-2">Failed</th>
            <th className="p-2">Cancelled</th>
            <th className="p-2">Avg wait</th>
            <th className="p-2">Avg proc</th>
          </tr>
        </thead>
        <tbody>
          {queues.map((q) => (
            <tr key={q.queue_name} className="border-t">
              <td className="p-2">{q.queue_name}</td>
              <td className="p-2">{q.pending}</td>
              <td className="p-2">{q.running}</td>
              <td className="p-2">{q.completed}</td>
              <td className="p-2">{q.retrying}</td>
              <td className="p-2">{q.failed}</td>
              <td className="p-2">{q.cancelled}</td>
              <td className="p-2">{q.avg_wait_ms}</td>
              <td className="p-2">{q.avg_processing_ms}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

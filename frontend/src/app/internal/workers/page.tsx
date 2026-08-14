"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

export default function WorkersPage() {
  const [workers, setWorkers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/workers");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setWorkers(data.workers || []);
      setError(null);
    } catch {
      setError("Failed to load workers");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  if (!workers.length && !error) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error && !workers.length) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Workers</h1>
        <p className="text-sm text-gray-600">Celery worker status, heartbeats, and task counters.</p>
      </div>
      <OpsNav />
      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-2">Name</th>
            <th className="p-2">Task</th>
            <th className="p-2">Queue</th>
            <th className="p-2">CPU</th>
            <th className="p-2">Memory</th>
            <th className="p-2">Done</th>
            <th className="p-2">Failed</th>
            <th className="p-2">Avg ms</th>
            <th className="p-2">Heartbeat</th>
            <th className="p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {workers.map((w) => (
            <tr key={w.worker_name} className="border-t">
              <td className="p-2">{w.worker_name}</td>
              <td className="p-2">{w.current_task || "—"}</td>
              <td className="p-2">{w.queue || "—"}</td>
              <td className="p-2">{w.cpu_usage ?? "—"}</td>
              <td className="p-2">{w.memory_usage_mb ?? "—"}</td>
              <td className="p-2">{w.tasks_completed}</td>
              <td className="p-2">{w.tasks_failed}</td>
              <td className="p-2">{w.avg_processing_ms}</td>
              <td className="p-2">{w.heartbeat_at || "—"}</td>
              <td className="p-2">{w.online ? "Online" : "Offline"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!workers.length && <p className="text-sm text-gray-500">No workers reported (inspect unavailable).</p>}
    </div>
  );
}

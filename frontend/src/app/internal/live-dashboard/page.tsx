"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

export default function LiveDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [sse, setSse] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/live");
      if (!res.ok) throw new Error("failed");
      setData(await res.json());
      setError(null);
    } catch {
      setError("Failed to load Live Dashboard");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/operations/live/stream?ticks=60&interval=3");
      es.addEventListener("snapshot", (ev) => {
        try {
          setData(JSON.parse((ev as MessageEvent).data));
          setSse(true);
        } catch {
          /* ignore */
        }
      });
      es.onerror = () => setSse(false);
    } catch {
      setSse(false);
    }
    return () => {
      clearInterval(t);
      es?.close();
    };
  }, [load]);

  if (!data && !error) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error && !data) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Dashboard</h1>
        <p className="text-sm text-gray-600">
          Real-time queue, worker, pipeline, and activity visibility.
        </p>
        <p className="text-xs text-gray-500 mt-1">{sse ? "SSE connected" : "Polling fallback"}</p>
      </div>
      <OpsNav />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Workers" value={data.metrics?.workers_online} />
        <Card label="Pending" value={data.metrics?.queue_pending} />
        <Card label="Running" value={data.metrics?.queue_running} />
        <Card label="Failed" value={data.metrics?.queue_failed} />
      </div>
      <pre className="text-xs border p-3 overflow-auto max-h-96 bg-white">
        {JSON.stringify(
          {
            workers: data.workers?.length,
            queues: data.queues,
            pipeline_workflows: data.pipeline?.workflows?.length,
            open_alerts: data.open_alerts,
            open_incidents: data.open_incidents,
          },
          null,
          2
        )}
      </pre>
    </div>
  );
}

function Card({ label, value }: { label: string; value: any }) {
  return (
    <div className="border p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value ?? "—"}</div>
    </div>
  );
}

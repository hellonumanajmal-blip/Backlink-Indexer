"use client";

import { useEffect, useState } from "react";

type Overview = { success_rate: number; avg_latency_ms: number; queue_depth: number };

export default function ConnectorMetricsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [metrics, setMetrics] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const [a, b] = await Promise.all([fetch("/api/connectors"), fetch("/api/connectors/metrics?limit=50")]);
      if (a.ok) setOverview((await a.json()).overview);
      if (b.ok) setMetrics(await b.json());
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Connector Metrics</h1>
      <a className="text-sm underline" href="/internal/integrations">← Dashboard</a>
      {overview ? (
        <div className="grid grid-cols-3 gap-3">
          <Card label="Success" value={`${overview.success_rate.toFixed(1)}%`} />
          <Card label="Latency" value={`${Math.round(overview.avg_latency_ms)} ms`} />
          <Card label="Queue" value={overview.queue_depth} />
        </div>
      ) : null}
      <ul className="text-sm space-y-1">
        {metrics.map((m) => (
          <li key={m.id} className="border bg-white p-2 flex justify-between">
            <span>{m.metric_name}</span>
            <span>{m.metric_value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border bg-white p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

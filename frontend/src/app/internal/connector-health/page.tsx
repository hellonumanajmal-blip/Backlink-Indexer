"use client";

import { useEffect, useState } from "react";

type Health = {
  connector_id: string;
  success_rate: number;
  failure_rate: number;
  average_latency_ms: number;
  last_response_code: number | null;
  consecutive_failures: number;
  last_success_at: string | null;
  last_failure_at: string | null;
};

export default function ConnectorHealthPage() {
  const [rows, setRows] = useState<Health[]>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/connectors/health");
      if (res.ok) setRows(await res.json());
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Connector Health</h1>
      <a className="text-sm underline" href="/internal/integrations">← Dashboard</a>
      <div className="grid md:grid-cols-2 gap-3">
        {rows.map((h) => (
          <div key={h.connector_id} className="border bg-white p-4 text-sm">
            <div className="font-mono text-xs mb-2">{h.connector_id.slice(0, 8)}</div>
            <div>Success {h.success_rate.toFixed(1)}% · Failure {h.failure_rate.toFixed(1)}%</div>
            <div>Latency {Math.round(h.average_latency_ms)} ms · HTTP {h.last_response_code ?? "—"}</div>
            <div className="text-gray-500">Last ok {h.last_success_at || "—"}</div>
            <div className="text-gray-500">Last fail {h.last_failure_at || "—"} · streak {h.consecutive_failures}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

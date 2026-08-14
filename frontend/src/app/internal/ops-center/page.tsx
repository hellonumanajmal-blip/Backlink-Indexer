"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

type LiveSnap = {
  metrics?: Record<string, number>;
  workers?: any[];
  queues?: any[];
  pipeline?: { stages?: string[]; workflows?: any[] };
  open_alerts?: number;
  open_incidents?: number;
  activity?: any[];
};

export default function OpsCenterPage() {
  const [data, setData] = useState<LiveSnap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sse, setSse] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/live");
      if (!res.ok) throw new Error("failed");
      setData(await res.json());
      setError(null);
    } catch {
      setError("Failed to load Operations Center");
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
          setError(null);
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

  const m = data.metrics || {};

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Operations Center</h1>
        <p className="text-sm text-gray-600">
          Enterprise live operations hub. Monitoring and control only — no indexing guarantees.
        </p>
        <p className="text-xs text-gray-500 mt-1">{sse ? "SSE connected" : "Polling fallback"}</p>
      </div>
      <OpsNav />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card label="Workers online" value={m.workers_online} />
        <Card label="Queue pending" value={m.queue_pending} />
        <Card label="Queue failed" value={m.queue_failed} />
        <Card label="Open alerts" value={m.open_alerts ?? data.open_alerts} />
        <Card label="Open incidents" value={m.open_incidents ?? data.open_incidents} />
        <Card label="Failure rate" value={`${Number(m.failure_rate || 0).toFixed(1)}%`} />
      </div>
      <section>
        <h2 className="font-semibold mb-2">Recent activity</h2>
        <ul className="space-y-1 text-sm">
          {(data.activity || []).map((e) => (
            <li key={e.id} className="border-b py-2">
              <span className="text-xs text-gray-500">{e.created_at}</span>{" "}
              <strong>
                {e.category}/{e.event_type}
              </strong>{" "}
              — {e.message}
            </li>
          ))}
        </ul>
      </section>
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

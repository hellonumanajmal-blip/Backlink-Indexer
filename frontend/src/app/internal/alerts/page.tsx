"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/alerts");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setAlerts(data.alerts || []);
      setError(null);
    } catch {
      setError("Failed to load alerts");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function ack(id: string) {
    await fetch(`/api/operations/alerts/${id}/acknowledge`, { method: "POST" });
    load();
  }

  if (!alerts.length && !error) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error && !alerts.length) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alerts</h1>
        <p className="text-sm text-gray-600">
          System alerts for workers, queues, connectors, and connectivity.
        </p>
      </div>
      <OpsNav />
      <ul className="space-y-2 text-sm">
        {alerts.map((a) => (
          <li key={a.id} className="border p-3 flex justify-between gap-4">
            <div>
              <div className="font-medium">
                {a.title}{" "}
                <span className="text-xs">
                  ({a.severity}/{a.status})
                </span>
              </div>
              <div className="text-gray-600">{a.message}</div>
            </div>
            {a.status === "open" && (
              <button className="border px-3 py-1" onClick={() => ack(a.id)}>
                Acknowledge
              </button>
            )}
          </li>
        ))}
      </ul>
      {!alerts.length && <p className="text-sm text-gray-500">No alerts.</p>}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/incidents");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setIncidents(data.incidents || []);
      setError(null);
    } catch {
      setError("Failed to load incidents");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function resolve(id: string) {
    await fetch(`/api/operations/incidents/${id}/resolve`, { method: "POST" });
    load();
  }

  if (!incidents.length && !error) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error && !incidents.length) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Incidents</h1>
        <p className="text-sm text-gray-600">Open, acknowledged, resolved, and dismissed incidents.</p>
      </div>
      <OpsNav />
      <ul className="space-y-2 text-sm">
        {incidents.map((i) => (
          <li key={i.id} className="border p-3 flex justify-between gap-4">
            <div>
              <div className="font-medium">
                {i.title} <span className="text-xs">({i.status})</span>
              </div>
              <div className="text-gray-600">{i.description}</div>
            </div>
            {(i.status === "open" || i.status === "acknowledged") && (
              <button className="border px-3 py-1" onClick={() => resolve(i.id)}>
                Resolve
              </button>
            )}
          </li>
        ))}
      </ul>
      {!incidents.length && <p className="text-sm text-gray-500">No incidents.</p>}
    </div>
  );
}

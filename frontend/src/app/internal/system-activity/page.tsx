"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

export default function SystemActivityPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sse, setSse] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/events");
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setEvents(data.events || []);
      setError(null);
    } catch {
      setError("Failed to load activity");
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
          const snap = JSON.parse((ev as MessageEvent).data);
          if (snap.activity) setEvents(snap.activity);
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

  if (!events.length && !error) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error && !events.length) return <div className="p-6 text-red-600">{error}</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">System Activity</h1>
        <p className="text-sm text-gray-600">Live event stream across operations subsystems.</p>
        <p className="text-xs text-gray-500 mt-1">{sse ? "SSE connected" : "Polling fallback"}</p>
      </div>
      <OpsNav />
      <ul className="space-y-1 text-sm">
        {events.map((e) => (
          <li key={e.id} className="border-b py-2">
            <span className="text-xs text-gray-500">{e.created_at}</span>{" "}
            <strong>
              {e.category}/{e.event_type}
            </strong>{" "}
            — {e.message}
          </li>
        ))}
      </ul>
      {!events.length && <p className="text-sm text-gray-500">No events yet.</p>}
    </div>
  );
}

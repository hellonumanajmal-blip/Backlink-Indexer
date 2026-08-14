"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

export default function NotificationsPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/notifications");
      if (!res.ok) throw new Error("failed");
      setData(await res.json());
      setError(null);
    } catch {
      setError("Failed to load notifications");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  async function testNotify() {
    await fetch("/api/operations/notifications/test?channel=in_app", { method: "POST" });
    load();
  }

  if (!data && !error) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error && !data) return <div className="p-6 text-red-600">{error}</div>;
  if (!data) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="text-sm text-gray-600">In-app and pluggable notification providers.</p>
      </div>
      <OpsNav />
      <button className="border px-3 py-1.5 text-sm" onClick={testNotify}>
        Send test notification
      </button>
      <div className="text-sm">
        Providers:{" "}
        {(data.providers || []).map((p: any) => (
          <span key={p.id} className="border px-2 py-1 mr-2">
            {p.name}
          </span>
        ))}
      </div>
      <ul className="space-y-2 text-sm">
        {(data.notifications || []).map((n: any) => (
          <li key={n.id} className="border p-3">
            <div className="font-medium">{n.title}</div>
            <div className="text-gray-600">{n.body}</div>
            <div className="text-xs mt-1">
              {n.channel} · {n.delivery_status}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

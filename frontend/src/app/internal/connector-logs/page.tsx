"use client";

import { useEffect, useState } from "react";

type Log = { id: string; connector_id: string; level: string; message: string; created_at: string | null };

export default function ConnectorLogsPage() {
  const [rows, setRows] = useState<Log[]>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/connectors/logs?limit=150");
      if (res.ok) setRows(await res.json());
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Connector Logs</h1>
      <a className="text-sm underline" href="/internal/integrations">← Dashboard</a>
      <ul className="space-y-2 text-sm">
        {rows.map((l) => (
          <li key={l.id} className="border bg-white p-3">
            <div className="text-xs text-gray-500">{l.created_at} · {l.level} · {l.connector_id.slice(0, 8)}</div>
            <div>{l.message}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

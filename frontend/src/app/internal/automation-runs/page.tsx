"use client";

import { useEffect, useState } from "react";

type Run = {
  id: string;
  workflow_id: string;
  status: string;
  priority: string;
  current_stage: string | null;
  attempt: number;
  duration_ms: number | null;
  trigger: string;
};

export default function AutomationRunsPage() {
  const [rows, setRows] = useState<Run[]>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/automation/runs?limit=100");
      if (res.ok) setRows(await res.json());
    };
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  const running = rows.filter((r) => ["running", "queued", "retrying"].includes(r.status));

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Running Jobs</h1>
      <a className="text-sm underline" href="/internal/automation">← Overview</a>
      <div className="grid md:grid-cols-2 gap-4">
        <QueueGraph rows={rows} />
        <div className="border bg-white p-4">
          <h2 className="font-semibold mb-2">Active ({running.length})</h2>
          <ul className="space-y-2 text-sm">
            {running.map((r) => (
              <li key={r.id} className="border p-2">
                <div>{r.id.slice(0, 8)} · {r.status} · {r.priority}</div>
                <div className="text-gray-500">{r.current_stage || "—"} · attempt {r.attempt}</div>
              </li>
            ))}
            {!running.length ? <li className="text-gray-500">No active jobs</li> : null}
          </ul>
        </div>
      </div>
      <table className="w-full text-sm border bg-white">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">ID</th>
            <th>Status</th>
            <th>Stage</th>
            <th>Priority</th>
            <th>Duration</th>
            <th>Trigger</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2 font-mono text-xs">{r.id.slice(0, 8)}</td>
              <td>{r.status}</td>
              <td>{r.current_stage || "—"}</td>
              <td>{r.priority}</td>
              <td>{r.duration_ms ?? "—"}</td>
              <td>{r.trigger}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function QueueGraph({ rows }: { rows: Run[] }) {
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;
  const max = Math.max(1, ...Object.values(counts));
  return (
    <div className="border bg-white p-4">
      <h2 className="font-semibold mb-3">Queue graph</h2>
      <div className="space-y-2">
        {Object.entries(counts).map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs mb-1"><span>{k}</span><span>{v}</span></div>
            <div className="h-2 bg-gray-100"><div className="h-2 bg-black" style={{ width: `${(v / max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

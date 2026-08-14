"use client";

import { useEffect, useState } from "react";

type Failure = {
  id: string;
  run_id: string;
  stage: string | null;
  error_message: string;
  attempt: number;
  permanent: boolean;
  resolved: boolean;
  created_at: string | null;
};

export default function AutomationFailuresPage() {
  const [rows, setRows] = useState<Failure[]>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/automation/failures?resolved=false");
      if (res.ok) setRows(await res.json());
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const byStage: Record<string, number> = {};
  for (const f of rows) {
    const k = f.stage || "unknown";
    byStage[k] = (byStage[k] || 0) + 1;
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Failure Queue</h1>
      <a className="text-sm underline" href="/internal/automation">← Overview</a>
      <div className="border bg-white p-4">
        <h2 className="font-semibold mb-2">Failure analysis by stage</h2>
        <div className="flex flex-wrap gap-2 text-sm">
          {Object.entries(byStage).map(([k, v]) => (
            <span key={k} className="border px-2 py-1">{k}: {v}</span>
          ))}
          {!Object.keys(byStage).length ? <span className="text-gray-500">No open failures</span> : null}
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((f) => (
          <li key={f.id} className="border bg-white p-3 text-sm">
            <div className="font-semibold">{f.stage || "unknown"} · attempt {f.attempt}{f.permanent ? " · permanent" : ""}</div>
            <div className="text-gray-600">{f.error_message}</div>
            <div className="text-xs text-gray-400">run {f.run_id} · {f.created_at}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

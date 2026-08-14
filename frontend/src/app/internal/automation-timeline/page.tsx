"use client";

import { useEffect, useState } from "react";

type History = {
  id: string;
  run_id: string;
  stage: string | null;
  event: string;
  created_at: string | null;
};

export default function AutomationTimelinePage() {
  const [rows, setRows] = useState<History[]>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/automation/history?limit=150");
      if (res.ok) setRows(await res.json());
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Execution Timeline</h1>
      <a className="text-sm underline" href="/internal/automation">← Overview</a>
      <ol className="border-l-2 border-gray-300 ml-2 space-y-4">
        {rows.map((h) => (
          <li key={h.id} className="ml-4 relative">
            <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full bg-black" />
            <div className="text-xs text-gray-500">{h.created_at}</div>
            <div className="text-sm font-medium">{h.event}{h.stage ? ` · ${h.stage}` : ""}</div>
            <div className="text-xs text-gray-400">run {h.run_id.slice(0, 8)}</div>
          </li>
        ))}
      </ol>
      {!rows.length ? <p className="text-gray-500">No history yet.</p> : null}
    </div>
  );
}

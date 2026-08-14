"use client";

import { useEffect, useState } from "react";

type Run = { id: string; status: string; attempt: number; error_message: string | null };

export default function AutomationRetriesPage() {
  const [rows, setRows] = useState<Run[]>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/automation/runs?limit=200");
      if (res.ok) {
        const all = await res.json();
        setRows(all.filter((r: Run) => r.attempt > 1 || r.status === "retrying"));
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  async function retry(runId: string) {
    await fetch("/api/automation/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_id: runId }),
    });
  }

  const maxAttempt = Math.max(1, ...rows.map((r) => r.attempt), 1);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Retry Queue</h1>
      <a className="text-sm underline" href="/internal/automation">← Overview</a>
      <div className="border bg-white p-4">
        <h2 className="font-semibold mb-2">Retry graph</h2>
        <div className="space-y-2">
          {rows.slice(0, 12).map((r) => (
            <div key={r.id}>
              <div className="flex justify-between text-xs mb-1">
                <span>{r.id.slice(0, 8)} · {r.status}</span>
                <span>attempt {r.attempt}</span>
              </div>
              <div className="h-2 bg-gray-100">
                <div className="h-2 bg-amber-600" style={{ width: `${(r.attempt / maxAttempt) * 100}%` }} />
              </div>
            </div>
          ))}
          {!rows.length ? <p className="text-sm text-gray-500">No retries pending.</p> : null}
        </div>
      </div>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className="border bg-white p-3 flex justify-between gap-3 text-sm">
            <div>
              <div className="font-mono text-xs">{r.id}</div>
              <div>{r.status} · attempt {r.attempt}</div>
              <div className="text-gray-500">{r.error_message || ""}</div>
            </div>
            <button className="border px-3 py-1 h-fit" onClick={() => retry(r.id)}>Retry</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

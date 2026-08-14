"use client";

import { useEffect, useState } from "react";

type Workflow = {
  id: string;
  name: string;
  enabled: boolean;
  priority: string;
  retry_policy: string;
  max_attempts: number;
  stages_json: string;
};

export default function AutomationWorkflowsPage() {
  const [rows, setRows] = useState<Workflow[]>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/automation/workflows");
      if (res.ok) setRows(await res.json());
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Workflow Viewer</h1>
      <a className="text-sm underline" href="/internal/automation">← Overview</a>
      <div className="space-y-3">
        {rows.map((w) => (
          <div key={w.id} className="border bg-white p-4">
            <div className="font-semibold">{w.name}</div>
            <div className="text-sm text-gray-600">
              {w.enabled ? "enabled" : "disabled"} · {w.priority} · retry {w.retry_policy} · max {w.max_attempts}
            </div>
            <pre className="mt-2 text-xs overflow-auto">{w.stages_json}</pre>
          </div>
        ))}
        {!rows.length ? <p className="text-gray-500">No workflows yet.</p> : null}
      </div>
    </div>
  );
}

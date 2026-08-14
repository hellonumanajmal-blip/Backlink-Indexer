"use client";

import { useEffect, useState } from "react";

type Schedule = {
  id: string;
  workflow_id: string;
  schedule_type: string;
  cron_expression: string | null;
  next_run_at: string | null;
  last_run_at: string | null;
  enabled: boolean;
};

export default function AutomationSchedulesPage() {
  const [rows, setRows] = useState<Schedule[]>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/automation/schedules");
      if (res.ok) setRows(await res.json());
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Scheduled Jobs</h1>
      <a className="text-sm underline" href="/internal/automation">← Overview</a>
      <table className="w-full text-sm border bg-white">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">Type</th>
            <th>Cron</th>
            <th>Next</th>
            <th>Last</th>
            <th>Enabled</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b">
              <td className="p-2">{r.schedule_type}</td>
              <td>{r.cron_expression || "—"}</td>
              <td>{r.next_run_at || "—"}</td>
              <td>{r.last_run_at || "—"}</td>
              <td>{r.enabled ? "yes" : "no"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length ? <p className="text-gray-500">No schedules configured.</p> : null}
    </div>
  );
}

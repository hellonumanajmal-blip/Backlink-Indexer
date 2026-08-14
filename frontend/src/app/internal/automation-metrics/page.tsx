"use client";

import { useEffect, useState } from "react";

type Overview = {
  success_rate: number;
  avg_duration_ms: number;
  retry_success_rate: number;
  running_jobs: number;
  queued_jobs: number;
  failed_jobs: number;
  scheduled_jobs: number;
};

export default function AutomationMetricsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/automation/overview");
      if (res.ok) setOverview(await res.json());
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  if (!overview) return <div className="p-6 text-gray-500">Loading metrics…</div>;

  const bars = [
    { label: "Success rate", value: overview.success_rate, max: 100 },
    { label: "Retry success", value: overview.retry_success_rate, max: 100 },
    { label: "Queue depth", value: overview.queued_jobs, max: Math.max(10, overview.queued_jobs) },
    { label: "Failed", value: overview.failed_jobs, max: Math.max(10, overview.failed_jobs) },
    { label: "Scheduled", value: overview.scheduled_jobs, max: Math.max(10, overview.scheduled_jobs) },
  ];

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Automation Metrics</h1>
      <a className="text-sm underline" href="/internal/automation">← Overview</a>
      <p className="text-sm text-gray-600">Avg workflow duration: {Math.round(overview.avg_duration_ms)} ms · Running: {overview.running_jobs}</p>
      <div className="space-y-3 border bg-white p-4">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex justify-between text-sm mb-1">
              <span>{b.label}</span>
              <span>{typeof b.value === "number" ? b.value.toFixed?.(1) ?? b.value : b.value}</span>
            </div>
            <div className="h-3 bg-gray-100">
              <div className="h-3 bg-black" style={{ width: `${Math.min(100, (Number(b.value) / b.max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

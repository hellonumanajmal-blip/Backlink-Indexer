"use client";

import { useCallback, useEffect, useState } from "react";
import { OpsNav } from "../_ops/OpsNav";

export default function PipelineTimelinePage() {
  const [pipeline, setPipeline] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/operations/pipeline");
      if (!res.ok) throw new Error("failed");
      setPipeline(await res.json());
      setError(null);
    } catch {
      setError("Failed to load pipeline");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [load]);

  if (!pipeline && !error) return <div className="p-6 text-gray-500">Loading…</div>;
  if (error && !pipeline) return <div className="p-6 text-red-600">{error}</div>;
  if (!pipeline) return null;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pipeline Timeline</h1>
        <p className="text-sm text-gray-600">Workflow stages from queue through analytics.</p>
      </div>
      <OpsNav />
      <div className="text-sm flex flex-wrap gap-2">
        {(pipeline.stages || []).map((s: string, i: number) => (
          <span key={s} className="flex items-center gap-2">
            <span className="border px-2 py-1">{s}</span>
            {i < (pipeline.stages?.length || 0) - 1 ? <span>↓</span> : null}
          </span>
        ))}
      </div>
      {(pipeline.workflows || []).map((wf: any) => (
        <div key={wf.run_id} className="border p-3 text-sm">
          <div className="font-medium">
            {wf.run_id} · {wf.status} · {wf.current_stage}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {(wf.stages || []).map((st: any) => (
              <span
                key={st.stage}
                className={
                  "px-2 py-0.5 border text-xs " +
                  (st.state === "active"
                    ? "bg-yellow-100"
                    : st.state === "failed"
                      ? "bg-red-100"
                      : st.state === "done"
                        ? "bg-green-50"
                        : "")
                }
              >
                {st.stage}:{st.state}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

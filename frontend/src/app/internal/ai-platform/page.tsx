"use client";

import { useEffect, useState } from "react";

export default function AIPlatformPage() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [knowledge, setKnowledge] = useState<unknown[] | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const [healthResponse, knowledgeResponse] = await Promise.all([
          fetch("/api/ai/health", { headers: { Authorization: "Bearer test" } }),
          fetch("/api/ai/knowledge", { headers: { Authorization: "Bearer test" } }),
        ]);
        if (healthResponse.ok) {
          setHealth(await healthResponse.json());
        }
        if (knowledgeResponse.ok) {
          setKnowledge(await knowledgeResponse.json());
        }
      } catch {
        setHealth({ status: "unavailable" });
      }
    };
    run();
  }, []);

  const sections = [
    "Provider Monitor",
    "Tool Explorer",
    "Prompt Library",
    "Knowledge Explorer",
    "Memory Viewer",
    "Agent Execution Timeline",
    "Analytics Dashboard",
    "Cost Dashboard",
    "MCP Manager",
    "Health Dashboard",
  ];

  return (
    <main className="p-6 text-slate-100">
      <h1 className="text-2xl font-semibold">AI Platform</h1>
      <p className="mt-2 text-sm text-slate-300">
        Production AI platform controls for providers, tools, prompts, knowledge, memory, MCP, analytics, and costs.
      </p>
      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200">
        <div>Health status: {typeof health?.status === "string" ? health.status : "loading"}</div>
        <div>Knowledge documents: {knowledge ? knowledge.length : "loading"}</div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <div key={section} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
            <div className="text-sm text-slate-300">{section}</div>
          </div>
        ))}
      </div>
    </main>
  );
}

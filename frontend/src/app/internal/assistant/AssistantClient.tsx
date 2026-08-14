"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tab =
  | "chat"
  | "executive"
  | "recommendations"
  | "opportunities"
  | "reports"
  | "digests"
  | "settings"
  | "history";

type ChatMsg = { role: "user" | "assistant"; content: string; at: string };

export default function AssistantClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("chat");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<Array<{ name: string; available: boolean }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [history, setHistory] = useState<ChatMsg[]>([]);
  const [explainText, setExplainText] = useState("");
  const [explainMeta, setExplainMeta] = useState<Record<string, unknown> | null>(null);
  const [opportunities, setOpportunities] = useState<Array<Record<string, unknown>>>([]);
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([]);
  const [digestBody, setDigestBody] = useState("");
  const [digestPeriod, setDigestPeriod] = useState("weekly");
  const [reportType, setReportType] = useState("intelligence");
  const [reportFormat, setReportFormat] = useState("markdown");

  const ensureAuth = useCallback(async () => {
    const me = await fetch("/api/auth/me", { credentials: "include" });
    if (me.status === 401) {
      router.push("/internal/login");
      return false;
    }
    return true;
  }, [router]);

  const loadProviders = useCallback(async () => {
    const r = await fetch("/api/assistant/providers", { credentials: "include" });
    if (!r.ok) throw new Error("Failed to load providers (need assistant.view)");
    const d = await r.json();
    setProviders(d.providers || []);
  }, []);

  const loadOpportunities = useCallback(async () => {
    const r = await fetch("/api/assistant/opportunities", { credentials: "include" });
    if (!r.ok) throw new Error("Failed to load opportunities");
    const d = await r.json();
    setOpportunities(d.items || []);
  }, []);

  const loadReports = useCallback(async () => {
    const r = await fetch("/api/intelligence/reports", { credentials: "include" });
    if (!r.ok) {
      setReports([]);
      return;
    }
    setReports((await r.json()).items || []);
  }, []);

  useEffect(() => {
    void (async () => {
      if (!(await ensureAuth())) return;
      setError("");
      try {
        if (tab === "settings" || tab === "chat") await loadProviders();
        if (tab === "opportunities" || tab === "recommendations") await loadOpportunities();
        if (tab === "reports") await loadReports();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Load failed");
      }
    })();
  }, [tab, ensureAuth, loadProviders, loadOpportunities, loadReports]);

  async function sendChat() {
    if (!chatInput.trim()) return;
    setLoading(true);
    setError("");
    const userMsg = chatInput.trim();
    setChatInput("");
    setHistory((h) => [...h, { role: "user", content: userMsg, at: new Date().toISOString() }]);
    try {
      const r = await fetch("/api/assistant/chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, conversation_id: conversationId }),
      });
      if (!r.ok) throw new Error("Chat failed (need assistant.chat)");
      const d = await r.json();
      setConversationId(d.conversation_id || null);
      setHistory((h) => [
        ...h,
        { role: "assistant", content: d.reply || "", at: new Date().toISOString() },
      ]);
      if (d.opportunity_ranking?.length) setOpportunities(d.opportunity_ranking);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chat failed");
    } finally {
      setLoading(false);
    }
  }

  async function runExplain(summaryType: string) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/assistant/explain", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary_type: summaryType }),
      });
      if (!r.ok) throw new Error("Explain failed (need assistant.view)");
      const d = await r.json();
      setExplainText(d.text || "");
      setExplainMeta({
        provider: d.provider,
        prompt_version: d.prompt_version,
        latency_ms: d.latency_ms,
        cache_hit: d.cache_hit,
        fallback_used: d.fallback_used,
        evidence_meta: d.evidence_meta,
      });
      if (d.opportunity_ranking?.length) setOpportunities(d.opportunity_ranking);
      setMessage(`Explained via ${d.provider}${d.cache_hit ? " (cache)" : ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Explain failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateDigest() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/intelligence/digest", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period: digestPeriod, format: "markdown", use_ai_intro: true }),
      });
      if (!r.ok) throw new Error("Digest failed (need digests.manage)");
      const d = await r.json();
      setDigestBody(d.body || "");
      setMessage(`Digest ${d.id} ready (${d.period})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Digest failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/intelligence/reports/generate", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: reportType, format: reportFormat, with_ai: true }),
      });
      if (!r.ok) throw new Error("Report failed (need reports.generate)");
      const d = await r.json();
      setMessage(`Report ${d.id} (${d.status}) — ${d.file_path || ""}`);
      await loadReports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Report failed");
    } finally {
      setLoading(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "chat", label: "Chat" },
    { id: "executive", label: "Executive Summary" },
    { id: "recommendations", label: "Recommendations" },
    { id: "opportunities", label: "Opportunity Ranking" },
    { id: "reports", label: "Reports" },
    { id: "digests", label: "Scheduled Digests" },
    { id: "settings", label: "AI Settings" },
    { id: "history", label: "Conversation History" },
  ];

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--moss-deep)]">PintDown</p>
            <p className="text-sm text-[var(--muted)]">AI Assistant &amp; Intelligence Reports</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/internal/backlinks" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Backlinks
            </a>
            <a href="/internal/intelligence" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Intelligence
            </a>
            <a href="/internal/analytics" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Analytics
            </a>
            <a href="/internal/admin" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Admin
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <aside className="border border-[var(--line)] bg-[#f7faf7] px-4 py-3 text-sm text-[var(--muted)]">
          Scores are deterministic (Phase 6). The assistant explains observed data only — it never
          calculates Discovery, Quality, Health, or Indexability scores.
        </aside>

        {error ? (
          <p className="border border-[var(--alert)]/40 bg-[#fff7f0] px-4 py-2 text-sm text-[var(--alert)]">
            {error}
          </p>
        ) : null}
        {message ? <p className="text-sm text-[var(--moss-deep)]">{message}</p> : null}

        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "bg-[var(--ink)] px-3 py-1.5 text-sm text-white"
                  : "border border-[var(--line)] px-3 py-1.5 text-sm"
              }
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "chat" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Chat</h2>
            <div className="max-h-96 space-y-3 overflow-y-auto text-sm">
              {history.length === 0 ? (
                <p className="text-[var(--muted)]">
                  Ask e.g. “Why did Discovery Score drop?” or “What should I fix first?”
                </p>
              ) : (
                history.map((m, i) => (
                  <div
                    key={`${m.at}-${i}`}
                    className={m.role === "user" ? "text-[var(--ink)]" : "text-[var(--moss-deep)]"}
                  >
                    <span className="text-xs uppercase text-[var(--muted)]">{m.role}</span>
                    <pre className="mt-1 whitespace-pre-wrap font-sans">{m.content}</pre>
                  </div>
                ))
              )}
            </div>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-[var(--line)] px-3 py-2 text-sm"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void sendChat();
                }}
                placeholder="Ask about scores, anomalies, priorities…"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => void sendChat()}
                disabled={loading}
                className="bg-[var(--ink)] px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </section>
        ) : null}

        {tab === "executive" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Executive Summary</h2>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="border border-[var(--line)] px-3 py-1.5 text-sm"
                onClick={() => void runExplain("executive_summary")}
                disabled={loading}
              >
                Generate executive
              </button>
              <button
                type="button"
                className="border border-[var(--line)] px-3 py-1.5 text-sm"
                onClick={() => void runExplain("technical_summary")}
                disabled={loading}
              >
                Generate technical
              </button>
            </div>
            {explainMeta ? (
              <p className="text-xs text-[var(--muted)]">
                provider={String(explainMeta.provider)} · prompt_v=
                {String(explainMeta.prompt_version)} · latency=
                {String(explainMeta.latency_ms)}ms · cache=
                {String(explainMeta.cache_hit)} · fallback=
                {String(explainMeta.fallback_used)}
              </p>
            ) : null}
            <pre className="whitespace-pre-wrap font-sans text-sm">{explainText || "No summary yet."}</pre>
          </section>
        ) : null}

        {tab === "recommendations" || tab === "opportunities" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg">
                {tab === "opportunities" ? "Opportunity Ranking" : "Recommendations"}
              </h2>
              <button
                type="button"
                className="border border-[var(--line)] px-3 py-1.5 text-sm"
                onClick={() => void runExplain("recommendation_rewrite")}
                disabled={loading}
              >
                Explain ranking
              </button>
            </div>
            <p className="text-sm text-[var(--muted)]">
              Ranking is deterministic (priority + impact + discovery gap). LLM only narrates.
            </p>
            <ul className="space-y-2 text-sm">
              {opportunities.length === 0 ? (
                <li className="text-[var(--muted)]">No opportunities in evidence yet.</li>
              ) : (
                opportunities.map((o, i) => (
                  <li key={`${o.rank}-${i}`} className="border-b border-[var(--line)] pb-2">
                    <span className="text-[var(--muted)]">#{String(o.rank)}</span>{" "}
                    [{String(o.priority)}] {String(o.title)}{" "}
                    <span className="text-[var(--muted)]">(score {String(o.rank_score)})</span>
                    {o.explanation ? (
                      <p className="mt-1 text-[var(--muted)]">{String(o.explanation)}</p>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {explainText && tab === "recommendations" ? (
              <pre className="mt-4 whitespace-pre-wrap border-t border-[var(--line)] pt-4 font-sans text-sm">
                {explainText}
              </pre>
            ) : null}
          </section>
        ) : null}

        {tab === "reports" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Exportable Intelligence Reports</h2>
            <div className="flex flex-wrap gap-2">
              <select
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                {[
                  "executive",
                  "technical_seo",
                  "discovery",
                  "platform",
                  "health",
                  "intelligence",
                  "recommendation",
                  "trend",
                ].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
              >
                {["markdown", "html", "json", "pdf", "docx"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="bg-[var(--ink)] px-3 py-1.5 text-sm text-white"
                onClick={() => void generateReport()}
                disabled={loading}
              >
                Generate
              </button>
            </div>
            <ul className="space-y-1 text-sm">
              {reports.map((r) => (
                <li key={String(r.id)}>
                  {String(r.report_type)} · {String(r.format)} · {String(r.status)} ·{" "}
                  <span className="text-[var(--muted)]">{String(r.file_path || "")}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === "digests" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Scheduled Digests</h2>
            <div className="flex flex-wrap gap-2">
              <select
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                value={digestPeriod}
                onChange={(e) => setDigestPeriod(e.target.value)}
              >
                {["daily", "weekly", "monthly", "quarterly"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="bg-[var(--ink)] px-3 py-1.5 text-sm text-white"
                onClick={() => void generateDigest()}
                disabled={loading}
              >
                Generate now
              </button>
            </div>
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap font-sans text-sm">
              {digestBody || "No digest generated in this session."}
            </pre>
          </section>
        ) : null}

        {tab === "settings" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">AI Settings / Provider Status</h2>
            <p className="text-sm text-[var(--muted)]">
              Provider is configured via environment (`AI_PROVIDER`). Default is mock for offline
              safety.
            </p>
            <ul className="space-y-2 text-sm">
              {providers.map((p) => (
                <li key={p.name} className="flex items-center gap-2">
                  <span
                    className={
                      p.available
                        ? "inline-block h-2 w-2 rounded-full bg-[var(--moss-deep)]"
                        : "inline-block h-2 w-2 rounded-full bg-[var(--muted)]"
                    }
                  />
                  {p.name} — {p.available ? "available" : "unavailable"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === "history" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Conversation History</h2>
            <p className="text-sm text-[var(--muted)]">
              Session transcript{conversationId ? ` · id ${conversationId}` : ""}.
            </p>
            <ul className="space-y-3 text-sm">
              {history.length === 0 ? (
                <li className="text-[var(--muted)]">No messages yet.</li>
              ) : (
                history.map((m, i) => (
                  <li key={`${m.at}-h-${i}`}>
                    <span className="text-xs text-[var(--muted)]">
                      {m.at} · {m.role}
                    </span>
                    <pre className="mt-1 whitespace-pre-wrap font-sans">{m.content}</pre>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

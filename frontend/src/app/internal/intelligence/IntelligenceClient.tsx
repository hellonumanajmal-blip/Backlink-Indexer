"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KpiCard, Panel, TopList, num } from "@/components/analytics/widgets";

type Tab =
  | "overview"
  | "scores"
  | "recommendations"
  | "anomalies"
  | "predictions"
  | "duplicates"
  | "broken";

export default function IntelligenceClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [overview, setOverview] = useState<Record<string, unknown> | null>(null);
  const [scores, setScores] = useState<Array<Record<string, unknown>>>([]);
  const [recs, setRecs] = useState<Array<Record<string, unknown>>>([]);
  const [anomalies, setAnomalies] = useState<Array<Record<string, unknown>>>([]);
  const [predictions, setPredictions] = useState<Array<Record<string, unknown>>>([]);
  const [duplicates, setDuplicates] = useState<Array<Record<string, unknown>>>([]);
  const [broken, setBroken] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const me = await fetch("/api/auth/me", { credentials: "include" });
    if (me.status === 401) {
      router.push("/internal/login");
      return;
    }
    try {
      if (tab === "overview") {
        const r = await fetch("/api/intelligence/overview", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load overview (need intelligence.view)");
        setOverview(await r.json());
      }
      if (tab === "scores") {
        const r = await fetch("/api/intelligence/scores", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load scores");
        setScores((await r.json()).items || []);
      }
      if (tab === "recommendations") {
        const r = await fetch("/api/intelligence/recommendations", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load recommendations");
        setRecs((await r.json()).items || []);
      }
      if (tab === "anomalies") {
        const r = await fetch("/api/intelligence/anomalies", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load anomalies");
        setAnomalies((await r.json()).items || []);
      }
      if (tab === "predictions") {
        const r = await fetch("/api/intelligence/predictions", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load predictions");
        setPredictions((await r.json()).items || []);
      }
      if (tab === "duplicates") {
        const r = await fetch("/api/intelligence/duplicates", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load duplicates");
        setDuplicates((await r.json()).items || []);
      }
      if (tab === "broken") {
        const r = await fetch("/api/intelligence/broken-links", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load broken links");
        setBroken((await r.json()).items || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [router, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function recalculate() {
    setMessage("");
    const res = await fetch("/api/intelligence/recalculate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "portfolio", force: true }),
    });
    if (!res.ok) {
      setError("Recalculate failed (need intelligence.recalculate)");
      return;
    }
    const d = await res.json();
    setMessage(`Recalculate queued (${d.scope})`);
    setTimeout(() => void load(), 1200);
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: "Overview" },
    { id: "scores", label: "Scores" },
    { id: "recommendations", label: "Recommendations" },
    { id: "anomalies", label: "Anomalies" },
    { id: "predictions", label: "Predictions" },
    { id: "duplicates", label: "Duplicates" },
    { id: "broken", label: "Broken Links" },
  ];

  const bands = (overview?.indexability_bands as Record<string, number>) || {};

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--moss-deep)]">PintDown</p>
            <p className="text-sm text-[var(--muted)]">Discovery Intelligence</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/internal/analytics" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Analytics
            </a>
            <a href="/internal/backlinks" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Backlinks
            </a>
            <a href="/internal/assistant" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Assistant
            </a>
            <button
              type="button"
              className="bg-[var(--moss)] px-3 py-1.5 text-sm font-semibold text-white"
              onClick={() => void recalculate()}
            >
              Recalculate
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <aside className="border border-[var(--alert)]/30 bg-[#fff7f0] px-4 py-3 text-sm text-[var(--alert)]">
          Scores and predictions are deterministic and based on observed technical signals only. They do
          not claim Google indexing outcomes.
        </aside>

        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "bg-[var(--moss)] px-3 py-1.5 text-sm font-semibold text-white"
                  : "border border-[var(--line)] bg-white px-3 py-1.5 text-sm"
              }
            >
              {t.label}
            </button>
          ))}
        </nav>

        {error ? <p className="text-sm text-[var(--alert)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--moss-deep)]">{message}</p> : null}

        {tab === "overview" ? (
          <div className="space-y-4">
            <Panel title="Overview" loading={loading}>
              {overview ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard label="Avg discovery score" value={num(overview.average_discovery_score as number | null)} />
                  <KpiCard label="Sample size" value={num(overview.discovery_sample_size as number, 0)} />
                  <KpiCard label="P0 recommendations" value={num(overview.p0_recommendations as number, 0)} />
                  <KpiCard label="Anomalies" value={num(overview.active_anomalies as number, 0)} />
                  <KpiCard label="Broken links" value={num(overview.broken_links as number, 0)} />
                  <KpiCard label="Duplicate groups" value={num(overview.duplicate_groups as number, 0)} />
                  <KpiCard label="Indexability High" value={bands.High ?? 0} />
                  <KpiCard label="Indexability Low" value={bands.Low ?? 0} />
                </div>
              ) : null}
              {overview ? (
                <p className="mt-4 text-xs text-[var(--muted)]">
                  {String(overview.disclaimer)} · version {String(overview.score_version)}
                </p>
              ) : null}
            </Panel>
            <div className="grid gap-4 lg:grid-cols-3">
              <Panel title="Top opportunities">
                <TopList
                  items={((overview?.top_opportunities as Array<Record<string, unknown>>) || []).map((o) => ({
                    label: `${o.priority} ${o.title}`,
                    value: String(o.backlink_id || "").slice(0, 8),
                  }))}
                />
              </Panel>
              <Panel title="Highest risk">
                <TopList
                  items={((overview?.highest_risk as Array<Record<string, unknown>>) || []).map((o) => ({
                    label: String(o.backlink_id || "").slice(0, 8),
                    value: num(o.score as number | null),
                  }))}
                />
              </Panel>
              <Panel title="Needs attention">
                <TopList
                  items={((overview?.needs_attention as Array<Record<string, unknown>>) || []).map((o) => ({
                    label: String(o.title),
                    value: String(o.severity),
                  }))}
                />
              </Panel>
            </div>
          </div>
        ) : null}

        {tab === "scores" ? (
          <Panel title="Scores" loading={loading}>
            <ul className="space-y-2 text-sm">
              {scores.length === 0 ? (
                <li className="text-[var(--muted)]">No scores yet — run Recalculate.</li>
              ) : (
                scores.slice(0, 80).map((s) => (
                  <li key={String(s.id)} className="border-b border-[var(--line)] py-2">
                    <strong>{String(s.score_type)}</strong> · {num(s.score_value as number | null)}
                    {s.band ? ` (${s.band})` : ""} · conf {num(s.confidence as number | null, 2)} ·{" "}
                    {String(s.backlink_id).slice(0, 8)}…
                    <div className="text-xs text-[var(--muted)]">{String(s.explanation || "").slice(0, 160)}</div>
                    {s.confidence_note ? (
                      <div className="text-xs text-[var(--alert)]">{String(s.confidence_note)}</div>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
          </Panel>
        ) : null}

        {tab === "recommendations" ? (
          <Panel title="Recommendations" loading={loading}>
            <ul className="space-y-2 text-sm">
              {recs.map((r) => (
                <li key={String(r.id)} className="border-b border-[var(--line)] py-2">
                  <span className="font-medium">
                    [{String(r.priority)}] {String(r.title)}
                  </span>{" "}
                  · impact {String(r.impact)} · effort {String(r.effort)}
                  <div className="text-xs text-[var(--muted)]">{String(r.explanation)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {tab === "anomalies" ? (
          <Panel title="Anomalies" loading={loading}>
            <ul className="space-y-2 text-sm">
              {anomalies.map((a) => (
                <li key={String(a.id)} className="border-b border-[var(--line)] py-2">
                  <strong>{String(a.severity)}</strong> · {String(a.title)}
                  <div className="text-xs text-[var(--muted)]">{String(a.explanation)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {tab === "predictions" ? (
          <Panel title="Predictions (advisory)" loading={loading}>
            <ul className="space-y-2 text-sm">
              {predictions.map((p) => (
                <li key={String(p.id)} className="border-b border-[var(--line)] py-2">
                  <strong>{String(p.prediction_type)}</strong> · {num(p.value as number | null)} {String(p.unit || "")} ·
                  conf {num(p.confidence as number | null, 2)}
                  <div className="text-xs text-[var(--muted)]">{String(p.explanation)}</div>
                  <div className="text-xs text-[var(--alert)]">{String(p.disclaimer)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {tab === "duplicates" ? (
          <Panel title="Duplicates" loading={loading}>
            <ul className="space-y-2 text-sm">
              {duplicates.map((d) => (
                <li key={String(d.id)} className="border-b border-[var(--line)] py-2">
                  <strong>{String(d.duplicate_type)}</strong> · count {String(d.count)} ·{" "}
                  {String(d.fingerprint).slice(0, 60)}
                  <div className="text-xs text-[var(--muted)]">{String(d.recommendation || "")}</div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}

        {tab === "broken" ? (
          <Panel title="Broken links" loading={loading}>
            <ul className="space-y-2 text-sm">
              {broken.map((b) => (
                <li key={String(b.id)} className="border-b border-[var(--line)] py-2">
                  <strong>{String(b.issue_type)}</strong> · {String(b.detail)}
                  <div className="text-xs text-[var(--muted)]">{String(b.remediation)}</div>
                </li>
              ))}
            </ul>
          </Panel>
        ) : null}
      </div>
    </main>
  );
}

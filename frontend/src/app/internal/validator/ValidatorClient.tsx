"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type ValidationResult = {
  id: string;
  backlink_id: string;
  validated_at: string;
  final_url: string | null;
  redirect_count: number;
  redirect_chain: string[];
  http_status: number | null;
  response_time_ms: number | null;
  robots_status: string;
  meta_robots: string | null;
  x_robots_tag: string | null;
  canonical_url: string | null;
  canonical_type: string;
  title: string | null;
  h1: string | null;
  word_count: number | null;
  schema_types: string[];
  og_present: boolean;
  twitter_card_present: boolean;
  rel_type: string | null;
  health_score: number;
  warnings: string[];
  recommendations: string[];
  error: string | null;
  disclaimer: string;
};

export default function ValidatorPage() {
  const router = useRouter();
  const params = useSearchParams();
  const id = params?.get("id") || "";
  const [latest, setLatest] = useState<ValidationResult | null>(null);
  const [history, setHistory] = useState<ValidationResult[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const me = await fetch("/api/auth/me", { credentials: "include" });
      if (me.status === 401) {
        router.push("/internal/login");
        return;
      }
      const latestRes = await fetch(`/api/validator/latest/${id}`, { credentials: "include" });
      if (latestRes.status === 404) {
        setLatest(null);
      } else if (!latestRes.ok) {
        throw new Error("Failed to load latest validation");
      } else {
        setLatest(await latestRes.json());
      }
      const histRes = await fetch(`/api/validator/history/${id}?page_size=10`, {
        credentials: "include",
      });
      if (histRes.ok) {
        const data = await histRes.json();
        setHistory(data.items || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revalidate() {
    if (!id) return;
    setMessage("");
    const res = await fetch(`/api/validator/run/${id}`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(typeof data.detail === "string" ? data.detail : "Queue failed");
      return;
    }
    setMessage(`Queued (task ${data.task_id || "eager"}). Refreshing…`);
    setTimeout(() => void load(), 800);
  }

  const scoreColor = useMemo(() => {
    const s = latest?.health_score ?? 0;
    if (s >= 75) return "var(--moss-deep)";
    if (s >= 45) return "#8a6d12";
    return "var(--alert)";
  }, [latest]);

  if (!id) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="font-display text-2xl font-semibold text-[var(--moss-deep)]">Discovery Validator</h1>
        <p className="mt-3 text-[var(--muted)]">
          Open this page from a backlink via “Health”, or pass <code>?id=&lt;backlink-id&gt;</code>.
        </p>
        <a href="/internal/backlinks" className="mt-6 inline-block text-[var(--moss-deep)] underline">
          Back to dashboard
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/80">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--moss-deep)]">PintDown</p>
            <p className="text-sm text-[var(--muted)]">Discovery Validator (technical signals only)</p>
          </div>
          <div className="flex gap-2">
            <a href="/internal/backlinks" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Dashboard
            </a>
            <button
              type="button"
              onClick={() => void revalidate()}
              className="bg-[var(--moss)] px-3 py-1.5 text-sm font-semibold text-white"
            >
              Revalidate
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <aside className="border border-[var(--alert)]/30 bg-[#fff7f0] px-4 py-3 text-sm leading-relaxed text-[var(--alert)]">
          Health Score is advisory technical guidance only. It does <strong>not</strong> predict or
          guarantee indexing. This tool never scrapes Google Search.
        </aside>

        {error ? <p className="text-sm text-[var(--alert)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--moss-deep)]">{message}</p> : null}
        {loading ? <p className="text-sm text-[var(--muted)]">Loading…</p> : null}

        {!loading && !latest ? (
          <section className="border border-[var(--line)] bg-white p-6">
            <p className="text-[var(--muted)]">No validation results yet for this backlink.</p>
            <button
              type="button"
              onClick={() => void revalidate()}
              className="mt-4 bg-[var(--moss)] px-4 py-2 text-sm font-semibold text-white"
            >
              Run first validation
            </button>
          </section>
        ) : null}

        {latest ? (
          <>
            <section className="grid gap-4 sm:grid-cols-3">
              <div className="border border-[var(--line)] bg-white p-4 sm:col-span-1">
                <p className="text-sm text-[var(--muted)]">Health Score</p>
                <p className="mt-1 text-5xl font-semibold" style={{ color: scoreColor }}>
                  {latest.health_score}
                </p>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  {new Date(latest.validated_at).toLocaleString()}
                </p>
              </div>
              <div className="border border-[var(--line)] bg-white p-4 sm:col-span-2">
                <p className="text-sm text-[var(--muted)]">Final URL</p>
                <p className="mt-1 break-all text-sm">{latest.final_url || "—"}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-sm">
                  <span className="border border-[var(--line)] px-2 py-1">HTTP {latest.http_status ?? "—"}</span>
                  <span className="border border-[var(--line)] px-2 py-1">
                    {latest.response_time_ms ?? "—"} ms
                  </span>
                  <span className="border border-[var(--line)] px-2 py-1">
                    redirects: {latest.redirect_count}
                  </span>
                  <span className="border border-[var(--line)] px-2 py-1">
                    robots: {latest.robots_status}
                  </span>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="border border-[var(--line)] bg-white p-4 text-sm">
                <h2 className="font-semibold">Crawl signals</h2>
                <ul className="mt-3 space-y-2 text-[var(--muted)]">
                  <li>Meta robots: {latest.meta_robots || "—"}</li>
                  <li>X-Robots-Tag: {latest.x_robots_tag || "—"}</li>
                  <li>
                    Canonical ({latest.canonical_type}): {latest.canonical_url || "—"}
                  </li>
                  <li>Rel to PintDown: {latest.rel_type || "—"}</li>
                </ul>
              </div>
              <div className="border border-[var(--line)] bg-white p-4 text-sm">
                <h2 className="font-semibold">Content &amp; markup</h2>
                <ul className="mt-3 space-y-2 text-[var(--muted)]">
                  <li>Title: {latest.title || "—"}</li>
                  <li>H1: {latest.h1 || "—"}</li>
                  <li>Word count: {latest.word_count ?? "—"}</li>
                  <li>Schema: {(latest.schema_types || []).join(", ") || "none"}</li>
                  <li>Open Graph: {latest.og_present ? "yes" : "no"}</li>
                  <li>Twitter Card: {latest.twitter_card_present ? "yes" : "no"}</li>
                </ul>
              </div>
            </section>

            {latest.redirect_chain?.length ? (
              <section className="border border-[var(--line)] bg-white p-4 text-sm">
                <h2 className="font-semibold">Redirect chain</h2>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-[var(--muted)]">
                  {latest.redirect_chain.map((u) => (
                    <li key={u} className="break-all">
                      {u}
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2">
              <div className="border border-[var(--line)] bg-white p-4 text-sm">
                <h2 className="font-semibold">Warnings</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
                  {(latest.warnings || []).length === 0 ? (
                    <li>None</li>
                  ) : (
                    latest.warnings.map((w) => <li key={w}>{w}</li>)
                  )}
                </ul>
              </div>
              <div className="border border-[var(--line)] bg-white p-4 text-sm">
                <h2 className="font-semibold">Recommendations</h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--muted)]">
                  {(latest.recommendations || []).length === 0 ? (
                    <li>None</li>
                  ) : (
                    latest.recommendations.map((w) => <li key={w}>{w}</li>)
                  )}
                </ul>
              </div>
            </section>

            <p className="text-xs text-[var(--muted)]">{latest.disclaimer}</p>
          </>
        ) : null}

        {history.length > 0 ? (
          <section className="border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">History</h2>
            <ul className="mt-3 divide-y divide-[var(--line)] text-sm">
              {history.map((h) => (
                <li key={h.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>{new Date(h.validated_at).toLocaleString()}</span>
                  <span>
                    score {h.health_score} · HTTP {h.http_status ?? "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

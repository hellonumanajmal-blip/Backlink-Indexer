"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OperationsClient() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [metrics, setMetrics] = useState<Record<string, unknown> | null>(null);
  const [backups, setBackups] = useState<Array<Record<string, unknown>>>([]);
  const [version, setVersion] = useState<Record<string, unknown> | null>(null);

  const load = useCallback(async () => {
    setError("");
    const me = await fetch("/api/auth/me", { credentials: "include" });
    if (me.status === 401) {
      router.push("/internal/login");
      return;
    }
    try {
      const [h, s, m, b, v] = await Promise.all([
        fetch("/api/operations/health", { credentials: "include" }),
        fetch("/api/operations/status", { credentials: "include" }),
        fetch("/api/operations/metrics", { credentials: "include" }),
        fetch("/api/operations/backups", { credentials: "include" }),
        fetch("/api/operations/version", { credentials: "include" }),
      ]);
      if (!h.ok) throw new Error("Operations health requires admin");
      setHealth(await h.json());
      if (s.ok) setStatus(await s.json());
      if (m.ok) setMetrics(await m.json());
      if (b.ok) {
        const data = await b.json();
        setBackups(Array.isArray(data) ? data : data.items || []);
      }
      if (v.ok) setVersion(await v.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runBackup() {
    const r = await fetch("/api/operations/backups/run?type=config", {
      method: "POST",
      credentials: "include",
    });
    if (!r.ok) {
      setError("Backup run failed");
      return;
    }
    const d = await r.json();
    setMessage(`Backup ${d.backup_id || "started"} (${d.status})`);
    void load();
  }

  async function verifyLatest() {
    const id = backups[0]?.id;
    if (!id) {
      setError("No backups to verify");
      return;
    }
    const r = await fetch(`/api/operations/backups/verify?backup_id=${id}`, {
      method: "POST",
      credentials: "include",
    });
    if (!r.ok) {
      setError("Verify failed");
      return;
    }
    setMessage(JSON.stringify(await r.json()));
    void load();
  }

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--moss-deep)]">PintDown</p>
            <p className="text-sm text-[var(--muted)]">Operations &amp; Reliability</p>
          </div>
          <div className="flex gap-2">
            <a href="/internal/billing" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Billing
            </a>
            <a href="/internal/admin" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Admin
            </a>
            <a href="/metrics" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              /metrics
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {error ? <p className="text-sm text-[var(--alert)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--moss-deep)]">{message}</p> : null}

        <section className="grid gap-4 md:grid-cols-2">
          <div className="border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">System health</h2>
            <pre className="mt-2 max-h-64 overflow-auto text-xs">{JSON.stringify(health, null, 2)}</pre>
          </div>
          <div className="border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Build / environment</h2>
            <pre className="mt-2 max-h-64 overflow-auto text-xs">{JSON.stringify(version, null, 2)}</pre>
          </div>
          <div className="border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Metrics snapshot</h2>
            <pre className="mt-2 max-h-64 overflow-auto text-xs">{JSON.stringify(metrics, null, 2)}</pre>
          </div>
          <div className="border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Full status</h2>
            <pre className="mt-2 max-h-64 overflow-auto text-xs">{JSON.stringify(status, null, 2)}</pre>
          </div>
        </section>

        <section className="border border-[var(--line)] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-lg">Backups</h2>
            <div className="flex gap-2">
              <button type="button" className="bg-[var(--ink)] px-3 py-1.5 text-sm text-white" onClick={() => void runBackup()}>
                Run config backup
              </button>
              <button type="button" className="border border-[var(--line)] px-3 py-1.5 text-sm" onClick={() => void verifyLatest()}>
                Verify latest
              </button>
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-sm">
            {backups.length === 0 ? (
              <li className="text-[var(--muted)]">No backups yet.</li>
            ) : (
              backups.map((b) => (
                <li key={String(b.id)}>
                  {String(b.type || b.backup_type)} · {String(b.status)} · {String(b.id)} ·{" "}
                  {b.verified ? "verified" : "unverified"}
                </li>
              ))
            )}
          </ul>
        </section>

        <aside className="text-sm text-[var(--muted)]">
          Probes: <code>/healthz/liveness</code>, <code>/healthz/readiness</code>, <code>/healthz/startup</code>. Alerts:{" "}
          <code>deploy/prometheus/alerts.yml</code>.
        </aside>
      </div>
    </main>
  );
}

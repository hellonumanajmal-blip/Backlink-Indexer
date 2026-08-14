"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

type Tab = "billing" | "subscriptions" | "api" | "sso" | "scim" | "branding" | "portfolio";

const PATH_TAB: Record<string, Tab> = {
  "/internal/billing": "billing",
  "/internal/subscriptions": "subscriptions",
  "/internal/api": "api",
  "/internal/sso": "sso",
  "/internal/scim": "scim",
  "/internal/branding": "branding",
  "/internal/portfolio": "portfolio",
};

export default function CommercialClient() {
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<Tab>(PATH_TAB[pathname || ""] || "billing");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [billing, setBilling] = useState<Record<string, unknown> | null>(null);
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const [portfolio, setPortfolio] = useState<Record<string, unknown> | null>(null);
  const [branding, setBranding] = useState<Record<string, unknown> | null>(null);
  const [sdk, setSdk] = useState<Array<Record<string, unknown>>>([]);
  const [sso, setSso] = useState<Array<Record<string, unknown>>>([]);
  const [primary, setPrimary] = useState("#1a3c34");
  const [scimToken, setScimToken] = useState("");

  useEffect(() => {
    if (pathname && PATH_TAB[pathname]) setTab(PATH_TAB[pathname]);
  }, [pathname]);

  const load = useCallback(async () => {
    setError("");
    const me = await fetch("/api/auth/me", { credentials: "include" });
    if (me.status === 401) {
      router.push("/internal/login");
      return;
    }
    try {
      if (tab === "billing" || tab === "subscriptions") {
        const r = await fetch("/api/billing", { credentials: "include" });
        if (!r.ok) throw new Error("Billing load failed");
        setBilling(await r.json());
        const u = await fetch("/api/usage/current", { credentials: "include" });
        if (u.ok) setUsage(await u.json());
      }
      if (tab === "api") {
        const r = await fetch("/api/public/sdk", { credentials: "include" });
        if (r.ok) setSdk((await r.json()).items || []);
      }
      if (tab === "portfolio") {
        const r = await fetch("/api/portfolio", { credentials: "include" });
        if (!r.ok) throw new Error("Portfolio failed");
        setPortfolio(await r.json());
      }
      if (tab === "branding") {
        const r = await fetch("/api/branding", { credentials: "include" });
        if (!r.ok) throw new Error("Branding failed");
        const d = await r.json();
        setBranding(d);
        setPrimary(String(d.primary_color || "#1a3c34"));
      }
      if (tab === "sso") {
        const r = await fetch("/api/sso/providers", { credentials: "include" });
        if (r.ok) setSso((await r.json()).items || []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [router, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function checkout(plan: string) {
    const r = await fetch("/api/billing/checkout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan_code: plan }),
    });
    if (!r.ok) {
      setError("Checkout failed");
      return;
    }
    const d = await r.json();
    setMessage(`Checkout ready (${d.provider}): ${d.checkout_url}`);
    void load();
  }

  async function saveBranding() {
    const r = await fetch("/api/branding", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primary_color: primary }),
    });
    if (!r.ok) {
      setError("Save branding failed");
      return;
    }
    setBranding(await r.json());
    setMessage("Branding saved");
  }

  async function enableOidc() {
    const r = await fetch("/api/sso/providers", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "oidc", enabled: true, config: { mock: true } }),
    });
    if (!r.ok) {
      setError("SSO enable failed");
      return;
    }
    setMessage("OIDC mock provider enabled");
    void load();
  }

  async function mintScim() {
    const r = await fetch("/api/scim/tokens", { method: "POST", credentials: "include" });
    if (!r.ok) {
      setError("SCIM token failed");
      return;
    }
    const d = await r.json();
    setScimToken(d.token || "");
    setMessage("SCIM token minted (shown once)");
  }

  const tabs: Array<{ id: Tab; href: string; label: string }> = [
    { id: "billing", href: "/internal/billing", label: "Billing" },
    { id: "subscriptions", href: "/internal/subscriptions", label: "Subscriptions" },
    { id: "api", href: "/internal/api", label: "Public API" },
    { id: "sso", href: "/internal/sso", label: "SSO" },
    { id: "scim", href: "/internal/scim", label: "SCIM" },
    { id: "branding", href: "/internal/branding", label: "Branding" },
    { id: "portfolio", href: "/internal/portfolio", label: "Portfolio" },
  ];

  const plan = (billing?.plan as Record<string, unknown>) || {};

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--moss-deep)]">PintDown</p>
            <p className="text-sm text-[var(--muted)]">Commercial SaaS Console</p>
          </div>
          <a href="/internal/organisations" className="border border-[var(--line)] px-3 py-1.5 text-sm">
            Orgs
          </a>
        </div>
      </header>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        {error ? <p className="text-sm text-[var(--alert)]">{error}</p> : null}
        {message ? <p className="text-sm text-[var(--moss-deep)]">{message}</p> : null}
        <nav className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <a
              key={t.id}
              href={t.href}
              className={
                tab === t.id
                  ? "bg-[var(--ink)] px-3 py-1.5 text-sm text-white"
                  : "border border-[var(--line)] px-3 py-1.5 text-sm"
              }
            >
              {t.label}
            </a>
          ))}
        </nav>

        {(tab === "billing" || tab === "subscriptions") && (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Plan &amp; invoices</h2>
            <p className="text-sm">
              Current: <strong>{String(plan.name || "—")}</strong> ({String(billing?.status || "")}) ·{" "}
              {String(plan.price_cents || 0)}¢ / {String(plan.interval || "month")}
            </p>
            <div className="flex flex-wrap gap-2">
              {["starter", "professional", "business"].map((p) => (
                <button
                  key={p}
                  type="button"
                  className="border border-[var(--line)] px-3 py-1.5 text-sm"
                  onClick={() => void checkout(p)}
                >
                  Upgrade {p}
                </button>
              ))}
            </div>
            <pre className="max-h-64 overflow-auto text-xs">{JSON.stringify(usage, null, 2)}</pre>
            <pre className="max-h-40 overflow-auto text-xs">{JSON.stringify(billing?.invoices || [], null, 2)}</pre>
          </section>
        )}

        {tab === "api" && (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Public API &amp; SDKs</h2>
            <p className="text-sm text-[var(--muted)]">
              OpenAPI: <a className="underline" href="/api/public/openapi">/api/public/openapi</a> · v1 base{" "}
              <code>/api/v1</code>
            </p>
            <ul className="space-y-2 text-sm">
              {sdk.map((s) => (
                <li key={String(s.language)}>
                  {String(s.language)} — {String(s.name)} ({String(s.path)})
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "sso" && (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Enterprise SSO</h2>
            <button type="button" className="bg-[var(--ink)] px-3 py-1.5 text-sm text-white" onClick={() => void enableOidc()}>
              Enable mock OIDC
            </button>
            <ul className="text-sm">
              {sso.map((p) => (
                <li key={String(p.id)}>
                  {String(p.name)} ({String(p.slug)}) — {p.enabled ? "on" : "off"}
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "scim" && (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">SCIM provisioning</h2>
            <button type="button" className="bg-[var(--ink)] px-3 py-1.5 text-sm text-white" onClick={() => void mintScim()}>
              Mint SCIM token
            </button>
            {scimToken ? <code className="block break-all text-xs">{scimToken}</code> : null}
            <p className="text-sm text-[var(--muted)]">Endpoint: /api/scim/v2/Users</p>
          </section>
        )}

        {tab === "branding" && (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">White-label branding</h2>
            <div className="flex items-center gap-3">
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
              <button type="button" className="border border-[var(--line)] px-3 py-1.5 text-sm" onClick={() => void saveBranding()}>
                Save
              </button>
            </div>
            <div className="h-24 w-full" style={{ background: primary }} />
            <pre className="text-xs">{JSON.stringify(branding, null, 2)}</pre>
          </section>
        )}

        {tab === "portfolio" && (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Organisation portfolio</h2>
            <pre className="max-h-96 overflow-auto text-xs">{JSON.stringify(portfolio, null, 2)}</pre>
          </section>
        )}
      </div>
    </main>
  );
}

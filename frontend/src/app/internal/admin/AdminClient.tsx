"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "users" | "roles" | "audit" | "tokens" | "webhooks" | "settings";

export default function AdminClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [users, setUsers] = useState<Array<Record<string, unknown>>>([]);
  const [roles, setRoles] = useState<Array<Record<string, unknown>>>([]);
  const [audit, setAudit] = useState<Array<Record<string, unknown>>>([]);
  const [tokens, setTokens] = useState<Array<Record<string, unknown>>>([]);
  const [webhooks, setWebhooks] = useState<Array<Record<string, unknown>>>([]);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "viewer" });
  const [tokenName, setTokenName] = useState("CI token");
  const [wh, setWh] = useState({ name: "", url: "", events: "BacklinkCreated" });

  const ensureAuth = useCallback(async () => {
    const me = await fetch("/api/auth/me", { credentials: "include" });
    if (me.status === 401) {
      router.push("/internal/login");
      return false;
    }
    return true;
  }, [router]);

  const load = useCallback(async () => {
    setError("");
    if (!(await ensureAuth())) return;
    try {
      if (tab === "users") {
        const r = await fetch("/api/users", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load users");
        setUsers(await r.json());
      }
      if (tab === "roles") {
        const [rr, pr] = await Promise.all([
          fetch("/api/roles", { credentials: "include" }),
          fetch("/api/permissions", { credentials: "include" }),
        ]);
        if (!rr.ok) throw new Error("Failed to load roles");
        setRoles(await rr.json());
        if (pr.ok) {
          /* permissions available via roles */
        }
      }
      if (tab === "audit") {
        const r = await fetch("/api/audit?page_size=50", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load audit");
        setAudit(await r.json());
      }
      if (tab === "tokens") {
        const r = await fetch("/api/api-tokens", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load tokens");
        setTokens(await r.json());
      }
      if (tab === "webhooks") {
        const r = await fetch("/api/webhooks", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load webhooks");
        setWebhooks(await r.json());
      }
      if (tab === "settings") {
        const r = await fetch("/api/settings", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load settings");
        const d = await r.json();
        setSettings(d.values || {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [ensureAuth, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createUser() {
    const res = await fetch("/api/users", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: newUser.username,
        password: newUser.password,
        role_slugs: [newUser.role],
      }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(typeof d.detail === "string" ? d.detail : "Create user failed");
      return;
    }
    setMessage("User created");
    setNewUser({ username: "", password: "", role: "viewer" });
    await load();
  }

  async function createToken() {
    const res = await fetch("/api/api-tokens", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: tokenName, scopes: ["read", "analytics"] }),
    });
    const d = await res.json();
    if (!res.ok) {
      setError("Token create failed");
      return;
    }
    setMessage(`Token created (copy now): ${d.token}`);
    await load();
  }

  async function createWebhook() {
    const res = await fetch("/api/webhooks", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: wh.name,
        url: wh.url,
        events: wh.events.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    });
    if (!res.ok) {
      setError("Webhook create failed");
      return;
    }
    setMessage("Webhook created");
    setWh({ name: "", url: "", events: "BacklinkCreated" });
    await load();
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "users", label: "Users" },
    { id: "roles", label: "Roles" },
    { id: "audit", label: "Audit Logs" },
    { id: "tokens", label: "API Tokens" },
    { id: "webhooks", label: "Webhooks" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--moss-deep)]">PintDown</p>
            <p className="text-sm text-[var(--muted)]">System Administration</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/internal/backlinks" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Backlinks
            </a>
            <a href="/internal/analytics" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Analytics
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
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
        {message ? <p className="text-sm text-[var(--moss-deep)] break-all">{message}</p> : null}

        {tab === "users" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">Users</h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                placeholder="Username"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              />
              <input
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                placeholder="Password (min 10)"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              />
              <select
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              >
                <option value="viewer">Viewer</option>
                <option value="analyst">Analyst</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <button type="button" className="bg-[var(--moss)] px-3 py-1.5 text-sm text-white" onClick={() => void createUser()}>
                Invite / create
              </button>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="text-[var(--muted)]">
                <tr>
                  <th className="py-2">Username</th>
                  <th>Status</th>
                  <th>Roles</th>
                  <th>Last login</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={String(u.id)} className="border-t border-[var(--line)]">
                    <td className="py-2">{String(u.username)}</td>
                    <td>{String(u.status)}</td>
                    <td>{Array.isArray(u.roles) ? u.roles.join(", ") : ""}</td>
                    <td>{u.last_login_at ? new Date(String(u.last_login_at)).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {tab === "roles" ? (
          <section className="space-y-3 border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">Roles &amp; permissions</h2>
            {roles.map((r) => (
              <div key={String(r.id)} className="border-b border-[var(--line)] py-3">
                <p className="font-medium">
                  {String(r.name)} <span className="text-[var(--muted)]">({String(r.slug)})</span>
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">{String(r.description || "")}</p>
                <p className="mt-2 text-xs">{Array.isArray(r.permissions) ? r.permissions.join(" · ") : ""}</p>
              </div>
            ))}
          </section>
        ) : null}

        {tab === "audit" ? (
          <section className="border border-[var(--line)] bg-white p-4">
            <h2 className="mb-3 font-semibold">Audit log</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[var(--muted)]">
                  <tr>
                    <th className="py-2">When</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>OK</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((a) => (
                    <tr key={String(a.id)} className="border-t border-[var(--line)]">
                      <td className="py-2">{a.timestamp ? new Date(String(a.timestamp)).toLocaleString() : "—"}</td>
                      <td>{String(a.username || "—")}</td>
                      <td>{String(a.action)}</td>
                      <td>
                        {String(a.resource || "")} {a.resource_id ? `#${String(a.resource_id).slice(0, 8)}` : ""}
                      </td>
                      <td>{a.success ? "✓" : "✗"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {tab === "tokens" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">API tokens</h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                value={tokenName}
                onChange={(e) => setTokenName(e.target.value)}
              />
              <button type="button" className="bg-[var(--moss)] px-3 py-1.5 text-sm text-white" onClick={() => void createToken()}>
                Create token
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {tokens.map((t) => (
                <li key={String(t.id)} className="border-b border-[var(--line)] py-2">
                  {String(t.name)} · {String(t.token_prefix)}… ·{" "}
                  {Array.isArray(t.scopes) ? t.scopes.join(",") : ""} ·{" "}
                  {t.revoked_at ? "revoked" : "active"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === "webhooks" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-semibold">Webhooks</h2>
            <div className="flex flex-wrap gap-2">
              <input
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                placeholder="Name"
                value={wh.name}
                onChange={(e) => setWh({ ...wh, name: e.target.value })}
              />
              <input
                className="min-w-[220px] flex-1 border border-[var(--line)] px-2 py-1.5 text-sm"
                placeholder="https://…"
                value={wh.url}
                onChange={(e) => setWh({ ...wh, url: e.target.value })}
              />
              <input
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                placeholder="Events comma-separated"
                value={wh.events}
                onChange={(e) => setWh({ ...wh, events: e.target.value })}
              />
              <button type="button" className="bg-[var(--moss)] px-3 py-1.5 text-sm text-white" onClick={() => void createWebhook()}>
                Add
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {webhooks.map((w) => (
                <li key={String(w.id)} className="border-b border-[var(--line)] py-2">
                  <strong>{String(w.name)}</strong> → {String(w.url)} ·{" "}
                  {Array.isArray(w.events) ? w.events.join(", ") : ""} · {w.enabled ? "on" : "off"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === "settings" ? (
          <section className="border border-[var(--line)] bg-white p-4">
            <h2 className="mb-3 font-semibold">Runtime settings</h2>
            <pre className="overflow-x-auto text-xs text-[var(--muted)]">{JSON.stringify(settings, null, 2)}</pre>
            <p className="mt-3 text-xs text-[var(--muted)]">
              Use PUT /api/settings with editable keys (websub hubs, IndexNow, Telegram, cache, queue, webhook defaults).
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

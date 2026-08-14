"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "organisations" | "workspaces" | "projects" | "usage" | "features";

export default function TenancyClient() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("organisations");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [orgs, setOrgs] = useState<Array<Record<string, unknown>>>([]);
  const [workspaces, setWorkspaces] = useState<Array<Record<string, unknown>>>([]);
  const [projects, setProjects] = useState<Array<Record<string, unknown>>>([]);
  const [activeProject, setActiveProject] = useState("");
  const [usage, setUsage] = useState<Record<string, unknown> | null>(null);
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [orgName, setOrgName] = useState("");
  const [wsName, setWsName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [selectedOrg, setSelectedOrg] = useState("");
  const [selectedWs, setSelectedWs] = useState("");

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
      if (tab === "organisations") {
        const r = await fetch("/api/organisations", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load organisations (need orgs.view)");
        const d = await r.json();
        setOrgs(d.items || []);
        if (!selectedOrg && d.items?.[0]?.id) setSelectedOrg(String(d.items[0].id));
      }
      if (tab === "workspaces") {
        const q = selectedOrg ? `?organisation_id=${selectedOrg}` : "";
        const r = await fetch(`/api/workspaces${q}`, { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load workspaces");
        const d = await r.json();
        setWorkspaces(d.items || []);
        if (!selectedWs && d.items?.[0]?.id) setSelectedWs(String(d.items[0].id));
      }
      if (tab === "projects") {
        const q = selectedOrg ? `?organisation_id=${selectedOrg}` : "";
        const r = await fetch(`/api/projects${q}`, { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load projects");
        const d = await r.json();
        setProjects(d.items || []);
        setActiveProject(String(d.active_project_id || ""));
      }
      if (tab === "usage") {
        const r = await fetch("/api/usage", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load usage");
        setUsage(await r.json());
      }
      if (tab === "features") {
        const r = await fetch("/api/features", { credentials: "include" });
        if (!r.ok) throw new Error("Failed to load features");
        const d = await r.json();
        setFeatures(d.features || {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, [ensureAuth, tab, selectedOrg, selectedWs]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createOrg() {
    if (!orgName.trim()) return;
    const r = await fetch("/api/organisations", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName.trim() }),
    });
    if (!r.ok) {
      setError("Create organisation failed (need orgs.manage)");
      return;
    }
    setOrgName("");
    setMessage("Organisation created");
    setTab("organisations");
    void load();
  }

  async function createWorkspace() {
    if (!wsName.trim() || !selectedOrg) return;
    const r = await fetch("/api/workspaces", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ organisation_id: selectedOrg, name: wsName.trim() }),
    });
    if (!r.ok) {
      setError("Create workspace failed");
      return;
    }
    setWsName("");
    setMessage("Workspace created");
    void load();
  }

  async function createProject() {
    if (!projectName.trim() || !selectedWs) return;
    const r = await fetch("/api/projects", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspace_id: selectedWs, name: projectName.trim() }),
    });
    if (!r.ok) {
      setError("Create project failed");
      return;
    }
    setProjectName("");
    setMessage("Project created");
    void load();
  }

  async function switchProject(id: string) {
    const r = await fetch("/api/projects/switch", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project_id: id }),
    });
    if (!r.ok) {
      setError("Switch failed (need projects.switch)");
      return;
    }
    setActiveProject(id);
    setMessage(`Switched to project ${id.slice(0, 8)}…`);
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "organisations", label: "Organisations" },
    { id: "workspaces", label: "Workspaces" },
    { id: "projects", label: "Projects" },
    { id: "usage", label: "Usage" },
    { id: "features", label: "Features" },
  ];

  return (
    <main className="min-h-screen bg-[var(--paper)] text-[var(--ink)]">
      <header className="border-b border-[var(--line)] bg-white/80">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4">
          <div>
            <p className="font-display text-xl font-semibold text-[var(--moss-deep)]">PintDown</p>
            <p className="text-sm text-[var(--muted)]">Organisations · Workspaces · Projects</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/internal/backlinks" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Backlinks
            </a>
            <a href="/internal/assistant" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Assistant
            </a>
            <a href="/internal/admin" className="border border-[var(--line)] px-3 py-1.5 text-sm">
              Admin
            </a>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <aside className="border border-[var(--line)] bg-[#f7faf7] px-4 py-3 text-sm text-[var(--muted)]">
          Multi-tenant isolation is enforced in repositories. Existing single-tenant data lives in the
          Default Organisation / Default Project. Active project:{" "}
          <span className="text-[var(--ink)]">{activeProject || "—"}</span>
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

        {tab === "organisations" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Organisations</h2>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="New organisation name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <button type="button" className="bg-[var(--ink)] px-3 py-2 text-sm text-white" onClick={() => void createOrg()}>
                Create
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {orgs.map((o) => (
                <li key={String(o.id)} className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                  <span>
                    {String(o.name)} <span className="text-[var(--muted)]">({String(o.slug)})</span> — {String(o.status)}
                  </span>
                  <button
                    type="button"
                    className="border border-[var(--line)] px-2 py-1 text-xs"
                    onClick={() => {
                      setSelectedOrg(String(o.id));
                      setTab("workspaces");
                    }}
                  >
                    Open
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === "workspaces" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Workspaces</h2>
            <div className="flex flex-wrap gap-2">
              <select
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={String(o.id)} value={String(o.id)}>
                    {String(o.name)}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Workspace name"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
              />
              <button type="button" className="bg-[var(--ink)] px-3 py-2 text-sm text-white" onClick={() => void createWorkspace()}>
                Create
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {workspaces.map((w) => (
                <li key={String(w.id)}>
                  {String(w.name)} ({String(w.slug)})
                  <button
                    type="button"
                    className="ml-2 border border-[var(--line)] px-2 py-0.5 text-xs"
                    onClick={() => {
                      setSelectedWs(String(w.id));
                      setTab("projects");
                    }}
                  >
                    Projects
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === "projects" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Projects</h2>
            <div className="flex flex-wrap gap-2">
              <select
                className="border border-[var(--line)] px-2 py-1.5 text-sm"
                value={selectedWs}
                onChange={(e) => setSelectedWs(e.target.value)}
              >
                {workspaces.map((w) => (
                  <option key={String(w.id)} value={String(w.id)}>
                    {String(w.name)}
                  </option>
                ))}
              </select>
              <input
                className="flex-1 border border-[var(--line)] px-3 py-2 text-sm"
                placeholder="Project name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
              <button type="button" className="bg-[var(--ink)] px-3 py-2 text-sm text-white" onClick={() => void createProject()}>
                Create
              </button>
            </div>
            <ul className="space-y-2 text-sm">
              {projects.map((p) => (
                <li key={String(p.id)} className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                  <span>
                    {String(p.name)} · {String(p.environment)}
                    {activeProject === String(p.id) ? (
                      <span className="ml-2 text-[var(--moss-deep)]">active</span>
                    ) : null}
                  </span>
                  <button
                    type="button"
                    className="border border-[var(--line)] px-2 py-1 text-xs"
                    onClick={() => void switchProject(String(p.id))}
                  >
                    Switch
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {tab === "usage" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Usage dashboard</h2>
            <pre className="overflow-auto text-xs">{JSON.stringify(usage?.totals || {}, null, 2)}</pre>
          </section>
        ) : null}

        {tab === "features" ? (
          <section className="space-y-4 border border-[var(--line)] bg-white p-4">
            <h2 className="font-display text-lg">Feature flags</h2>
            <ul className="space-y-1 text-sm">
              {Object.entries(features).map(([k, v]) => (
                <li key={k}>
                  {k}: {v ? "on" : "off"}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </main>
  );
}

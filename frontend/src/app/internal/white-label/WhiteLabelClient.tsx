"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Brand {
  id: string;
  brand_name: string;
  domain_name?: string;
  primary_color: string;
  secondary_color: string;
  typography: string;
  logo_url?: string;
  created_at: string;
}

interface Workspace {
  id: string;
  brand_id: string;
  workspace_name: string;
  client_name: string;
  client_email: string;
  status: string;
  created_at: string;
}

interface Report {
  id: string;
  workspace_id: string;
  report_title: string;
  report_type: string;
  format_type: string;
  download_url: string;
  generated_at: string;
}

interface Schedule {
  id: string;
  workspace_id: string;
  schedule_type: string;
  recipients: string[];
  report_type: string;
  status: string;
}

interface Template {
  id: string;
  template_name: string;
  report_type: string;
  created_at: string;
}

interface Asset {
  id: string;
  brand_id: string;
  asset_name: string;
  asset_type: string;
  file_path: string;
}

const Icons = {
  Zap: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  Refresh: ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M23 4v6h-6M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  Shield: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Layers: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  Globe: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
    </svg>
  ),
  Users: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  ),
  Clock: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 022 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Activity: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  Download: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  ),
};

export default function WhiteLabelClient() {
  const [activeTab, setActiveTab] = useState<
    | "brands"
    | "clients"
    | "workspaces"
    | "reports"
    | "schedules"
    | "assets"
    | "templates"
    | "activity"
    | "analytics"
    | "settings"
  >("brands");

  const [loading, setLoading] = useState(false);

  // States
  const [brands, setBrands] = useState<Brand[]>([
    {
      id: "b1",
      brand_name: "Apex Digital Agency",
      domain_name: "apex.agency",
      primary_color: "#0F172A",
      secondary_color: "#10B981",
      typography: "Inter, sans-serif",
      created_at: new Date().toISOString(),
    },
  ]);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([
    {
      id: "ws1",
      brand_id: "b1",
      workspace_name: "Acme Corp Enterprise Search",
      client_name: "Acme Corp",
      client_email: "contact@acme.com",
      status: "Active",
      created_at: new Date().toISOString(),
    },
  ]);

  const [reports, setReports] = useState<Report[]>([
    {
      id: "r1",
      workspace_id: "ws1",
      report_title: "Acme Corp - Executive Summary Q3",
      report_type: "Executive Summary",
      format_type: "PDF",
      download_url: "/api/white-label/reports/download/Acme_Executive_Summary.pdf",
      generated_at: new Date().toISOString(),
    },
  ]);

  const [schedules, setSchedules] = useState<Schedule[]>([
    {
      id: "sch1",
      workspace_id: "ws1",
      schedule_type: "Weekly",
      recipients: ["execs@acme.com"],
      report_type: "Executive Summary",
      status: "Active",
    },
  ]);

  const [templates, setTemplates] = useState<Template[]>([
    {
      id: "tpl1",
      template_name: "Standard Agency Executive Brief",
      report_type: "Executive Summary",
      created_at: new Date().toISOString(),
    },
  ]);

  const [assets, setAssets] = useState<Asset[]>([
    {
      id: "ast1",
      brand_id: "b1",
      asset_name: "Apex Agency Main Logo",
      asset_type: "Logo",
      file_path: "/assets/apex_logo.png",
    },
  ]);

  // Forms
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandDomain, setNewBrandDomain] = useState("");
  const [newWsName, setNewWsName] = useState("");
  const [newWsClient, setNewWsClient] = useState("");
  const [reportType, setReportType] = useState("Executive Summary");
  const [reportFormat, setReportFormat] = useState("PDF");

  const fetchWhiteLabelData = async () => {
    setLoading(true);
    try {
      const [bRes, wRes, rRes, sRes, tRes] = await Promise.all([
        fetch("/api/white-label/brands"),
        fetch("/api/white-label/workspaces"),
        fetch("/api/white-label/reports"),
        fetch("/api/white-label/schedules"),
        fetch("/api/white-label/templates"),
      ]);

      if (bRes.ok) setBrands(await bRes.json());
      if (wRes.ok) setWorkspaces(await wRes.json());
      if (rRes.ok) setReports(await rRes.json());
      if (sRes.ok) setSchedules(await sRes.json());
      if (tRes.ok) setTemplates(await tRes.json());
    } catch (e) {
      console.warn("Using default white-label data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWhiteLabelData();
  }, []);

  const handleCreateBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName) return;
    try {
      const res = await fetch("/api/white-label/brands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_name: newBrandName,
          domain_name: newBrandDomain,
          primary_color: "#0F172A",
          secondary_color: "#10B981",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setBrands((prev) => [...prev, created]);
        setNewBrandName("");
        setNewBrandDomain("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName || !brands.length) return;
    try {
      const res = await fetch("/api/white-label/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand_id: brands[0].id,
          workspace_name: newWsName,
          client_name: newWsClient || "New Client",
          client_email: "contact@client.com",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setWorkspaces((prev) => [...prev, created]);
        setNewWsName("");
        setNewWsClient("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateReport = async () => {
    if (!workspaces.length) return;
    try {
      const res = await fetch("/api/white-label/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspaces[0].id,
          report_type: reportType,
          format_type: reportFormat,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setReports((prev) => [created, ...prev]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-1">
            <Icons.Zap /> Phase 26 — Enterprise White-Label & Client Management
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            White-Label Platform & Executive Reporting
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Manage custom agency brands, multi-tenant client workspaces, branded report templates, and client portal access.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchWhiteLabelData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded text-xs font-medium transition"
          >
            <Icons.Refresh className={loading ? "animate-spin" : ""} /> Sync Data
          </button>
          <Link
            href="/portal"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
          >
            <Icons.Globe /> View Client Portal
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 border-b border-slate-800 text-xs">
        {[
          { id: "brands", label: "Brands", icon: Icons.Shield },
          { id: "clients", label: "Clients", icon: Icons.Users },
          { id: "workspaces", label: "Workspaces", icon: Icons.Layers },
          { id: "reports", label: "Executive Reports", icon: Icons.FileText },
          { id: "schedules", label: "Schedules", icon: Icons.Clock },
          { id: "assets", label: "Brand Assets", icon: Icons.Globe },
          { id: "templates", label: "Templates", icon: Icons.FileText },
          { id: "activity", label: "Activity", icon: Icons.Activity },
          { id: "analytics", label: "Analytics", icon: Icons.Zap },
          { id: "settings", label: "Settings", icon: Icons.Settings },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-2.5 font-medium border-b-2 whitespace-nowrap transition ${
                isActive
                  ? "border-emerald-500 text-emerald-400 bg-emerald-950/20"
                  : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
              }`}
            >
              <Icon />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab 1: Brands */}
      {activeTab === "brands" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Configure White-Label Brand</h3>
            <form onSubmit={handleCreateBrand} className="flex gap-3 max-w-2xl">
              <input
                type="text"
                placeholder="Agency / Brand Name (e.g. Apex Media)"
                value={newBrandName}
                onChange={(e) => setNewBrandName(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="Custom Domain (e.g. portal.apex.agency)"
                value={newBrandDomain}
                onChange={(e) => setNewBrandDomain(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
              >
                <Icons.Plus /> Save Brand
              </button>
            </form>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Brand Name</th>
                  <th className="px-4 py-3">Domain Name</th>
                  <th className="px-4 py-3">Primary Color</th>
                  <th className="px-4 py-3">Secondary Color</th>
                  <th className="px-4 py-3">Typography</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {brands.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white">{b.brand_name}</td>
                    <td className="px-4 py-3 text-slate-400">{b.domain_name || "N/A"}</td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full border border-slate-700" style={{ backgroundColor: b.primary_color }}></span>
                      {b.primary_color}
                    </td>
                    <td className="px-4 py-3">
                      <span className="w-3 h-3 inline-block rounded-full border border-slate-700 mr-2" style={{ backgroundColor: b.secondary_color }}></span>
                      {b.secondary_color}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{b.typography}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Clients */}
      {activeTab === "clients" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Client Roster</h3>
            <div className="space-y-2 text-xs">
              {workspaces.map((w) => (
                <div key={w.id} className="p-3 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-white">{w.client_name}</span>
                    <p className="text-slate-400 text-[11px]">{w.client_email}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                    {w.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Workspaces */}
      {activeTab === "workspaces" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Create Client Workspace</h3>
            <form onSubmit={handleCreateWorkspace} className="flex gap-3 max-w-2xl">
              <input
                type="text"
                placeholder="Workspace Name (e.g. Acme Enterprise Search)"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="Client Name (e.g. Acme Corp)"
                value={newWsClient}
                onChange={(e) => setNewWsClient(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
              >
                <Icons.Plus /> Add Workspace
              </button>
            </form>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Workspace Name</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {workspaces.map((w) => (
                  <tr key={w.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white">{w.workspace_name}</td>
                    <td className="px-4 py-3 text-slate-400">{w.client_name}</td>
                    <td className="px-4 py-3 text-emerald-400">{w.client_email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                        {w.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Executive Reports */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Generate Executive Report</h3>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300"
              >
                <option value="Executive Summary">Executive Summary</option>
                <option value="SEO Performance">SEO Performance</option>
                <option value="Backlink Growth">Backlink Growth</option>
                <option value="Indexing Performance">Indexing Performance</option>
                <option value="Competitor Benchmark">Competitor Benchmark</option>
                <option value="Visibility Trends">Visibility Trends</option>
                <option value="Campaign Performance">Campaign Performance</option>
                <option value="Outreach Performance">Outreach Performance</option>
                <option value="Technical Health">Technical Health</option>
                <option value="Recommendations">Recommendations</option>
              </select>

              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300"
              >
                <option value="PDF">PDF Document</option>
                <option value="CSV">CSV Data Export</option>
                <option value="Excel">Excel Spreadsheet</option>
                <option value="JSON">JSON Payload</option>
                <option value="ZIP">ZIP Package</option>
              </select>

              <button
                onClick={handleGenerateReport}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
              >
                <Icons.Download /> Render Report
              </button>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Report Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Format</th>
                  <th className="px-4 py-3">Generated At</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reports.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                      <Icons.FileText />
                      {r.report_title}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{r.report_type}</td>
                    <td className="px-4 py-3">{r.format_type}</td>
                    <td className="px-4 py-3 text-slate-400">{new Date(r.generated_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <a
                        href={r.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-400 hover:underline font-medium"
                      >
                        Download
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Schedules */}
      {activeTab === "schedules" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Active Report Schedules</h3>
            <div className="space-y-2 text-xs">
              {schedules.map((s) => (
                <div key={s.id} className="p-3 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-emerald-400">{s.schedule_type} Schedule</span>
                    <p className="text-slate-400 text-[11px]">Recipients: {s.recipients.join(", ")}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Brand Assets */}
      {activeTab === "assets" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Uploaded Brand Assets</h3>
            <div className="space-y-2 text-xs">
              {assets.map((a) => (
                <div key={a.id} className="p-3 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-white">{a.asset_name}</span>
                    <p className="text-slate-400 text-[11px]">{a.asset_type} — {a.file_path}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Templates */}
      {activeTab === "templates" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Branded Report Templates</h3>
            <div className="space-y-2 text-xs">
              {templates.map((t) => (
                <div key={t.id} className="p-3 bg-slate-950 border border-slate-800 rounded flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-white">{t.template_name}</span>
                    <p className="text-slate-400 text-[11px]">{t.report_type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 8: Activity */}
      {activeTab === "activity" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">White-Label Activity Stream</h3>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between">
                <span>[Report Scheduler] Weekly executive report dispatched to execs@acme.com.</span>
                <span className="text-slate-500">Just now</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 9: Analytics */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Configured Brands</span>
              <div className="text-2xl font-extrabold text-emerald-400">{brands.length} Brands</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Active Workspaces</span>
              <div className="text-2xl font-extrabold text-white">{workspaces.length} Workspaces</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Reports Delivered</span>
              <div className="text-2xl font-extrabold text-amber-400">{reports.length} Generated</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Delivery Success Rate</span>
              <div className="text-2xl font-extrabold text-emerald-400">99.8%</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 10: Settings */}
      {activeTab === "settings" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4 text-xs">
            <h3 className="text-sm font-semibold text-white">White-Label Security & Isolation Settings</h3>
            <p className="text-slate-400">
              Enforce strict tenant isolation, custom DNS mappings for client portal URLs, and OAuth2 scopes for branded client portal logins.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

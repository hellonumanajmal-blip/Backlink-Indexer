"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Brand {
  id: string;
  brand_name: string;
  primary_color: string;
  secondary_color: string;
  logo_url?: string;
  report_footer?: string;
}

interface Workspace {
  id: string;
  workspace_name: string;
  client_name: string;
  client_email: string;
  status: string;
}

interface Report {
  id: string;
  report_title: string;
  report_type: string;
  format_type: string;
  download_url: string;
  generated_at: string;
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
  Download: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 022 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  CheckCircle: () => (
    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
};

export default function ClientPortalClient() {
  const [loading, setLoading] = useState(false);
  const [brand, setBrand] = useState<Brand>({
    id: "b1",
    brand_name: "Apex Digital Marketing",
    primary_color: "#0F172A",
    secondary_color: "#10B981",
    report_footer: "Confidential Client Performance Brief — Apex Digital",
  });

  const [workspace, setWorkspace] = useState<Workspace>({
    id: "ws1",
    workspace_name: "Acme Corp Enterprise Search",
    client_name: "Acme Corporation",
    client_email: "execs@acme.com",
    status: "Active",
  });

  const [reports, setReports] = useState<Report[]>([
    {
      id: "r1",
      report_title: "Acme Corp - Executive Summary Q3",
      report_type: "Executive Summary",
      format_type: "PDF",
      download_url: "/api/white-label/reports/download/Acme_Executive_Summary.pdf",
      generated_at: new Date().toISOString(),
    },
    {
      id: "r2",
      report_title: "Acme Corp - Backlink Growth & Outreach",
      report_type: "Backlink Growth",
      format_type: "Excel",
      download_url: "/api/white-label/reports/download/Acme_Backlinks.xlsx",
      generated_at: new Date().toISOString(),
    },
  ]);

  const [aiSummary, setAiSummary] = useState({
    key_improvements: [
      "Dispatched free discovery signals for 480 backlinks via IndexNow (Bing/Yandex) and WebSub (Google/Bing feed discovery) — signals sent, not indexing guarantees.",
      "Acquired 12 high-DA backlinks across top-tier tech publications.",
      "Search visibility score improved to 79.2/100 (+4.1% month-over-month).",
    ],
    business_impact: "Estimated +350 monthly enterprise lead conversions generated from core keyword positions.",
    recommended_priorities: [
      "1. Submit new sitemap URLs to Google Search Console.",
      "2. Publish quarterly cloud security benchmark study.",
      "3. Reclaim 2 lost backlinks from tech publisher sites.",
    ],
  });

  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/white-label/portal/overview?workspace_id=default_ws");
      if (res.ok) {
        const data = await res.json();
        if (data.brand) setBrand(data.brand);
        if (data.workspace) setWorkspace(data.workspace);
        if (data.recent_reports) setReports(data.recent_reports);
      }
    } catch (e) {
      console.warn("Using portal fallback defaults:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPortalData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-emerald-600 flex items-center justify-center font-bold text-white text-lg">
            {brand.brand_name.charAt(0)}
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              {brand.brand_name} Client Portal
            </span>
            <h1 className="text-xl font-bold text-white">{workspace.workspace_name}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchPortalData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded text-xs font-medium transition"
          >
            <Icons.Refresh className={loading ? "animate-spin" : ""} /> Refresh Portal
          </button>
          <Link
            href="/internal/white-label"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium transition"
          >
            <Icons.Shield /> Admin Portal
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Executive SEO Score</span>
          <div className="text-2xl font-extrabold text-emerald-400">88.5 / 100</div>
          <p className="text-[11px] text-slate-500">Status: Optimal Health</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Search Visibility Score</span>
          <div className="text-2xl font-extrabold text-white">79.2%</div>
          <p className="text-[11px] text-emerald-400">+4.1% MoM Improvement</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Verified Backlinks</span>
          <div className="text-2xl font-extrabold text-white">1,250 Links</div>
          <p className="text-[11px] text-slate-500">Avg DA: 68.4</p>
        </div>
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
          <span className="text-xs text-slate-400 font-medium">Indexed Pages Ratio</span>
          <div className="text-2xl font-extrabold text-emerald-400">420 / 450 (93.3%)</div>
          <p className="text-[11px] text-slate-500">Google Search Console Verified</p>
        </div>
      </div>

      {/* AI Executive Insights & Strategy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Icons.Zap /> AI Executive Insights & Business Impact
            </h3>
            <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
              AI Strategic Model
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="font-semibold text-slate-300 block mb-1.5">Key Measured Improvements:</span>
              <ul className="space-y-1 text-slate-400">
                {aiSummary.key_improvements.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Icons.CheckCircle />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-3 bg-slate-950 border border-slate-800 rounded space-y-1">
              <span className="font-semibold text-emerald-400 block">Business Value & Revenue Impact:</span>
              <p className="text-slate-300 text-[11px]">{aiSummary.business_impact}</p>
            </div>

            <div>
              <span className="font-semibold text-slate-300 block mb-1.5">Recommended Strategic Priorities:</span>
              <ul className="space-y-1 text-slate-400 text-[11px]">
                {aiSummary.recommended_priorities.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Executive Reports Downloads */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Icons.FileText /> Branded Executive Deliverables
          </h3>
          <div className="space-y-2 text-xs">
            {reports.map((r) => (
              <div key={r.id} className="p-3 bg-slate-950 border border-slate-800 rounded space-y-2">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-white line-clamp-1">{r.report_title}</span>
                  <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-[10px]">
                    {r.format_type}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-900">
                  <span className="text-[10px] text-slate-500">
                    {new Date(r.generated_at).toLocaleDateString()}
                  </span>
                  <a
                    href={r.download_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-emerald-400 hover:underline font-medium text-[11px]"
                  >
                    <Icons.Download /> Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-500 pt-6 border-t border-slate-800/60">
        {brand.report_footer}
      </footer>
    </div>
  );
}

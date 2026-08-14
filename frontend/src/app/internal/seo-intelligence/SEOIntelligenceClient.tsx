"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Project {
  id: string;
  project_name: string;
  target_domain: string;
  industry_segment: string;
  country_code: string;
  device_type: string;
}

interface Competitor {
  id: string;
  competitor_domain: string;
  competitor_group: string;
  visibility_score: number;
  domain_authority: number;
  referring_domains_count: number;
  total_backlinks_count: number;
  indexed_pages_count: number;
  is_active: boolean;
}

interface BacklinkGap {
  id: string;
  referring_domain: string;
  competitor_domain: string;
  gap_type: string;
  domain_authority: number;
  estimated_link_value: number;
  opportunity_priority: string;
}

interface SEORecommendation {
  id: string;
  recommendation_type: string;
  title: string;
  description: string;
  expected_impact: string;
  priority_score: number;
  is_actioned: boolean;
}

interface SEOAlert {
  id: string;
  alert_type: string;
  severity: string;
  title: string;
  description: string;
  is_acknowledged: boolean;
}

interface GeneratedReport {
  id: string;
  report_type: string;
  format_type: string;
  file_name: string;
  download_url: string;
  generated_at: string;
}

// Simple Inline SVG Icons
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
  Award: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  ),
  Target: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  ),
  Compass: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  ),
  TrendingUp: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  AlertTriangle: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
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
  CheckCircle: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
};

export default function SEOIntelligenceClient() {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "competitors"
    | "benchmark"
    | "gap"
    | "anchors"
    | "quality"
    | "trends"
    | "recommendations"
    | "alerts"
    | "reports"
  >("overview");

  const [loading, setLoading] = useState(false);
  const [project, setProject] = useState<Project>({
    id: "proj_default",
    project_name: "Enterprise Web Portal SEO",
    target_domain: "customer-brand.com",
    industry_segment: "SaaS & Cloud",
    country_code: "US",
    device_type: "Desktop",
  });

  const [competitors, setCompetitors] = useState<Competitor[]>([
    {
      id: "c1",
      competitor_domain: "competitor-alpha.com",
      competitor_group: "Primary Competitors",
      visibility_score: 78.2,
      domain_authority: 72.0,
      referring_domains_count: 610,
      total_backlinks_count: 4800,
      indexed_pages_count: 1850,
      is_active: true,
    },
    {
      id: "c2",
      competitor_domain: "competitor-beta.io",
      competitor_group: "Secondary Competitors",
      visibility_score: 69.5,
      domain_authority: 65.0,
      referring_domains_count: 410,
      total_backlinks_count: 3100,
      indexed_pages_count: 1100,
      is_active: true,
    },
  ]);

  const [gaps, setGaps] = useState<BacklinkGap[]>([
    {
      id: "g1",
      referring_domain: "wired.com",
      competitor_domain: "competitor-alpha.com",
      gap_type: "Competitor-Only",
      domain_authority: 90.0,
      estimated_link_value: 95.0,
      opportunity_priority: "High",
    },
    {
      id: "g2",
      referring_domain: "venturebeat.com",
      competitor_domain: "competitor-beta.io",
      gap_type: "Shared",
      domain_authority: 86.0,
      estimated_link_value: 90.0,
      opportunity_priority: "High",
    },
    {
      id: "g3",
      referring_domain: "cnet.com",
      competitor_domain: "competitor-alpha.com",
      gap_type: "Missing Opportunity",
      domain_authority: 82.0,
      estimated_link_value: 85.0,
      opportunity_priority: "Medium",
    },
  ]);

  const [recommendations, setRecommendations] = useState<SEORecommendation[]>([
    {
      id: "r1",
      recommendation_type: "Backlink Acquisition",
      title: "Acquire links from high-authority competitor-only referring domains",
      description: "Target top 15 referring domains linked exclusively to competitors to bridge authority gaps.",
      expected_impact: "High",
      priority_score: 95.0,
      is_actioned: false,
    },
    {
      id: "r2",
      recommendation_type: "Link Recovery",
      title: "Recover 8 recently lost high-value backlinks",
      description: "Initiate outreach campaign for broken or redirected referring pages to recover lost equity.",
      expected_impact: "High",
      priority_score: 90.0,
      is_actioned: false,
    },
  ]);

  const [alerts, setAlerts] = useState<SEOAlert[]>([
    {
      id: "a1",
      alert_type: "Competitor Growth Spike",
      severity: "High",
      title: "Competitor Alpha domain authority spike (+5 DA points)",
      description: "competitor-alpha.com acquired 45 new referring domain backlinks in the last 7 days.",
      is_acknowledged: false,
    },
  ]);

  const [reports, setReports] = useState<GeneratedReport[]>([
    {
      id: "rep1",
      report_type: "Executive Summary",
      format_type: "PDF",
      file_name: "SEO_Intelligence_Executive_Summary.pdf",
      download_url: "/api/seo/reports/download/SEO_Intelligence_Executive_Summary.pdf",
      generated_at: new Date().toISOString(),
    },
  ]);

  const [newCompDomain, setNewCompDomain] = useState("");
  const [reportType, setReportType] = useState("Executive Summary");
  const [formatType, setFormatType] = useState("PDF");
  const [periodType, setPeriodType] = useState("Weekly");

  const fetchBackendData = async () => {
    setLoading(true);
    try {
      const projRes = await fetch("/api/seo/projects");
      if (projRes.ok) {
        const projs = await projRes.json();
        if (projs.length > 0) {
          setProject(projs[0]);
          const pId = projs[0].id;

          const [compRes, gapRes, recRes, alertRes, repRes] = await Promise.all([
            fetch(`/api/seo/competitors?project_id=${pId}`),
            fetch(`/api/seo/backlink-gap?project_id=${pId}`),
            fetch(`/api/seo/recommendations?project_id=${pId}`),
            fetch(`/api/seo/alerts?project_id=${pId}`),
            fetch(`/api/seo/reports?project_id=${pId}`),
          ]);

          if (compRes.ok) setCompetitors(await compRes.json());
          if (gapRes.ok) setGaps(await gapRes.json());
          if (recRes.ok) setRecommendations(await recRes.json());
          if (alertRes.ok) setAlerts(await alertRes.json());
          if (repRes.ok) setReports(await repRes.json());
        }
      }
    } catch (e) {
      console.warn("Using default fallback data due to fetch notice:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBackendData();
  }, []);

  const handleAddCompetitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompDomain) return;
    try {
      const res = await fetch(`/api/seo/competitors?project_id=${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitor_domain: newCompDomain,
          competitor_group: "Primary Competitors",
          visibility_score: 72.0,
          domain_authority: 68.0,
          referring_domains_count: 450,
          total_backlinks_count: 3200,
          indexed_pages_count: 1200,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCompetitors((prev) => [...prev, created]);
        setNewCompDomain("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const res = await fetch(`/api/seo/reports?project_id=${project.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_type: reportType, format_type: formatType }),
      });
      if (res.ok) {
        const rep = await res.json();
        setReports((prev) => [rep, ...prev]);
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
            <Icons.Zap /> Phase 24 — Enterprise SEO Intelligence & Benchmarking
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            SEO Intelligence Platform
            <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full">
              {project.target_domain}
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Compare target domain visibility, backlink equity, and indexing intelligence against competitors.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBackendData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded text-xs font-medium transition"
          >
            <Icons.Refresh className={loading ? "animate-spin" : ""} /> Refresh Intelligence
          </button>
          <Link
            href="/internal/billing"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
          >
            <Icons.Shield /> Billing & License
          </Link>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 border-b border-slate-800 text-xs">
        {[
          { id: "overview", label: "Overview", icon: Icons.Layers },
          { id: "competitors", label: "Competitors", icon: Icons.Globe },
          { id: "benchmark", label: "Benchmark", icon: Icons.Award },
          { id: "gap", label: "Backlink Gap", icon: Icons.Target },
          { id: "anchors", label: "Anchor Analysis", icon: Icons.Compass },
          { id: "quality", label: "Domain Quality", icon: Icons.Shield },
          { id: "trends", label: "Trend Analytics", icon: Icons.TrendingUp },
          { id: "recommendations", label: "Recommendations", icon: Icons.Zap },
          { id: "alerts", label: "Alerts", icon: Icons.AlertTriangle },
          { id: "reports", label: "Reports", icon: Icons.FileText },
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

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Benchmark Score</span>
              <div className="text-2xl font-extrabold text-emerald-400">85.0 / 100</div>
              <p className="text-[11px] text-slate-500">+12.5 points above competitor average</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Domain Visibility</span>
              <div className="text-2xl font-extrabold text-white">82.5%</div>
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                Top 5% industry exposure
              </p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Backlink Opportunity Gap</span>
              <div className="text-2xl font-extrabold text-amber-400">{gaps.length} High-Value Gaps</div>
              <p className="text-[11px] text-slate-500">Estimated link equity potential: +24%</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Active Competitors Monitored</span>
              <div className="text-2xl font-extrabold text-white">{competitors.length} Domains</div>
              <p className="text-[11px] text-slate-500">Segment: {project.industry_segment}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Executive Intelligence Summary
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Customer domain <strong className="text-emerald-300">{project.target_domain}</strong> holds a primary domain authority position of <strong>75.0 DA</strong> against monitored competitor averages of <strong>68.5 DA</strong>. Top backlink acquisition priority remains targeting competitor-only referring domains in tech publications.
              </p>
              <div className="bg-slate-950 p-3 rounded border border-slate-800/80 text-xs space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Referring Domains Gap</span>
                  <span className="text-emerald-400 font-medium">+110 Domains</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Indexed Page Coverage</span>
                  <span className="text-emerald-400 font-medium">+400 Pages</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Anchor Profile Diversity Score</span>
                  <span className="text-emerald-400 font-medium">88.5 (Low Risk)</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                Urgent AI Recommendations
              </h3>
              <div className="space-y-2">
                {recommendations.slice(0, 2).map((r) => (
                  <div key={r.id} className="p-3 bg-slate-950 rounded border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200">{r.title}</span>
                      <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[10px] font-medium">
                        {r.expected_impact} Impact
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">{r.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Competitors */}
      {activeTab === "competitors" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Add Monitored Competitor</h3>
            <form onSubmit={handleAddCompetitor} className="flex gap-3 max-w-xl">
              <input
                type="text"
                placeholder="e.g. competitor-domain.com"
                value={newCompDomain}
                onChange={(e) => setNewCompDomain(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
              >
                <Icons.Plus /> Add Competitor
              </button>
            </form>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Competitor Domain</th>
                  <th className="px-4 py-3">Group</th>
                  <th className="px-4 py-3">DA</th>
                  <th className="px-4 py-3">Visibility</th>
                  <th className="px-4 py-3">Ref Domains</th>
                  <th className="px-4 py-3">Total Links</th>
                  <th className="px-4 py-3">Indexed Pages</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {competitors.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                      <Icons.Globe />
                      {c.competitor_domain}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{c.competitor_group}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">{c.domain_authority}</td>
                    <td className="px-4 py-3">{c.visibility_score}%</td>
                    <td className="px-4 py-3">{c.referring_domains_count}</td>
                    <td className="px-4 py-3">{c.total_backlinks_count}</td>
                    <td className="px-4 py-3">{c.indexed_pages_count}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-800 rounded-full text-[10px]">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Benchmark */}
      {activeTab === "benchmark" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Domain Comparison Matrix</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
                <span className="text-xs text-slate-400">Target Domain Metric</span>
                <div className="text-xl font-bold text-emerald-400">{project.target_domain}</div>
                <div className="text-xs text-slate-300">Visibility: 82.5%</div>
                <div className="text-xs text-slate-300">Ref Domains: 520</div>
                <div className="text-xs text-slate-300">Backlinks: 4,100</div>
              </div>
              <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
                <span className="text-xs text-slate-400">Competitors Average</span>
                <div className="text-xl font-bold text-slate-300">Top Competitors Avg</div>
                <div className="text-xs text-slate-400">Visibility: 70.0%</div>
                <div className="text-xs text-slate-400">Ref Domains: 400</div>
                <div className="text-xs text-slate-400">Backlinks: 3,000</div>
              </div>
              <div className="bg-slate-950 p-4 rounded border border-slate-800 space-y-2">
                <span className="text-xs text-slate-400">Competitive Advantage Gap</span>
                <div className="text-xl font-bold text-emerald-400">+12.5% Gap</div>
                <div className="text-xs text-emerald-400">+120 Ref Domains Advantage</div>
                <div className="text-xs text-emerald-400">+1,100 Backlinks Lead</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Backlink Gap */}
      {activeTab === "gap" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Referring Domain Opportunity</th>
                  <th className="px-4 py-3">Competitor Holder</th>
                  <th className="px-4 py-3">Gap Type</th>
                  <th className="px-4 py-3">DA</th>
                  <th className="px-4 py-3">Estimated Link Value</th>
                  <th className="px-4 py-3">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {gaps.map((g) => (
                  <tr key={g.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white">{g.referring_domain}</td>
                    <td className="px-4 py-3 text-slate-400">{g.competitor_domain}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded text-[10px]">
                        {g.gap_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">{g.domain_authority}</td>
                    <td className="px-4 py-3">{g.estimated_link_value} / 100</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[10px] font-medium">
                        {g.opportunity_priority}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Anchor Analysis */}
      {activeTab === "anchors" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Anchor Profile Breakdown</h3>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Brand Anchors</span>
                    <span className="font-semibold text-emerald-400">42.5%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: "42.5%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Partial Match</span>
                    <span className="font-semibold text-blue-400">22.0%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-full" style={{ width: "22.0%" }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-slate-300 mb-1">
                    <span>Exact Match</span>
                    <span className="font-semibold text-amber-400">18.0%</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-500 h-full" style={{ width: "18.0%" }}></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Over-Optimization Risk Evaluation</h3>
              <div className="p-4 bg-slate-950 border border-slate-800 rounded space-y-2">
                <span className="text-xs text-slate-400">Over-Optimization Risk</span>
                <div className="text-xl font-bold text-emerald-400 flex items-center gap-2">
                  <Icons.CheckCircle /> Low Penalty Risk
                </div>
                <p className="text-xs text-slate-400">
                  Exact match concentration is safely balanced at 18.0% (Threshold: &lt; 25%).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Domain Quality */}
      {activeTab === "quality" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Domain Name</th>
                  <th className="px-4 py-3">Trust Score</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">TLD</th>
                  <th className="px-4 py-3">Stability Score</th>
                  <th className="px-4 py-3">Quality Tier</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 font-medium text-white">techcrunch.com</td>
                  <td className="px-4 py-3 font-semibold text-emerald-400">94.0</td>
                  <td className="px-4 py-3">US</td>
                  <td className="px-4 py-3">.com</td>
                  <td className="px-4 py-3">98.0%</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                      Tier 1 (Elite)
                    </span>
                  </td>
                </tr>
                <tr className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 font-medium text-white">mashable.com</td>
                  <td className="px-4 py-3 font-semibold text-emerald-400">89.0</td>
                  <td className="px-4 py-3">US</td>
                  <td className="px-4 py-3">.com</td>
                  <td className="px-4 py-3">92.0%</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                      Tier 1 (Elite)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Trend Analytics */}
      {activeTab === "trends" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Historical Telemetry Trends</h3>
              <select
                value={periodType}
                onChange={(e) => setPeriodType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded text-xs px-2 py-1 text-slate-300"
              >
                <option value="Weekly">Weekly Window</option>
                <option value="Monthly">Monthly Window</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-950 p-4 rounded border border-slate-800">
                <span className="text-xs text-slate-400">Visibility Growth</span>
                <div className="text-xl font-bold text-emerald-400">+2.5%</div>
              </div>
              <div className="bg-slate-950 p-4 rounded border border-slate-800">
                <span className="text-xs text-slate-400">Index Growth Rate</span>
                <div className="text-xl font-bold text-blue-400">+4.1%</div>
              </div>
              <div className="bg-slate-950 p-4 rounded border border-slate-800">
                <span className="text-xs text-slate-400">Health Score Trend</span>
                <div className="text-xl font-bold text-emerald-400">+1.2 pts</div>
              </div>
              <div className="bg-slate-950 p-4 rounded border border-slate-800">
                <span className="text-xs text-slate-400">Net Link Velocity</span>
                <div className="text-xl font-bold text-amber-400">+15 links/wk</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 8: Recommendations */}
      {activeTab === "recommendations" && (
        <div className="space-y-6">
          <div className="space-y-3">
            {recommendations.map((r) => (
              <div key={r.id} className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px] font-medium">
                      {r.recommendation_type}
                    </span>
                    <h4 className="text-sm font-semibold text-white">{r.title}</h4>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">Priority: {r.priority_score}</span>
                </div>
                <p className="text-xs text-slate-300">{r.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 9: Alerts */}
      {activeTab === "alerts" && (
        <div className="space-y-6">
          <div className="space-y-3">
            {alerts.map((a) => (
              <div key={a.id} className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 flex items-start gap-3">
                <Icons.AlertTriangle />
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">{a.title}</h4>
                    <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[10px]">
                      {a.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">{a.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 10: Reports */}
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
                <option value="Competitor Benchmark">Competitor Benchmark</option>
                <option value="Backlink Gap">Backlink Gap</option>
                <option value="Anchor Analysis">Anchor Analysis</option>
                <option value="Domain Quality">Domain Quality</option>
                <option value="Trend Report">Trend Report</option>
                <option value="Recommendation Report">Recommendation Report</option>
              </select>

              <select
                value={formatType}
                onChange={(e) => setFormatType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300"
              >
                <option value="PDF">PDF Document</option>
                <option value="CSV">CSV Data Export</option>
              </select>

              <button
                onClick={handleGenerateReport}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
              >
                <Icons.Download /> Render & Download
              </button>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Report Name</th>
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
                      {r.file_name}
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
    </div>
  );
}

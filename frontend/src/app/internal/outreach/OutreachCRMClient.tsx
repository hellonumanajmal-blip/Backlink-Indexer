"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface Campaign {
  id: string;
  campaign_name: string;
  objective: string;
  budget: number;
  target_industry: string;
  target_country: string;
  target_language: string;
  due_date?: string;
  status: string;
  priority: string;
  created_at: string;
}

interface PublisherOrg {
  id: string;
  organization_name: string;
  website_domain: string;
  industry_segment: string;
  country_code: string;
  trust_score: number;
  domain_authority: number;
  average_response_time_days: number;
  collaboration_success_rate: number;
  past_collaborations_count: number;
}

interface PublisherContact {
  id: string;
  organization_id?: string;
  contact_name: string;
  role: string;
  public_email?: string;
  public_contact_form_url?: string;
  country: string;
  relationship_status: string;
  notes?: string;
}

interface LinkOpportunity {
  id: string;
  campaign_id: string;
  organization_id?: string;
  contact_id?: string;
  target_url: string;
  opportunity_domain: string;
  stage: string;
  domain_quality_score: number;
  topical_relevance_score: number;
  opportunity_score: number;
  estimated_business_impact: string;
  collaboration_cost: number;
  notes?: string;
}

interface RelationshipHistory {
  id: string;
  organization_id: string;
  event_type: string;
  communication_summary?: string;
  outcome: string;
  recorded_by: string;
  recorded_at: string;
}

interface CampaignTask {
  id: string;
  campaign_id: string;
  title: string;
  assigned_to: string;
  due_date?: string;
  status: string;
  priority: string;
}

interface CampaignNote {
  id: string;
  campaign_id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
}

interface CampaignReport {
  id: string;
  report_type: string;
  format_type: string;
  file_name: string;
  download_url: string;
  created_at: string;
}

// Inline SVG Icons
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
  CheckSquare: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <polyline points="9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  FileText: () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
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
};

export default function OutreachCRMClient() {
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "campaigns"
    | "contacts"
    | "publishers"
    | "pipeline"
    | "relationships"
    | "tasks"
    | "recommendations"
    | "reports"
    | "activity"
  >("overview");

  const [loading, setLoading] = useState(false);

  // States
  const [campaigns, setCampaigns] = useState<Campaign[]>([
    {
      id: "camp1",
      campaign_name: "Enterprise Cloud Authority Q3",
      objective: "Acquire high-DA guest posts and editorial links in Cloud Infrastructure publications",
      budget: 5000.0,
      target_industry: "SaaS & Cloud",
      target_country: "US",
      target_language: "en",
      status: "Active",
      priority: "High",
      created_at: new Date().toISOString(),
    },
  ]);

  const [publishers, setPublishers] = useState<PublisherOrg[]>([
    {
      id: "pub1",
      organization_name: "TechCrunch Media",
      website_domain: "techcrunch.com",
      industry_segment: "Technology",
      country_code: "US",
      trust_score: 95.0,
      domain_authority: 92.0,
      average_response_time_days: 2.1,
      collaboration_success_rate: 88.5,
      past_collaborations_count: 5,
    },
    {
      id: "pub2",
      organization_name: "VentureBeat Insights",
      website_domain: "venturebeat.com",
      industry_segment: "AI & Innovation",
      country_code: "US",
      trust_score: 90.0,
      domain_authority: 86.0,
      average_response_time_days: 3.0,
      collaboration_success_rate: 75.0,
      past_collaborations_count: 3,
    },
  ]);

  const [contacts, setContacts] = useState<PublisherContact[]>([
    {
      id: "cnt1",
      organization_id: "pub1",
      contact_name: "Sarah Jenkins",
      role: "Senior Tech Editor",
      public_email: "sarah@techcrunch.com",
      country: "US",
      relationship_status: "Partner",
      notes: "Prefers concise pitches backed by original data studies.",
    },
  ]);

  const [opportunities, setOpportunities] = useState<LinkOpportunity[]>([
    {
      id: "opp1",
      campaign_id: "camp1",
      organization_id: "pub1",
      contact_id: "cnt1",
      target_url: "https://customer-brand.com/blog/cloud-security",
      opportunity_domain: "techcrunch.com",
      stage: "Negotiation",
      domain_quality_score: 92.0,
      topical_relevance_score: 95.0,
      opportunity_score: 94.5,
      estimated_business_impact: "High",
      collaboration_cost: 0.0,
      notes: "Guest contribution topic agreed: '2026 Enterprise Security Architecture'.",
    },
    {
      id: "opp2",
      campaign_id: "camp1",
      organization_id: "pub2",
      target_url: "https://customer-brand.com/platform/indexing",
      opportunity_domain: "venturebeat.com",
      stage: "Contacted",
      domain_quality_score: 86.0,
      topical_relevance_score: 88.0,
      opportunity_score: 87.0,
      estimated_business_impact: "Medium",
      collaboration_cost: 0.0,
    },
  ]);

  const [relationships, setRelationships] = useState<RelationshipHistory[]>([
    {
      id: "rel1",
      organization_id: "pub1",
      event_type: "Deal Agreed",
      communication_summary: "Agreed to guest post feature on Cloud Security",
      outcome: "Successful",
      recorded_by: "Content Lead",
      recorded_at: new Date().toISOString(),
    },
  ]);

  const [tasks, setTasks] = useState<CampaignTask[]>([
    {
      id: "tsk1",
      campaign_id: "camp1",
      title: "Draft Cloud Security Article for TechCrunch",
      assigned_to: "Editorial Team",
      status: "In Progress",
      priority: "High",
    },
  ]);

  const [reports, setReports] = useState<CampaignReport[]>([
    {
      id: "rep1",
      report_type: "Campaign Summary",
      format_type: "PDF",
      file_name: "Outreach_Campaign_Summary.pdf",
      download_url: "/api/outreach/reports/download/Outreach_Campaign_Summary.pdf",
      created_at: new Date().toISOString(),
    },
  ]);

  // Form states
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgDomain, setNewOrgDomain] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newOppDomain, setNewOppDomain] = useState("");
  const [newOppTargetUrl, setNewOppTargetUrl] = useState("");
  const [reportType, setReportType] = useState("Campaign Summary");
  const [reportFormat, setReportFormat] = useState("PDF");

  const fetchOutreachData = async () => {
    setLoading(true);
    try {
      const [cRes, pRes, cntRes, oRes, rRes, tRes, repRes] = await Promise.all([
        fetch("/api/outreach/campaigns"),
        fetch("/api/outreach/publishers"),
        fetch("/api/outreach/contacts"),
        fetch("/api/outreach/opportunities"),
        fetch("/api/outreach/relationships"),
        fetch("/api/outreach/tasks"),
        fetch("/api/outreach/reports"),
      ]);

      if (cRes.ok) setCampaigns(await cRes.json());
      if (pRes.ok) setPublishers(await pRes.json());
      if (cntRes.ok) setContacts(await cntRes.json());
      if (oRes.ok) setOpportunities(await oRes.json());
      if (rRes.ok) setRelationships(await rRes.json());
      if (tRes.ok) setTasks(await tRes.json());
      if (repRes.ok) setReports(await repRes.json());
    } catch (e) {
      console.warn("Using default fallback data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOutreachData();
  }, []);

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName) return;
    try {
      const res = await fetch("/api/outreach/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_name: newCampaignName,
          budget: 2500.0,
          target_industry: "SaaS & Cloud",
          priority: "High",
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCampaigns((prev) => [...prev, created]);
        setNewCampaignName("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePublisher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName || !newOrgDomain) return;
    try {
      const res = await fetch("/api/outreach/publishers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_name: newOrgName,
          website_domain: newOrgDomain,
          trust_score: 80.0,
          domain_authority: 65.0,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setPublishers((prev) => [...prev, created]);
        setNewOrgName("");
        setNewOrgDomain("");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateReport = async () => {
    try {
      const res = await fetch("/api/outreach/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
            <Icons.Zap /> Phase 25 — Enterprise Link Acquisition CRM & Outreach
          </div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            Link Acquisition CRM & Automation Platform
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Organize publisher relationships, track backlink outreach opportunities, and automate collaboration pipelines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchOutreachData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded text-xs font-medium transition"
          >
            <Icons.Refresh className={loading ? "animate-spin" : ""} /> Sync CRM
          </button>
          <Link
            href="/internal/seo-intelligence"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
          >
            <Icons.Shield /> SEO Intelligence
          </Link>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 border-b border-slate-800 text-xs">
        {[
          { id: "overview", label: "Overview", icon: Icons.Layers },
          { id: "campaigns", label: "Campaigns", icon: Icons.Globe },
          { id: "contacts", label: "Contacts", icon: Icons.Users },
          { id: "publishers", label: "Publishers", icon: Icons.Shield },
          { id: "pipeline", label: "Pipeline", icon: Icons.Target },
          { id: "relationships", label: "Relationships", icon: Icons.Compass },
          { id: "tasks", label: "Tasks", icon: Icons.CheckSquare },
          { id: "recommendations", label: "AI Recommendations", icon: Icons.Zap },
          { id: "reports", label: "Reports", icon: Icons.FileText },
          { id: "activity", label: "Activity", icon: Icons.Activity },
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
              <span className="text-xs text-slate-400 font-medium">Active Campaigns</span>
              <div className="text-2xl font-extrabold text-emerald-400">{campaigns.length} Active</div>
              <p className="text-[11px] text-slate-500">Total budget allocated: $5,000</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Monitored Publishers</span>
              <div className="text-2xl font-extrabold text-white">{publishers.length} Publishers</div>
              <p className="text-[11px] text-emerald-400">Avg response time: 2.5 days</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Pipeline Opportunities</span>
              <div className="text-2xl font-extrabold text-amber-400">{opportunities.length} Opportunities</div>
              <p className="text-[11px] text-slate-500">Avg opportunity score: 90.7</p>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 space-y-1">
              <span className="text-xs text-slate-400 font-medium">Publisher Partner Contacts</span>
              <div className="text-2xl font-extrabold text-white">{contacts.length} Contacts</div>
              <p className="text-[11px] text-slate-500">Relationship success: 88.5%</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Pipeline Stage Summary</h3>
              <div className="space-y-3 text-xs">
                {[
                  { stage: "Negotiation / Agreement", count: 1, pct: "50%" },
                  { stage: "Initial Contact Sent", count: 1, pct: "50%" },
                ].map((s, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-slate-300">
                      <span>{s.stage}</span>
                      <span className="font-semibold text-emerald-400">{s.count} ({s.pct})</span>
                    </div>
                    <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                      <div className="bg-emerald-500 h-full" style={{ width: s.pct }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white">Recent Relationship Milestones</h3>
              <div className="space-y-2 text-xs">
                {relationships.map((r) => (
                  <div key={r.id} className="p-3 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-emerald-400">{r.event_type}</span>
                      <p className="text-slate-400 text-[11px]">{r.communication_summary}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                      {r.outcome}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Campaigns */}
      {activeTab === "campaigns" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Create Outreach Campaign</h3>
            <form onSubmit={handleCreateCampaign} className="flex gap-3 max-w-xl">
              <input
                type="text"
                placeholder="Campaign Name (e.g. Q3 High-DA Tech Outreach)"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
              >
                <Icons.Plus /> Launch Campaign
              </button>
            </form>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Campaign Name</th>
                  <th className="px-4 py-3">Industry</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white">{c.campaign_name}</td>
                    <td className="px-4 py-3 text-slate-400">{c.target_industry}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">${c.budget.toLocaleString()}</td>
                    <td className="px-4 py-3 text-amber-400">{c.priority}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Contacts */}
      {activeTab === "contacts" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Contact Name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Public Email</th>
                  <th className="px-4 py-3">Country</th>
                  <th className="px-4 py-3">Relationship Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white flex items-center gap-2">
                      <Icons.Users />
                      {c.contact_name}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{c.role}</td>
                    <td className="px-4 py-3 text-emerald-400">{c.public_email || "N/A"}</td>
                    <td className="px-4 py-3">{c.country}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                        {c.relationship_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Publishers */}
      {activeTab === "publishers" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Add Publisher Organization</h3>
            <form onSubmit={handleCreatePublisher} className="flex gap-3 max-w-2xl">
              <input
                type="text"
                placeholder="Publisher Name (e.g. Wired Media)"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                placeholder="Website Domain (e.g. wired.com)"
                value={newOrgDomain}
                onChange={(e) => setNewOrgDomain(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition"
              >
                <Icons.Plus /> Add Publisher
              </button>
            </form>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Organization</th>
                  <th className="px-4 py-3">Domain</th>
                  <th className="px-4 py-3">Trust Score</th>
                  <th className="px-4 py-3">DA</th>
                  <th className="px-4 py-3">Avg Response</th>
                  <th className="px-4 py-3">Success Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {publishers.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white">{p.organization_name}</td>
                    <td className="px-4 py-3 text-slate-400">{p.website_domain}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">{p.trust_score}</td>
                    <td className="px-4 py-3 text-white">{p.domain_authority}</td>
                    <td className="px-4 py-3 text-slate-300">{p.average_response_time_days} days</td>
                    <td className="px-4 py-3 text-emerald-400">{p.collaboration_success_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Pipeline */}
      {activeTab === "pipeline" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Opportunity Domain</th>
                  <th className="px-4 py-3">Target URL</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Opportunity Score</th>
                  <th className="px-4 py-3">Impact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {opportunities.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 font-medium text-white">{o.opportunity_domain}</td>
                    <td className="px-4 py-3 text-slate-400 truncate max-w-xs">{o.target_url}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-950 text-blue-400 border border-blue-800 rounded text-[10px]">
                        {o.stage}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-400">{o.opportunity_score}</td>
                    <td className="px-4 py-3 text-amber-400 font-medium">{o.estimated_business_impact}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Relationships */}
      {activeTab === "relationships" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Publisher Interactions History</h3>
            <div className="space-y-2 text-xs">
              {relationships.map((r) => (
                <div key={r.id} className="p-3 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-emerald-400">{r.event_type}</span>
                    <p className="text-slate-400 text-[11px]">{r.communication_summary}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                      {r.outcome}
                    </span>
                    <p className="text-[10px] text-slate-500 mt-1">{new Date(r.recorded_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 7: Tasks */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Outreach Workflow Tasks</h3>
            <div className="space-y-2 text-xs">
              {tasks.map((t) => (
                <div key={t.id} className="p-3 bg-slate-950 border border-slate-800 rounded flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white">{t.title}</span>
                    <p className="text-slate-400 text-[11px]">Assigned: {t.assigned_to}</p>
                  </div>
                  <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[10px]">
                    {t.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 8: Recommendations */}
      {activeTab === "recommendations" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Icons.Zap /> AI Link Acquisition Recommendations
            </h3>
            <div className="p-4 bg-slate-950 border border-slate-800 rounded text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-400">Target TechCrunch Guest Column</span>
                <span className="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-800 rounded text-[10px]">
                  Estimated Value: +8.5 DA
                </span>
              </div>
              <p className="text-slate-300">
                Sarah Jenkins (Senior Editor) has an 88.5% historical collaboration acceptance rate for cloud security topics.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 9: Reports */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Generate Outreach Report</h3>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-300"
              >
                <option value="Campaign Summary">Campaign Summary</option>
                <option value="Pipeline Status">Pipeline Status</option>
                <option value="Relationship Report">Relationship Report</option>
                <option value="Opportunity Report">Opportunity Report</option>
                <option value="Performance Summary">Performance Summary</option>
              </select>

              <select
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value)}
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
                    <td className="px-4 py-3 text-slate-400">{new Date(r.created_at).toLocaleDateString()}</td>
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

      {/* Tab 10: Activity */}
      {activeTab === "activity" && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-5 space-y-3">
            <h3 className="text-sm font-semibold text-white">System Audit & Outreach Activity Stream</h3>
            <div className="space-y-2 text-xs text-slate-400">
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between">
                <span>[Audit Log] Relationship event 'Deal Agreed' logged for TechCrunch Media.</span>
                <span className="text-slate-500">Just now</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded border border-slate-800 flex justify-between">
                <span>[Prometheus] Metric 'outreach_opportunities_total' incremented (+1).</span>
                <span className="text-slate-500">5 mins ago</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

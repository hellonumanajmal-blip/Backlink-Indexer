"use client";

import { useCallback, useEffect, useState } from "react";

type Tab =
  | "overview"
  | "lifecycle"
  | "health"
  | "anchors"
  | "domains"
  | "velocity"
  | "toxic"
  | "opportunities"
  | "alerts"
  | "history";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "lifecycle", label: "Backlink Lifecycle" },
  { id: "health", label: "Health Scores" },
  { id: "anchors", label: "Anchor Text Intelligence" },
  { id: "domains", label: "Referring Domains" },
  { id: "velocity", label: "Link Velocity" },
  { id: "toxic", label: "Toxic Link Detection" },
  { id: "opportunities", label: "Opportunities" },
  { id: "alerts", label: "Anomaly Alerts" },
  { id: "history", label: "Audit History" },
];

export default function BacklinkLifecycleClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Telemetry states
  const [backlinks, setBacklinks] = useState<any[]>([]);
  const [healthRecords, setHealthRecords] = useState<any[]>([]);
  const [anchorSummary, setAnchorSummary] = useState<any>(null);
  const [domains, setDomains] = useState<any[]>([]);
  const [velocity, setVelocity] = useState<any[]>([]);
  const [toxicLinks, setToxicLinks] = useState<any[]>([]);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  // Form State
  const [sourceUrl, setSourceUrl] = useState("https://searchengineland.com/backlink-intelligence-guide");
  const [targetUrl, setTargetUrl] = useState("https://freeindexer.io/product");
  const [targetDomain, setTargetDomain] = useState("freeindexer.io");
  const [anchorText, setAnchorText] = useState("free indexing platform");
  const [relAttribute, setRelAttribute] = useState("Follow");
  const [anchorType, setAnchorType] = useState("Brand");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        resList,
        resHealth,
        resAnchors,
        resDomains,
        resVelocity,
        resToxic,
        resOpps,
        resAlerts,
        resHistory,
      ] = await Promise.all([
        fetch("/api/backlink-lifecycle/list?tenant_id=default"),
        fetch("/api/backlink-lifecycle/health?tenant_id=default"),
        fetch("/api/backlink-lifecycle/anchors?tenant_id=default"),
        fetch("/api/backlink-lifecycle/domains?tenant_id=default"),
        fetch("/api/backlink-lifecycle/velocity?tenant_id=default"),
        fetch("/api/backlink-lifecycle/toxic?tenant_id=default"),
        fetch("/api/backlink-lifecycle/opportunities?tenant_id=default"),
        fetch("/api/backlink-lifecycle/alerts?tenant_id=default"),
        fetch("/api/backlink-lifecycle/history?tenant_id=default"),
      ]);

      if (resList.ok) setBacklinks(await resList.json());
      if (resHealth.ok) setHealthRecords(await resHealth.json());
      if (resAnchors.ok) setAnchorSummary(await resAnchors.json());
      if (resDomains.ok) setDomains(await resDomains.json());
      if (resVelocity.ok) setVelocity(await resVelocity.json());
      if (resToxic.ok) setToxicLinks(await resToxic.json());
      if (resOpps.ok) setOpportunities(await resOpps.json());
      if (resAlerts.ok) setAlerts(await resAlerts.json());
      if (resHistory.ok) setHistory(await resHistory.json());
    } catch (err) {
      setError("Failed to load backlink lifecycle telemetry.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddBacklink = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/backlink-lifecycle/add?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_url: sourceUrl,
          target_url: targetUrl,
          target_domain: targetDomain,
          anchor_text: anchorText,
          rel_attribute: relAttribute,
          anchor_type: anchorType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage(`Backlink registered successfully! Status: ${data.status} | Health Score: ${data.health_score}`);
        loadData();
      } else {
        setError("Failed to register managed backlink.");
      }
    } catch (err) {
      setError("Network error registering backlink.");
    }
  };

  const avgHealthScore = backlinks.length > 0
    ? round(backlinks.reduce((acc, b) => acc + (b.health_score || 0), 0) / backlinks.length, 1)
    : 85.0;

  function round(val: number, decimals: number) {
    return Number(Math.round(Number(val + "e" + decimals)) + "e-" + decimals);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs px-2.5 py-0.5 rounded font-mono uppercase tracking-wider">
                Phase 23 Backlink Platform
              </span>
              <span className="text-xs text-slate-400 font-mono">v1.0.0-backlinks</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Enterprise Backlink Intelligence, Monitoring & Lifecycle Management Platform
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Continuous backlink lifecycle tracking, health scoring, anchor text distribution, link velocity, toxic link detection, and opportunities.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/internal/index-verification"
              className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium border border-slate-700 transition"
            >
              ← Index Verification (Phase 22)
            </a>
            <a
              href="/internal/billing"
              className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition"
            >
              Billing Platform →
            </a>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-950/80 border border-red-800 text-red-200 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {message && (
          <div className="mt-4 p-4 rounded-lg bg-emerald-950/80 border border-emerald-800 text-emerald-200 text-sm flex items-center justify-between">
            <span>{message}</span>
            <button onClick={() => setMessage("")} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="mt-6 flex overflow-x-auto scrollbar-none gap-2 border-b border-slate-800 pb-2">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                  active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-mono text-sm animate-pulse">
            Loading Backlink Intelligence telemetry...
          </div>
        ) : (
          <>
            {/* 1. OVERVIEW */}
            {tab === "overview" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Tracked Backlinks</div>
                    <div className="text-2xl font-bold text-emerald-400 mt-2">{backlinks.length} Links</div>
                    <div className="text-xs text-emerald-500 mt-1">Active managed profile</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Avg Health Score</div>
                    <div className="text-2xl font-bold text-sky-400 mt-2">{avgHealthScore} / 100</div>
                    <div className="text-xs text-sky-400 mt-1">Composite profile health</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Brand Anchors</div>
                    <div className="text-2xl font-bold text-purple-400 mt-2">{anchorSummary?.brand_anchors_percent || 55.0}%</div>
                    <div className="text-xs text-purple-400 mt-1">Over-opt Risk: {anchorSummary?.over_optimization_risk || "Low Risk"}</div>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                    <div className="text-xs font-mono text-slate-400 uppercase tracking-wider">Active Alerts</div>
                    <div className="text-2xl font-bold text-amber-400 mt-2">{alerts.length} Alerts</div>
                    <div className="text-xs text-amber-400 mt-1">Anomaly & drop alerts</div>
                  </div>
                </div>

                {/* Form to Register Backlink */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                  <h2 className="text-base font-semibold text-white mb-4">Register Backlink for Lifecycle Monitoring</h2>
                  <form onSubmit={handleAddBacklink} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-mono text-slate-400 mb-1">Source URL</label>
                      <input
                        type="url"
                        value={sourceUrl}
                        onChange={(e) => setSourceUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Target Domain</label>
                      <input
                        type="text"
                        value={targetDomain}
                        onChange={(e) => setTargetDomain(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-mono text-slate-400 mb-1">Target URL</label>
                      <input
                        type="url"
                        value={targetUrl}
                        onChange={(e) => setTargetUrl(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Anchor Text</label>
                      <input
                        type="text"
                        value={anchorText}
                        onChange={(e) => setAnchorText(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Rel Attribute</label>
                      <select
                        value={relAttribute}
                        onChange={(e) => setRelAttribute(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      >
                        <option value="Follow">Follow</option>
                        <option value="Nofollow">Nofollow</option>
                        <option value="Sponsored">Sponsored</option>
                        <option value="UGC">UGC</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-mono text-slate-400 mb-1">Anchor Type</label>
                      <select
                        value={anchorType}
                        onChange={(e) => setAnchorType(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-white"
                      >
                        <option value="Brand">Brand Anchors</option>
                        <option value="Exact Match">Exact Match</option>
                        <option value="Partial Match">Partial Match</option>
                        <option value="Generic Anchors">Generic Anchors</option>
                        <option value="Naked URLs">Naked URLs</option>
                        <option value="Image Anchors">Image Anchors</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3 pt-2">
                      <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-4 py-2 rounded">
                        Add Backlink to Intelligence Engine
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* 2. LIFECYCLE */}
            {tab === "lifecycle" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Tracked Backlink Lifecycle Records</h2>
                <div className="space-y-3">
                  {backlinks.map((b, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono text-sky-400">{b.source_url} → {b.target_url}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          Anchor: <span className="text-slate-200">"{b.anchor_text}"</span> ({b.anchor_type}) | Rel: {b.rel_attribute} | HTTP: {b.http_status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] font-mono">
                          Health: {b.health_score}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono uppercase">
                          {b.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. HEALTH */}
            {tab === "health" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Composite Health Score Breakdowns</h2>
                <div className="space-y-3">
                  {healthRecords.map((h, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
                      <div className="flex justify-between font-mono text-emerald-400 font-bold">
                        <span>Backlink ID: {h.backlink_id}</span>
                        <span>Overall Health: {h.health_score} / 100</span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-slate-400">
                        <div>Availability: <span className="text-white">{h.link_availability_score}%</span></div>
                        <div>HTTP Status: <span className="text-white">{h.http_status_score}%</span></div>
                        <div>Domain Trust: <span className="text-white">{h.domain_trust_score}%</span></div>
                        <div>Spam Indicator: <span className="text-white">{h.spam_indicator_score}%</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. ANCHORS */}
            {tab === "anchors" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Anchor Text Distribution & Over-Optimization Intelligence</h2>
                {anchorSummary && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 font-mono uppercase">Over-Optimization Risk Level</span>
                      <span className={`px-3 py-1 rounded font-bold font-mono ${
                        anchorSummary.over_optimization_risk === "High Risk"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {anchorSummary.over_optimization_risk}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-slate-950 rounded border border-slate-800">
                        <div className="text-slate-400 text-[10px]">Brand Anchors</div>
                        <div className="text-xl font-bold text-sky-400 mt-1">{anchorSummary.brand_anchors_percent}%</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded border border-slate-800">
                        <div className="text-slate-400 text-[10px]">Exact Match</div>
                        <div className="text-xl font-bold text-emerald-400 mt-1">{anchorSummary.exact_match_percent}%</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded border border-slate-800">
                        <div className="text-slate-400 text-[10px]">Partial Match</div>
                        <div className="text-xl font-bold text-purple-400 mt-1">{anchorSummary.partial_match_percent}%</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded border border-slate-800">
                        <div className="text-slate-400 text-[10px]">Generic Anchors</div>
                        <div className="text-xl font-bold text-amber-400 mt-1">{anchorSummary.generic_percent}%</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded border border-slate-800">
                        <div className="text-slate-400 text-[10px]">Naked URLs</div>
                        <div className="text-xl font-bold text-slate-200 mt-1">{anchorSummary.naked_urls_percent}%</div>
                      </div>
                      <div className="p-3 bg-slate-950 rounded border border-slate-800">
                        <div className="text-slate-400 text-[10px]">Image Anchors</div>
                        <div className="text-xl font-bold text-pink-400 mt-1">{anchorSummary.image_anchors_percent}%</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 5. DOMAINS */}
            {tab === "domains" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Referring Domain Trust & Diversity</h2>
                <div className="space-y-3">
                  {domains.map((d, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono text-emerald-400">{d.domain_name}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          IP: {d.ip_address} | Country: {d.country_code} | TLD: {d.tld} | Traffic Trend: {d.traffic_trend}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                          DA: {d.domain_authority}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-400 text-[10px] font-mono">
                          {d.referring_link_count} Links
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. VELOCITY */}
            {tab === "velocity" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Link Acquisition & Loss Velocity Snapshots</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {velocity.map((v, idx) => (
                    <div key={idx} className="p-4 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-2">
                      <div className="flex justify-between font-mono text-emerald-400 font-bold">
                        <span>Date: {v.snapshot_date}</span>
                        <span>Net Growth: +{v.net_growth}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                        <div>New Links: <span className="text-emerald-400 font-bold">+{v.new_backlinks_count}</span></div>
                        <div>Lost Links: <span className="text-red-400 font-bold">-{v.lost_backlinks_count}</span></div>
                        <div>Acquisition Vel: <span className="text-white">{v.acquisition_velocity}/day</span></div>
                        <div>Loss Vel: <span className="text-white">{v.loss_velocity}/day</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 7. TOXIC */}
            {tab === "toxic" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Toxic Link Detection & Disavow Manager</h2>
                <div className="space-y-3">
                  {toxicLinks.length > 0 ? (
                    toxicLinks.map((t, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex justify-between font-mono">
                          <span className="text-red-400">{t.source_url}</span>
                          <span className="text-red-400 font-bold">{t.risk_level}</span>
                        </div>
                        <div className="text-slate-300">{t.recommended_action}</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs">No toxic links detected. Profile is healthy.</div>
                  )}
                </div>
              </div>
            )}

            {/* 8. OPPORTUNITIES */}
            {tab === "opportunities" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Actionable Optimization Opportunities</h2>
                <div className="space-y-3">
                  {opportunities.map((o, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-xs">
                      <div className="flex justify-between font-mono">
                        <span className="text-emerald-400 font-bold">{o.title}</span>
                        <span className="text-amber-400 font-bold">{o.impact_level} Impact</span>
                      </div>
                      <div className="text-slate-300">{o.description}</div>
                      <div className="text-slate-500 text-[10px]">Category: {o.category}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 9. ALERTS */}
            {tab === "alerts" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Backlink Anomaly & Loss Alerts</h2>
                <div className="space-y-3">
                  {alerts.length > 0 ? (
                    alerts.map((a, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs space-y-1">
                        <div className="flex justify-between font-mono text-red-400 font-bold">
                          <span>{a.title}</span>
                          <span>{a.severity}</span>
                        </div>
                        <div className="text-slate-300">{a.description}</div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-slate-500 text-xs">No active backlink alerts. All systems healthy.</div>
                  )}
                </div>
              </div>
            )}

            {/* 10. HISTORY */}
            {tab === "history" && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4">Anchor Text & Rel Change Audit Logs</h2>
                <div className="space-y-3">
                  {history.map((h, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-mono text-sky-400">{h.source_url}</div>
                        <div className="text-slate-400 text-[10px] mt-0.5">
                          Change Event: <span className="text-emerald-400 font-bold">{h.change_event}</span> | Old Anchor: "{h.previous_anchor}" → New Anchor: "{h.new_anchor}"
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-mono">
                        Logged
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

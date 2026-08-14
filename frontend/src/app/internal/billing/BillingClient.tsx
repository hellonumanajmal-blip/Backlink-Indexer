"use client";

import { useCallback, useEffect, useState } from "react";

type Tab = "overview" | "subscription" | "usage" | "invoices" | "payments" | "plans" | "history" | "coupons";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Overview & MRR" },
  { id: "subscription", label: "My Subscription" },
  { id: "usage", label: "Quotas & Usage" },
  { id: "invoices", label: "Invoices" },
  { id: "payments", label: "Payment History" },
  { id: "plans", label: "Plans & Tier Matrix" },
  { id: "history", label: "Audit Trail" },
  { id: "coupons", label: "Coupons & Promos" },
];

export default function BillingClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [plans, setPlans] = useState<any[]>([]);
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [featureGating, setFeatureGating] = useState<any>(null);
  const [mrrData, setMrrData] = useState<any>(null);

  const [couponInput, setCouponInput] = useState("");
  const [selectedCycle, setSelectedCycle] = useState<"monthly" | "annual">("monthly");

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        resPlans,
        resSub,
        resUsage,
        resInv,
        resHist,
        resCoup,
        resGate,
        resMrr,
      ] = await Promise.all([
        fetch("/api/billing/plans"),
        fetch("/api/billing/subscription?tenant_id=default"),
        fetch("/api/billing/usage?tenant_id=default"),
        fetch("/api/billing/invoices?tenant_id=default"),
        fetch("/api/billing/history?tenant_id=default"),
        fetch("/api/billing/coupons"),
        fetch("/api/billing/feature-gating?tenant_id=default"),
        fetch("/api/billing/mrr"),
      ]);

      if (resPlans.ok) setPlans(await resPlans.json());
      if (resSub.ok) setSubscription(await resSub.json());
      if (resUsage.ok) setUsage(await resUsage.json());
      if (resInv.ok) setInvoices(await resInv.json());
      if (resHist.ok) setHistory(await resHist.json());
      if (resCoup.ok) setCoupons(await resCoup.json());
      if (resGate.ok) setFeatureGating(await resGate.json());
      if (resMrr.ok) setMrrData(await resMrr.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load billing telemetry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleSubscribe(planCode: string) {
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/billing/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: "default",
          plan_code: planCode,
          billing_cycle: selectedCycle,
          coupon_code: couponInput || undefined,
        }),
      });
      if (res.ok) {
        setMessage(`Successfully subscribed to ${planCode.toUpperCase()} (${selectedCycle})!`);
        await loadAll();
      } else {
        setError("Failed to process subscription");
      }
    } catch (e) {
      setError("Error subscribing to plan");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/billing/cancel?tenant_id=default", { method: "POST" });
      if (res.ok) {
        setMessage("Subscription canceled. 7-day grace period activated.");
        await loadAll();
      } else {
        setError("Failed to cancel subscription");
      }
    } catch (e) {
      setError("Error canceling subscription");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRenew() {
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/billing/renew?tenant_id=default", { method: "POST" });
      if (res.ok) {
        setMessage("Subscription renewed successfully!");
        await loadAll();
      } else {
        setError("Failed to renew subscription");
      }
    } catch (e) {
      setError("Error renewing subscription");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleApplyCoupon() {
    if (!couponInput) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/billing/apply-coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: "default", coupon_code: couponInput }),
      });
      if (res.ok) {
        setMessage(`Coupon ${couponInput} applied successfully!`);
        setCouponInput("");
        await loadAll();
      } else {
        setError("Invalid or expired coupon code");
      }
    } catch (e) {
      setError("Failed to apply coupon");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
              $
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                PintDown Enterprise Billing & Subscription Platform
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Phase 18
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Multi-Tenant Subscriptions, Metered Quota Enforcement, Tax Invoices & Feature Gating
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/internal/backlink-lifecycle"
              className="text-xs px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-medium shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Backlink Platform (Phase 23)</span>
              <span>→</span>
            </a>
            <a
              href="/internal/index-verification"
              className="text-xs px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Index Verification Platform (Phase 22)</span>
            </a>
            <a
              href="/internal/discovery"
              className="text-xs px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium shadow-sm transition-all flex items-center gap-1.5"
            >
              <span>Discovery Platform (Phase 21)</span>
            </a>
            <a
              href="/internal/indexing-intelligence"
              className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium transition-all flex items-center gap-1.5"
            >
              <span>Indexing Intelligence (Phase 20)</span>
            </a>
          </div>
          {mrrData && (
            <div className="flex items-center gap-4 text-xs font-mono">
              <div className="bg-slate-800/80 border border-slate-700/80 rounded px-3 py-1.5 text-right">
                <p className="text-[10px] text-slate-400 uppercase">Monthly Recurring Revenue</p>
                <p className="text-sm font-bold text-emerald-400">${mrrData.mrr_usd.toLocaleString()}</p>
              </div>
              <div className="bg-slate-800/80 border border-slate-700/80 rounded px-3 py-1.5 text-right">
                <p className="text-[10px] text-slate-400 uppercase">Annual Run Rate</p>
                <p className="text-sm font-bold text-sky-400">${mrrData.arr_usd.toLocaleString()}</p>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 pt-6 space-y-6">
        {/* Messages */}
        {error && (
          <div className="rounded-md bg-red-500/10 border border-red-500/30 p-4 text-xs text-red-300">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-300 font-mono">
            {message}
          </div>
        )}

        {/* Tabs */}
        <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-xs font-medium rounded-md transition-all ${
                tab === t.id
                  ? "bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Loading billing telemetry...</div>
        ) : (
          <>
            {/* 1. OVERVIEW & MRR */}
            {tab === "overview" && (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-4">
                    <p className="text-xs text-slate-400">Current Plan Tier</p>
                    <p className="text-xl font-bold text-white mt-1 uppercase tracking-wide">
                      {subscription?.plan_name || "Free"}
                    </p>
                    <p className="text-xs text-emerald-400 mt-1 capitalize">{subscription?.status || "active"}</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-4">
                    <p className="text-xs text-slate-400">Billing Cycle Price</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">${subscription?.price_usd || 0} / mo</p>
                    <p className="text-xs text-slate-400 mt-1 capitalize">{subscription?.billing_cycle || "monthly"} cycle</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-4">
                    <p className="text-xs text-slate-400">Active Subscriptions</p>
                    <p className="text-2xl font-bold text-sky-400 mt-1">{mrrData?.total_active_subscriptions || 0}</p>
                    <p className="text-xs text-slate-400 mt-1">{mrrData?.trial_users || 0} trial users</p>
                  </div>
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-4">
                    <p className="text-xs text-slate-400">Applied Discount</p>
                    <p className="text-xl font-bold text-amber-400 mt-1">{subscription?.applied_coupon_code || "None"}</p>
                    <p className="text-xs text-slate-400 mt-1">Promotional coupon</p>
                  </div>
                </div>

                {/* Feature Gating Matrix Status */}
                {featureGating && (
                  <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-3">
                    <h2 className="text-sm font-semibold text-white">Enabled Enterprise Modules (Feature Gating)</h2>
                    <div className="grid gap-3 sm:grid-cols-4">
                      {Object.entries(featureGating.features).map(([feat, enabled]: any) => (
                        <div key={feat} className="flex items-center justify-between p-3 rounded bg-slate-900/50 border border-slate-800">
                          <span className="text-xs capitalize text-slate-300">{feat.replace("_", " ")}</span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                              enabled
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                : "bg-slate-800 text-slate-500 border-slate-700"
                            }`}
                          >
                            {enabled ? "ENABLED" : "LOCKED"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. MY SUBSCRIPTION */}
            {tab === "subscription" && subscription && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/60 pb-4">
                  <div>
                    <h2 className="text-base font-bold text-white">Active Subscription Tier</h2>
                    <p className="text-xs text-slate-400">Manage billing schedule, grace periods, and renewal status</p>
                  </div>
                  <span className="px-3 py-1 text-xs font-mono font-semibold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                    {subscription.status}
                  </span>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                  <div className="p-3.5 rounded bg-slate-900/50 border border-slate-800 space-y-1">
                    <p className="text-slate-400">Plan Code & Name</p>
                    <p className="text-sm font-bold text-white">{subscription.plan_name} ({subscription.plan_code})</p>
                  </div>
                  <div className="p-3.5 rounded bg-slate-900/50 border border-slate-800 space-y-1">
                    <p className="text-slate-400">Billing Cycle</p>
                    <p className="text-sm font-bold text-sky-400 capitalize">{subscription.billing_cycle}</p>
                  </div>
                  <div className="p-3.5 rounded bg-slate-900/50 border border-slate-800 space-y-1">
                    <p className="text-slate-400">Period Expiration</p>
                    <p className="text-sm font-mono text-emerald-400">{new Date(subscription.current_period_end).toLocaleDateString()}</p>
                  </div>
                  {subscription.trial_end && (
                    <div className="p-3.5 rounded bg-amber-500/10 border border-amber-500/30 space-y-1">
                      <p className="text-amber-400 font-semibold">Trial Expiration</p>
                      <p className="text-sm font-mono text-amber-200">{new Date(subscription.trial_end).toLocaleDateString()}</p>
                    </div>
                  )}
                  {subscription.grace_period_until && (
                    <div className="p-3.5 rounded bg-red-500/10 border border-red-500/30 space-y-1">
                      <p className="text-red-400 font-semibold">Grace Period Active Until</p>
                      <p className="text-sm font-mono text-red-200">{new Date(subscription.grace_period_until).toLocaleDateString()}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => void handleRenew()}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50"
                  >
                    Renew Subscription
                  </button>
                  <button
                    onClick={() => void handleCancel()}
                    disabled={actionLoading || subscription.status === "canceled"}
                    className="px-4 py-2 text-xs font-semibold rounded bg-red-600/80 hover:bg-red-500 text-white shadow-sm transition-all disabled:opacity-50"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>
            )}

            {/* 3. QUOTAS & USAGE */}
            {tab === "usage" && usage && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-white">Metered Resource Quota Utilization</h2>
                    {usage.has_any_hard_limit_exceeded && (
                      <span className="px-2.5 py-1 text-[10px] font-mono font-bold rounded bg-red-500/20 text-red-300 border border-red-500/40">
                        HARD LIMIT EXCEEDED
                      </span>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {usage.metrics.map((m: any) => (
                      <div key={m.metric_key} className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-white capitalize">{m.metric_key.replace("_", " ")}</span>
                          <span className="font-mono text-slate-400">
                            {m.used.toLocaleString()} / {m.limit.toLocaleString()}
                          </span>
                        </div>

                        {/* Meter Bar */}
                        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              m.is_hard_exceeded
                                ? "bg-red-500"
                                : m.is_soft_exceeded
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                            }`}
                            style={{ width: `${Math.min(100, m.usage_percentage)}%` }}
                          />
                        </div>

                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span>Soft Limit: {m.soft_limit.toLocaleString()}</span>
                          <span
                            className={
                              m.is_hard_exceeded
                                ? "text-red-400 font-bold"
                                : m.is_soft_exceeded
                                ? "text-amber-400 font-bold"
                                : "text-emerald-400"
                            }
                          >
                            {m.usage_percentage}% Used
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. INVOICES */}
            {tab === "invoices" && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Invoice History & Statements</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Invoice #</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Subtotal</th>
                        <th className="p-3">Tax</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Due Date</th>
                        <th className="p-3">Paid Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {invoices.map((inv: any) => (
                        <tr key={inv.invoice_id} className="hover:bg-slate-800/40">
                          <td className="p-3 font-mono font-medium text-white">{inv.invoice_number}</td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                                inv.status === "paid"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="p-3">${inv.subtotal_usd.toFixed(2)}</td>
                          <td className="p-3">${inv.tax_usd.toFixed(2)}</td>
                          <td className="p-3 font-bold text-emerald-400">${inv.total_usd.toFixed(2)}</td>
                          <td className="p-3 text-slate-400">{new Date(inv.due_date).toLocaleDateString()}</td>
                          <td className="p-3 text-slate-400">{inv.paid_at ? new Date(inv.paid_at).toLocaleDateString() : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 5. PAYMENTS */}
            {tab === "payments" && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Payment Gateways & Transaction Logs</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Transaction Reference</th>
                        <th className="p-3">Provider</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Method</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {history.length > 0 ? (
                        invoices.map((inv: any) => (
                          <tr key={inv.invoice_id} className="hover:bg-slate-800/40">
                            <td className="p-3 font-mono text-sky-400">tx_{inv.invoice_number.toLowerCase()}</td>
                            <td className="p-3 font-mono text-slate-400">stripe_abstraction</td>
                            <td className="p-3 font-bold text-emerald-400">${inv.total_usd.toFixed(2)}</td>
                            <td className="p-3 text-slate-400">Card (Visa)</td>
                            <td className="p-3 font-mono text-emerald-300">succeeded</td>
                            <td className="p-3 text-slate-400">{new Date(inv.due_date).toLocaleDateString()}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-500">No payment logs found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 6. PLANS & TIER MATRIX */}
            {tab === "plans" && (
              <div className="space-y-6">
                <div className="flex justify-between items-center bg-slate-800/40 border border-slate-700/60 p-4 rounded-lg">
                  <span className="text-xs font-medium text-slate-300">Billing Cycle:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedCycle("monthly")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded ${
                        selectedCycle === "monthly" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setSelectedCycle("annual")}
                      className={`px-3 py-1.5 text-xs font-semibold rounded ${
                        selectedCycle === "annual" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      Annual (Save ~20%)
                    </button>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
                  {plans.map((p) => {
                    const price = selectedCycle === "annual" ? p.annual_price_usd / 12 : p.monthly_price_usd;
                    const isCurrent = subscription?.plan_code === p.code;

                    return (
                      <div
                        key={p.code}
                        className={`rounded-xl border p-5 flex flex-col justify-between space-y-4 ${
                          isCurrent
                            ? "bg-slate-800/90 border-emerald-500/60 ring-1 ring-emerald-500/30"
                            : "bg-slate-800/40 border-slate-700/60"
                        }`}
                      >
                        <div className="space-y-2">
                          <h3 className="text-base font-bold text-white">{p.name}</h3>
                          <p className="text-[11px] text-slate-400 min-h-[32px]">{p.description}</p>
                          <div className="pt-2">
                            <span className="text-2xl font-bold text-emerald-400">${price.toFixed(0)}</span>
                            <span className="text-xs text-slate-400"> / mo</span>
                          </div>
                        </div>

                        <ul className="text-[11px] space-y-1.5 text-slate-300 border-t border-slate-700/60 pt-3">
                          <li>• Projects: <b>{p.max_projects}</b></li>
                          <li>• Campaigns: <b>{p.max_campaigns}</b></li>
                          <li>• Backlinks: <b>{p.max_backlinks.toLocaleString()}</b></li>
                          <li>• AI Engine: <b>{p.feature_ai_engine ? "Yes" : "No"}</b></li>
                          <li>• Analytics: <b>{p.feature_analytics ? "Yes" : "No"}</b></li>
                        </ul>

                        <button
                          onClick={() => void handleSubscribe(p.code)}
                          disabled={actionLoading || isCurrent}
                          className={`w-full py-2 text-xs font-semibold rounded transition-all ${
                            isCurrent
                              ? "bg-slate-700 text-slate-400 cursor-default"
                              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                          }`}
                        >
                          {isCurrent ? "Current Plan" : `Subscribe ${p.name}`}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 7. AUDIT TRAIL */}
            {tab === "history" && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                <h2 className="text-sm font-semibold text-white">Subscription & Billing Audit Trail</h2>
                <div className="divide-y divide-slate-800 text-xs">
                  {history.map((item) => (
                    <div key={item.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white capitalize">{item.action.replace("_", " ")}</p>
                        <p className="text-slate-400 text-[10px]">Actor: {item.actor} • {new Date(item.timestamp).toLocaleString()}</p>
                      </div>
                      <span className="font-mono text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        SUCCESS
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 8. COUPONS & PROMOS */}
            {tab === "coupons" && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white">Redeem Coupon Code</h2>
                  <div className="flex gap-3 max-w-md">
                    <input
                      type="text"
                      placeholder="e.g. PROMO20"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-3 py-2 flex-1 font-mono uppercase"
                    />
                    <button
                      onClick={() => void handleApplyCoupon()}
                      disabled={actionLoading || !couponInput}
                      className="px-4 py-2 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all disabled:opacity-50"
                    >
                      Apply Code
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-5 space-y-4">
                  <h2 className="text-sm font-semibold text-white">Active Promotional Discounts</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {coupons.map((c) => (
                      <div key={c.code} className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="font-mono font-bold text-amber-400 text-sm">{c.code}</span>
                          <span className="text-[10px] font-mono text-emerald-400 uppercase">ACTIVE</span>
                        </div>
                        <p className="text-xs text-slate-300">{c.description}</p>
                        <p className="text-[10px] text-slate-400">
                          Value: {c.discount_type === "percentage" ? `${c.discount_value}% OFF` : `$${c.discount_value} OFF`}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

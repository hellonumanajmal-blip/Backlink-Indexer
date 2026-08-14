"use client";

import { useCallback, useEffect, useState } from "react";

type Tab =
  | "profile"
  | "subscription"
  | "payment_methods"
  | "address_tax"
  | "contacts"
  | "invoices"
  | "quotas"
  | "organization"
  | "coupons"
  | "exports"
  | "notifications"
  | "security";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "profile", label: "Profile & Company" },
  { id: "subscription", label: "Self-Service Subscription" },
  { id: "payment_methods", label: "Payment Methods" },
  { id: "address_tax", label: "Billing Address & Tax" },
  { id: "contacts", label: "Billing Contacts" },
  { id: "invoices", label: "Invoices & Receipts (PDF)" },
  { id: "quotas", label: "Quota & Usage Trends" },
  { id: "organization", label: "Organization & Members" },
  { id: "coupons", label: "Coupon Center" },
  { id: "exports", label: "Export Data Center" },
  { id: "notifications", label: "Notifications & Alerts" },
  { id: "security", label: "Security & Sessions" },
];

export default function CustomerPortalClient() {
  const [tab, setTab] = useState<Tab>("profile");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [profile, setProfile] = useState<any>(null);
  const [billingAddress, setBillingAddress] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [taxProfile, setTaxProfile] = useState<any>(null);
  const [previewInvoice, setPreviewInvoice] = useState<any>(null);
  const [quotaAnalytics, setQuotaAnalytics] = useState<any>(null);
  const [organization, setOrganization] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<any>(null);

  // Form states
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [newContactType, setNewContactType] = useState("billing");
  const [cardBrand, setCardBrand] = useState("visa");
  const [cardLastFour, setCardLastFour] = useState("4242");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<any>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        resProf,
        resAddr,
        resCont,
        resPM,
        resTax,
        resPrev,
        resAnalytics,
        resOrg,
        resMemb,
        resNotif,
        resNotifPrefs,
      ] = await Promise.all([
        fetch("/api/customer/profile?tenant_id=default"),
        fetch("/api/customer/billing?tenant_id=default"),
        fetch("/api/customer/billing/contacts?tenant_id=default"),
        fetch("/api/customer/payment-methods?tenant_id=default"),
        fetch("/api/customer/tax?tenant_id=default"),
        fetch("/api/customer/subscription/preview-next-invoice?tenant_id=default"),
        fetch("/api/customer/usage/analytics?tenant_id=default"),
        fetch("/api/customer/organization?tenant_id=default"),
        fetch("/api/customer/organization/members?tenant_id=default"),
        fetch("/api/customer/notifications?tenant_id=default"),
        fetch("/api/customer/notifications/preferences?tenant_id=default"),
      ]);

      if (resProf.ok) {
        const p = await resProf.json();
        setProfile(p);
        setFullName(p.full_name);
        setCompanyName(p.company_name);
      }
      if (resAddr.ok) {
        const a = await resAddr.json();
        setBillingAddress(a);
        setStreet(a.street);
        setCity(a.city);
        setState(a.state);
        setPostalCode(a.postal_code);
        setVatNumber(a.vat_number || "");
      }
      if (resCont.ok) setContacts(await resCont.json());
      if (resPM.ok) setPaymentMethods(await resPM.json());
      if (resTax.ok) setTaxProfile(await resTax.json());
      if (resPrev.ok) setPreviewInvoice(await resPrev.json());
      if (resAnalytics.ok) setQuotaAnalytics(await resAnalytics.json());
      if (resOrg.ok) setOrganization(await resOrg.json());
      if (resMemb.ok) setMembers(await resMemb.json());
      if (resNotif.ok) setNotifications(await resNotif.json());
      if (resNotifPrefs.ok) setNotifPrefs(await resNotifPrefs.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load customer portal telemetry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function handleSaveProfile() {
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/customer/profile?tenant_id=default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, company_name: companyName }),
      });
      if (res.ok) {
        setMessage("Profile and Company updated successfully!");
        await loadAll();
      } else {
        setError("Failed to update profile");
      }
    } catch {
      setError("Error updating profile");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSaveBillingAddress() {
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/customer/billing?tenant_id=default", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: "US",
          region: "CA",
          state,
          city,
          postal_code: postalCode,
          street,
          vat_number: vatNumber,
        }),
      });
      if (res.ok) {
        setMessage("Billing address and tax numbers updated!");
        await loadAll();
      } else {
        setError("Failed to update billing address");
      }
    } catch {
      setError("Error updating address");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddContact() {
    if (!newContactEmail || !newContactName) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/customer/billing/contacts?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_type: newContactType,
          name: newContactName,
          email: newContactEmail,
        }),
      });
      if (res.ok) {
        setMessage("Department contact added!");
        setNewContactEmail("");
        setNewContactName("");
        await loadAll();
      } else {
        setError("Failed to add contact");
      }
    } catch {
      setError("Error adding contact");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleAddPaymentMethod() {
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/customer/payment-methods?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: cardBrand,
          last_four: cardLastFour,
          exp_month: 12,
          exp_year: 2029,
          set_as_default: true,
        }),
      });
      if (res.ok) {
        setMessage("New payment card added and set as default!");
        await loadAll();
      } else {
        setError("Failed to add card");
      }
    } catch {
      setError("Error adding card");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSetDefaultPaymentMethod(id: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/customer/payment-methods/${id}/default?tenant_id=default`, { method: "POST" });
      if (res.ok) {
        setMessage("Default card updated!");
        await loadAll();
      }
    } catch {
      setError("Error updating default card");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDeletePaymentMethod(id: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/customer/payment-methods/${id}?tenant_id=default`, { method: "DELETE" });
      if (res.ok) {
        setMessage("Payment card deleted!");
        await loadAll();
      }
    } catch {
      setError("Error deleting card");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSubscriptionAction(action: "upgrade" | "downgrade" | "pause" | "reactivate", planCode?: string) {
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(`/api/customer/subscription/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenant_id: "default", new_plan_code: planCode }),
      });
      if (res.ok) {
        setMessage(`Subscription action '${action.toUpperCase()}' completed successfully!`);
        await loadAll();
      } else {
        setError("Failed to process subscription action");
      }
    } catch {
      setError("Error processing action");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleInviteMember() {
    if (!newMemberEmail || !newMemberName) return;
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/customer/organization/members?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newMemberEmail,
          name: newMemberName,
          role: newMemberRole,
        }),
      });
      if (res.ok) {
        setMessage(`Team member invite sent to ${newMemberEmail}!`);
        setNewMemberEmail("");
        setNewMemberName("");
        await loadAll();
      } else {
        setError("Failed to invite member");
      }
    } catch {
      setError("Error inviting member");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRemoveMember(email: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/customer/organization/members/${encodeURIComponent(email)}?tenant_id=default`, { method: "DELETE" });
      if (res.ok) {
        setMessage(`Removed member ${email}`);
        await loadAll();
      }
    } catch {
      setError("Error removing member");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePreviewCoupon() {
    if (!couponCode) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/customer/coupons/preview?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coupon_code: couponCode }),
      });
      if (res.ok) {
        setCouponPreview(await res.json());
      } else {
        setError("Invalid coupon code");
      }
    } catch {
      setError("Error previewing coupon");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTriggerExport(exportType: string) {
    setActionLoading(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch("/api/customer/exports/generate?tenant_id=default", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ export_type: exportType }),
      });
      if (res.ok) {
        setMessage(`Export '${exportType}' generated successfully! Ready for download.`);
      } else {
        setError("Failed to generate export");
      }
    } catch {
      setError("Error generating export");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-12">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 font-bold text-lg">
              CP
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                PintDown Customer Portal & Self-Service Billing
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Phase 19
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Self-Service Subscriptions, Payment Instruments, Tax Statements & Organization RBAC
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="/internal/billing"
              className="text-xs px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-medium"
            >
              ← Admin Billing Platform
            </a>
          </div>
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

        {/* Navigation Tabs */}
        <nav className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-all ${
                tab === t.id
                  ? "bg-slate-800 text-sky-400 border border-sky-500/30 shadow-sm"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">Loading customer portal...</div>
        ) : (
          <>
            {/* 1. PROFILE & COMPANY */}
            {tab === "profile" && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-6">
                <h2 className="text-base font-bold text-white">Account Profile & Organization Branding</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Primary Contact Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-slate-400">Company Name</label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>
                <button
                  onClick={() => void handleSaveProfile()}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white shadow-sm"
                >
                  Save Profile Settings
                </button>
              </div>
            )}

            {/* 2. SELF-SERVICE SUBSCRIPTION */}
            {tab === "subscription" && previewInvoice && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-6">
                  <div className="flex justify-between items-center border-b border-slate-700 pb-4">
                    <div>
                      <h2 className="text-base font-bold text-white">Current Subscription & Next Renewal</h2>
                      <p className="text-xs text-slate-400">Upgrade, downgrade, pause, or switch billing frequency</p>
                    </div>
                    <span className="px-3 py-1 text-xs font-mono font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                      Active
                    </span>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3 text-xs">
                    <div className="p-4 rounded bg-slate-900/50 border border-slate-800 space-y-1">
                      <p className="text-slate-400">Active Tier</p>
                      <p className="text-lg font-bold text-white uppercase">{previewInvoice.plan_name}</p>
                    </div>
                    <div className="p-4 rounded bg-slate-900/50 border border-slate-800 space-y-1">
                      <p className="text-slate-400">Upcoming Total Due</p>
                      <p className="text-lg font-bold text-emerald-400">${previewInvoice.total_usd.toFixed(2)} USD</p>
                    </div>
                    <div className="p-4 rounded bg-slate-900/50 border border-slate-800 space-y-1">
                      <p className="text-slate-400">Next Billing Date</p>
                      <p className="text-lg font-mono text-sky-400">{new Date(previewInvoice.next_billing_date).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <button
                      onClick={() => void handleSubscriptionAction("upgrade", "enterprise")}
                      disabled={actionLoading}
                      className="px-4 py-2 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      Upgrade to Enterprise
                    </button>
                    <button
                      onClick={() => void handleSubscriptionAction("downgrade", "starter")}
                      disabled={actionLoading}
                      className="px-4 py-2 text-xs font-semibold rounded bg-slate-700 hover:bg-slate-600 text-white"
                    >
                      Downgrade to Starter
                    </button>
                    <button
                      onClick={() => void handleSubscriptionAction("pause")}
                      disabled={actionLoading}
                      className="px-4 py-2 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white"
                    >
                      Pause Subscription
                    </button>
                    <button
                      onClick={() => void handleSubscriptionAction("reactivate")}
                      disabled={actionLoading}
                      className="px-4 py-2 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white"
                    >
                      Reactivate Subscription
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. PAYMENT METHODS */}
            {tab === "payment_methods" && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                  <h2 className="text-base font-bold text-white">Saved Payment Methods</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {paymentMethods.map((pm) => (
                      <div key={pm.id} className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-white uppercase flex items-center gap-2">
                            💳 {pm.brand} •••• {pm.last_four}
                            {pm.is_default && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                DEFAULT
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400">Expires: {pm.exp_month}/{pm.exp_year}</p>
                        </div>
                        <div className="flex gap-2">
                          {!pm.is_default && (
                            <button
                              onClick={() => void handleSetDefaultPaymentMethod(pm.id)}
                              className="text-[10px] text-sky-400 hover:underline"
                            >
                              Set Default
                            </button>
                          )}
                          <button
                            onClick={() => void handleDeletePaymentMethod(pm.id)}
                            className="text-[10px] text-red-400 hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-white">Add Saved Payment Card (Provider Abstraction)</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <label className="text-xs text-slate-400">Card Brand</label>
                      <select
                        value={cardBrand}
                        onChange={(e) => setCardBrand(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                      >
                        <option value="visa">Visa</option>
                        <option value="mastercard">Mastercard</option>
                        <option value="amex">American Express</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">Last Four Digits</label>
                      <input
                        type="text"
                        maxLength={4}
                        value={cardLastFour}
                        onChange={(e) => setCardLastFour(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => void handleAddPaymentMethod()}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white"
                  >
                    Add Instrument
                  </button>
                </div>
              </div>
            )}

            {/* 4. BILLING ADDRESS & TAX */}
            {tab === "address_tax" && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-6">
                <h2 className="text-base font-bold text-white">Tax Profile & Billing Location</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-slate-400">Street Address</label>
                    <input
                      type="text"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">State / Region</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">VAT / Tax Identification Number</label>
                    <input
                      type="text"
                      value={vatNumber}
                      onChange={(e) => setVatNumber(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white font-mono uppercase"
                    />
                  </div>
                </div>
                <button
                  onClick={() => void handleSaveBillingAddress()}
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white"
                >
                  Save Tax Address
                </button>
              </div>
            )}

            {/* 5. CONTACTS */}
            {tab === "contacts" && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                  <h2 className="text-base font-bold text-white">Multi-Department Billing Contacts</h2>
                  <div className="divide-y divide-slate-800 text-xs">
                    {contacts.map((c) => (
                      <div key={c.id} className="py-3 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-white">{c.name}</p>
                          <p className="text-slate-400">{c.email}</p>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30 uppercase">
                          {c.contact_type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-white">Add Department Contact</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Name (e.g. Finance)"
                      value={newContactName}
                      onChange={(e) => setNewContactName(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      value={newContactEmail}
                      onChange={(e) => setNewContactEmail(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    />
                    <select
                      value={newContactType}
                      onChange={(e) => setNewContactType(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    >
                      <option value="billing">Billing</option>
                      <option value="technical">Technical</option>
                      <option value="security">Security</option>
                      <option value="compliance">Compliance</option>
                    </select>
                  </div>
                  <button
                    onClick={() => void handleAddContact()}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white"
                  >
                    Add Contact
                  </button>
                </div>
              </div>
            )}

            {/* 6. INVOICES (PDF) */}
            {tab === "invoices" && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                <h2 className="text-base font-bold text-white">Invoice & Receipt PDF Download Center</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase text-[10px]">
                      <tr>
                        <th className="p-3">Document #</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Total Amount</th>
                        <th className="p-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      <tr className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-white font-bold">INV-2026-001</td>
                        <td className="p-3 font-mono text-sky-400">Invoice PDF</td>
                        <td className="p-3 font-bold text-emerald-400">$163.90 USD</td>
                        <td className="p-3">
                          <a
                            href="/api/customer/invoices/INV-2026-001/pdf?tenant_id=default"
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1 rounded text-[11px] font-medium bg-sky-600 hover:bg-sky-500 text-white inline-block"
                          >
                            📄 Download PDF
                          </a>
                        </td>
                      </tr>
                      <tr className="hover:bg-slate-800/40">
                        <td className="p-3 font-mono text-white font-bold">REC-2026-001</td>
                        <td className="p-3 font-mono text-emerald-400">Receipt PDF</td>
                        <td className="p-3 font-bold text-emerald-400">$163.90 USD</td>
                        <td className="p-3">
                          <a
                            href="/api/customer/invoices/REC-2026-001/receipt?tenant_id=default"
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1 rounded text-[11px] font-medium bg-emerald-600 hover:bg-emerald-500 text-white inline-block"
                          >
                            🧾 Download Receipt
                          </a>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 7. QUOTAS */}
            {tab === "quotas" && quotaAnalytics && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                  <h2 className="text-base font-bold text-white">Usage Forecast & 7-Day Velocity Trends</h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="p-4 rounded bg-slate-900/50 border border-slate-800 space-y-1">
                      <p className="text-xs text-slate-400">API Calls This Month</p>
                      <p className="text-xl font-bold text-white">{quotaAnalytics.total_api_calls_this_month.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded bg-slate-900/50 border border-slate-800 space-y-1">
                      <p className="text-xs text-slate-400">Backlinks Processed</p>
                      <p className="text-xl font-bold text-sky-400">{quotaAnalytics.total_backlinks_indexed.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded bg-slate-900/50 border border-slate-800 space-y-1">
                      <p className="text-xs text-slate-400">End-of-Month Forecast</p>
                      <p className="text-xl font-bold text-emerald-400">{quotaAnalytics.forecast_end_of_month_usage.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 8. ORGANIZATION */}
            {tab === "organization" && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                  <h2 className="text-base font-bold text-white">Organization Team Members & Roles</h2>
                  <div className="divide-y divide-slate-800 text-xs">
                    {members.map((m) => (
                      <div key={m.id} className="py-3 flex justify-between items-center">
                        <div>
                          <p className="font-bold text-white">{m.name} ({m.email})</p>
                          <p className="text-slate-400 capitalize">Role: {m.role}</p>
                        </div>
                        {m.role !== "owner" && (
                          <button
                            onClick={() => void handleRemoveMember(m.email)}
                            className="text-xs text-red-400 hover:underline"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                  <h2 className="text-sm font-semibold text-white">Invite New Team Member</h2>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={newMemberEmail}
                      onChange={(e) => setNewMemberEmail(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    />
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-xs text-white"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  </div>
                  <button
                    onClick={() => void handleInviteMember()}
                    disabled={actionLoading}
                    className="px-4 py-2 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white"
                  >
                    Send Invitation
                  </button>
                </div>
              </div>
            )}

            {/* 9. COUPONS */}
            {tab === "coupons" && (
              <div className="space-y-6">
                <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                  <h2 className="text-base font-bold text-white">Coupon Redemption & Discount Preview</h2>
                  <div className="flex gap-3 max-w-md">
                    <input
                      type="text"
                      placeholder="e.g. PROMO20"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      className="bg-slate-900 border border-slate-700 text-white text-xs rounded px-3 py-2 flex-1 font-mono uppercase"
                    />
                    <button
                      onClick={() => void handlePreviewCoupon()}
                      disabled={actionLoading || !couponCode}
                      className="px-4 py-2 text-xs font-semibold rounded bg-sky-600 hover:bg-sky-500 text-white"
                    >
                      Preview Savings
                    </button>
                  </div>

                  {couponPreview && (
                    <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 space-y-1 font-mono">
                      <p>Coupon: <b>{couponPreview.coupon_code}</b></p>
                      <p>Original Price: ${couponPreview.original_price_usd.toFixed(2)} USD</p>
                      <p>Discounted Price: ${couponPreview.discounted_price_usd.toFixed(2)} USD</p>
                      <p className="text-emerald-400 font-bold">You Save: ${couponPreview.savings_usd.toFixed(2)} USD!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 10. EXPORTS */}
            {tab === "exports" && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                <h2 className="text-base font-bold text-white">Export Data Center</h2>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <button
                    onClick={() => void handleTriggerExport("invoices_pdf")}
                    disabled={actionLoading}
                    className="p-4 rounded bg-slate-900 border border-slate-700 hover:border-sky-500 text-left space-y-1"
                  >
                    <p className="text-xs font-bold text-white">Invoices Pack (PDF)</p>
                    <p className="text-[10px] text-slate-400">Download consolidated tax invoices</p>
                  </button>
                  <button
                    onClick={() => void handleTriggerExport("payments_csv")}
                    disabled={actionLoading}
                    className="p-4 rounded bg-slate-900 border border-slate-700 hover:border-sky-500 text-left space-y-1"
                  >
                    <p className="text-xs font-bold text-white">Payments (CSV)</p>
                    <p className="text-[10px] text-slate-400">Download transaction histories</p>
                  </button>
                  <button
                    onClick={() => void handleTriggerExport("usage_csv")}
                    disabled={actionLoading}
                    className="p-4 rounded bg-slate-900 border border-slate-700 hover:border-sky-500 text-left space-y-1"
                  >
                    <p className="text-xs font-bold text-white">Usage Metrics (CSV)</p>
                    <p className="text-[10px] text-slate-400">Download metered consumption</p>
                  </button>
                  <button
                    onClick={() => void handleTriggerExport("audit_csv")}
                    disabled={actionLoading}
                    className="p-4 rounded bg-slate-900 border border-slate-700 hover:border-sky-500 text-left space-y-1"
                  >
                    <p className="text-xs font-bold text-white">Audit Log (CSV)</p>
                    <p className="text-[10px] text-slate-400">Download security audit trail</p>
                  </button>
                </div>
              </div>
            )}

            {/* 11. NOTIFICATIONS */}
            {tab === "notifications" && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                <h2 className="text-base font-bold text-white">In-App Notification Stream</h2>
                <div className="divide-y divide-slate-800 text-xs">
                  {notifications.map((n) => (
                    <div key={n.id} className="py-3 space-y-1">
                      <p className="font-bold text-white flex items-center gap-2">
                        {n.title}
                        <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-mono uppercase">
                          {n.level}
                        </span>
                      </p>
                      <p className="text-slate-400">{n.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 12. SECURITY */}
            {tab === "security" && (
              <div className="rounded-lg bg-slate-800/60 border border-slate-700/60 p-6 space-y-4">
                <h2 className="text-base font-bold text-white">Active Portal Sessions & Admin Impersonation Logs</h2>
                <div className="p-4 rounded bg-slate-900/50 border border-slate-800 text-xs text-slate-300 space-y-2">
                  <p className="font-mono text-sky-400 font-bold">Active Session: 127.0.0.1 (Browser/1.0)</p>
                  <p className="text-slate-400">Impersonation Mode: Inactive (Normal User Mode)</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

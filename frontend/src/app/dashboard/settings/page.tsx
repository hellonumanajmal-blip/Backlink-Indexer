"use client";

import React, { useState } from "react";
import { User, Lock, KeyRound, Bell, SlidersHorizontal, Copy, Check } from "lucide-react";
import { Card, Button, Input, Label, Select, useToast } from "@/components/ui";

function SectionCard({
  id,
  icon,
  title,
  description,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-24 p-6">
      <div className="mb-5 flex items-start gap-3">
        <div className="rounded-lg border border-indigo-400/30 bg-indigo-500/10 p-2 text-indigo-300">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  async function copyToken() {
    try {
      await navigator.clipboard.writeText("bie_api_key_placeholder");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.push("error", "Could not copy to clipboard");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SectionCard
        id="account"
        icon={<User className="h-4 w-4" />}
        title="Profile"
        description="Your account information. Saving is enabled when the backend auth API is implemented."
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            toast.push("success", "Profile updated locally. Persistence arrives with the auth backend.");
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm">Save changes</Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        id="security"
        icon={<Lock className="h-4 w-4" />}
        title="Security"
        description="Password and session settings. The backend auth module is not implemented yet — the UI is ready for it."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pw">Current password</Label>
            <Input id="cur-pw" type="password" autoComplete="current-password" placeholder="••••••••" disabled />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pw">New password</Label>
            <Input id="new-pw" type="password" autoComplete="new-password" placeholder="At least 8 characters" disabled />
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-600">Password changes require the backend auth API. Fields are disabled until then.</p>
      </SectionCard>

      <SectionCard
        id="api"
        icon={<KeyRound className="h-4 w-4" />}
        title="API Keys"
        description="Tokens for programmatic access to the indexing API."
      >
        <div className="flex items-center gap-2">
          <Input readOnly value="bie_api_key_placeholder" className="font-mono text-xs" />
          <Button variant="secondary" size="sm" onClick={copyToken}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <p className="mt-3 text-xs text-slate-600">
          Placeholder only — real API keys are issued once the backend exposes an API-key
          endpoint. No fake token is stored or issued.
        </p>
      </SectionCard>

      <SectionCard
        id="notifications"
        icon={<Bell className="h-4 w-4" />}
        title="Notifications"
        description="Alert preferences for pipeline events."
      >
        <div className="space-y-3">
          {[
            { label: "New verification evidence", desc: "When a URL moves to Verified or Not Indexed" },
            { label: "Pipeline failures", desc: "When a job fails validation or discovery" },
            { label: "Weekly digest", desc: "A summary of discovery and verification activity" },
          ].map((n) => (
            <label key={n.label} className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-indigo-500" defaultChecked={false} />
              <span>
                <span className="block text-sm font-medium text-white">{n.label}</span>
                <span className="block text-xs text-slate-500">{n.desc}</span>
              </span>
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        id="preferences"
        icon={<SlidersHorizontal className="h-4 w-4" />}
        title="Preferences"
        description="Dashboard defaults."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="tz">Timezone</Label>
            <Select id="tz" defaultValue="utc">
              <option value="utc">UTC</option>
              <option value="local">Local</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rows">Rows per page</Label>
            <Select id="rows" defaultValue="25">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </Select>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import { User, Lock, KeyRound, Bell, SlidersHorizontal, Copy, Check } from "lucide-react";
import { Card, Button, Input, Label, Select, useToast } from "@/components/ui";
import { useAuth } from "@/lib/auth";

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
        <div className="rounded-lg border border-border bg-surface-2 p-2 text-primary">{icon}</div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

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
        id="profile"
        icon={<User className="h-4 w-4" />}
        title="Profile"
        description="Your account information from the real authenticated session."
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            toast.push("info", "Profile editing is not enabled yet — the backend update endpoint does not exist.");
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
          <div className="space-y-1.5">
            <Label htmlFor="profile-role">Role</Label>
            <Input id="profile-role" readOnly value={(user as any)?.role || "user"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-created">Member since</Label>
            <Input
              id="profile-created"
              readOnly
              value={(user as any)?.created_at ? new Date((user as any).created_at).toLocaleDateString() : "—"}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" size="sm" variant="secondary">
              Save changes
            </Button>
          </div>
        </form>
      </SectionCard>

      <SectionCard
        id="security"
        icon={<Lock className="h-4 w-4" />}
        title="Security"
        description="Password and session settings. Password changes require a backend endpoint that does not exist yet."
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
        <p className="mt-3 text-xs text-muted">
          Your session is a JWT stored in an httpOnly cookie. Sign out from the sidebar to end it.
        </p>
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
        <p className="mt-3 text-xs text-muted">
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
            <label key={n.label} className="flex items-start gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border-border bg-surface-2 accent-primary" defaultChecked={false} />
              <span>
                <span className="block text-sm font-medium text-foreground">{n.label}</span>
                <span className="block text-xs text-muted">{n.desc}</span>
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

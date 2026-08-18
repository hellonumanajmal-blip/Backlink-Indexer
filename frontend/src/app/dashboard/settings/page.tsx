"use client";

import React, { useEffect, useState } from "react";
import { User, Lock, KeyRound } from "lucide-react";
import { Card, Input, Label } from "@/components/ui";
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
        <div className="rounded-md border border-border bg-surface-2 p-2 text-muted">{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          <p className="mt-0.5 text-xs text-muted">{description}</p>
        </div>
      </div>
      {children}
    </Card>
  );
}

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    setName(user?.name || "");
    setEmail(user?.email || "");
    setRole(user?.role || "");
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SectionCard
        id="profile"
        icon={<User className="h-4 w-4" />}
        title="Account"
        description="Values come from GET /api/auth/me. Profile editing is not available yet."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="profile-name">Name</Label>
            <Input id="profile-name" readOnly value={name || "—"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-email">Email</Label>
            <Input id="profile-email" type="email" readOnly value={email || "—"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-role">Role</Label>
            <Input id="profile-role" readOnly value={role || "—"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="profile-created">Member since</Label>
            <Input id="profile-created" readOnly value={formatWhen(user?.created_at)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="profile-login">Last login</Label>
            <Input id="profile-login" readOnly value={formatWhen(user?.last_login_at)} />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        id="security"
        icon={<Lock className="h-4 w-4" />}
        title="Session"
        description="Your session is a JWT stored in an httpOnly cookie. Log out from the user menu to end it."
      >
        <p className="text-sm text-muted">
          Password changes are not enabled — the backend has no password-update endpoint yet.
        </p>
      </SectionCard>

      <SectionCard
        id="api"
        icon={<KeyRound className="h-4 w-4" />}
        title="API keys"
        description="Programmatic tokens are not issued yet."
      >
        <p className="text-sm text-muted">
          No API key endpoint exists on the backend, so this page does not display or copy a token.
        </p>
      </SectionCard>
    </div>
  );
}

"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Link2, Mail, Lock, User, Loader2, ArrowLeft } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    // The signup endpoint is not implemented in the backend yet. We probe the
    // existing API so the UI surfaces the real state instead of pretending
    // signup works. Swap this call for the real endpoint when auth lands.
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNotice("Account created. Redirecting to login…");
        window.setTimeout(() => window.location.assign("/login"), 1200);
      } else {
        setError(
          `Signup is not enabled yet — the auth API returned ${res.status}. ` +
            (data?.detail || data?.error || "The signup endpoint will be implemented with the backend auth module.")
        );
      }
    } catch {
      setError("Network error — the API could not be reached.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dark relative flex min-h-screen items-center justify-center bg-[#060714] px-5 py-12 text-foreground">
      <div className="pointer-events-none absolute left-1/2 top-[-160px] -z-10 h-[380px] w-[640px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur">
          <div className="mb-7 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_20px_rgba(99,102,241,0.4)]">
              <Link2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Create your account</h1>
              <p className="text-xs text-slate-500">Start monitoring backlink discovery signals</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input id="name" required autoComplete="name" placeholder="Jane Doe" className="pl-9" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input id="email" type="email" required autoComplete="email" placeholder="you@example.com" className="pl-9" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input id="password" type="password" required autoComplete="new-password" placeholder="At least 8 characters" className="pl-9" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input id="confirm" type="password" required autoComplete="new-password" placeholder="Repeat your password" className="pl-9" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            </div>
            {error ? (
              <p className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
            ) : null}
            {notice ? (
              <p className="rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success">{notice}</p>
            ) : null}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? "Creating account…" : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-semibold text-indigo-400 hover:text-indigo-300">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Link2, Mail, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Radar, Eye as EyeIcon } from "lucide-react";
import { Button, Input, Label } from "@/components/ui";
import { login, useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Authenticated users should not see the login page.
  useEffect(() => {
    if (state === "authenticated") {
      router.replace("/dashboard");
    }
  }, [state, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      setError(res.error || "Invalid email or password.");
    }
  }

  return (
    <div className="dark relative flex min-h-screen bg-background text-foreground">
      {/* Left brand panel */}
      <div className="relative hidden w-[44%] overflow-hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-40 top-1/3 h-96 w-96 rounded-full bg-primary/10 blur-[100px]" />
        <div className="relative px-10 py-10">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2">
              <Link2 className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-foreground">Backlink Indexer</span>
          </Link>
        </div>
        <div className="relative px-10 pb-12">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Know what happens to your backlinks.
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted">
            Validate sources, publish legitimate discovery signals, monitor crawls, and review
            index verification evidence — without fake indexing promises.
          </p>
          <div className="mt-8 space-y-4">
            {[
              { icon: <ShieldCheck className="h-4 w-4" />, text: "Discovery is not indexing — nothing is ever claimed otherwise." },
              { icon: <Radar className="h-4 w-4" />, text: "Crawl monitoring backed by real HTTP and robots evidence." },
              { icon: <EyeIcon className="h-4 w-4" />, text: "INDEXED is only reported with reliable verification evidence." },
            ].map((item) => (
              <div key={item.text} className="flex items-start gap-3 text-sm text-muted">
                <span className="mt-0.5 text-primary">{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-2">
                <Link2 className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-foreground">Backlink Indexer</span>
            </Link>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted">Sign in to your dashboard to continue.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-surface-2 accent-primary"
              />
              Keep me signed in
            </label>
            {error ? (
              <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" loading={loading} className="w-full" size="lg">
              {loading ? "Signing in…" : "Sign in"}
              {!loading ? <ArrowRight className="h-4 w-4" /> : null}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:text-primary-strong">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

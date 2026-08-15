"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { login, useAuth } from "@/lib/auth";

/**
 * Compatibility login for the /internal tree. Uses the same real backend
 * auth as /login (email + password verified by FastAPI, JWT stored in the
 * httpOnly `session` cookie by the proxy). After a successful login the
 * user returns to the internal backlinks dashboard.
 */
export default function LoginPage() {
  const router = useRouter();
  const { state } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Already authenticated users should not see the login page.
  useEffect(() => {
    if (state === "authenticated") {
      router.replace("/internal/backlinks");
    }
  }, [state, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await login(email, password);
    setLoading(false);
    if (res.ok) {
      router.push("/internal/backlinks");
      router.refresh();
    } else {
      setError(res.error || "Invalid email or password.");
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--paper)] px-6">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-2xl font-semibold text-[var(--moss-deep)]">Backlink Indexer</h1>
        <p className="mt-2 text-sm text-[var(--muted)]">Sign in to the internal dashboard.</p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm font-medium text-[var(--ink)]">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--moss)] focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-[var(--ink)]">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink)] focus:border-[var(--moss)] focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-[var(--alert)]">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--moss)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--moss-deep)] disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}

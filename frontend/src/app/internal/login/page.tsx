"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        setError("Invalid credentials");
        return;
      }
      router.push("/internal/backlinks");
      router.refresh();
    } catch {
      setError("Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="font-display text-3xl font-semibold text-[var(--moss-deep)]">PintDown</h1>
      <p className="mt-2 text-[var(--muted)]">Discovery Accelerator — admin login</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <label className="block text-sm font-medium">
          Username
          <input
            className="mt-1 w-full border border-[var(--line)] bg-white px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-sm font-medium">
          Password
          <input
            type="password"
            className="mt-1 w-full border border-[var(--line)] bg-white px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="text-sm text-[var(--alert)]">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-[var(--moss)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--moss-deep)] disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}

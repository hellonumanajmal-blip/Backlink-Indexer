/**
 * Real authentication client.
 *
 * The session is an httpOnly `session` cookie set by the same-origin API proxy
 * (src/app/api/[...path]/route.ts) after the backend validates credentials.
 * The browser never sees the JWT and never stores auth state in localStorage.
 *
 * `useAuth()` resolves the current user through GET /api/auth/me — the single
 * source of truth for whether a session is valid. localStorage flags are not
 * used as an authentication mechanism.
 */

import { useCallback, useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  tenant_id?: string;
  created_at?: string;
  last_login_at?: string | null;
};

export type AuthState = "loading" | "authenticated" | "unauthenticated";

async function request<T>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  try {
    const res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON body */
    }
    if (!res.ok) {
      const body = (data || {}) as { detail?: unknown; error?: unknown };
      const detail = typeof body.detail === "string" ? body.detail : null;
      const error = typeof body.error === "string" ? body.error : null;
      return { ok: false, status: res.status, error: detail || error || `Request failed (${res.status})` };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch {
    return { ok: false, status: 0, error: "Network error — the API could not be reached." };
  }
}

export async function login(email: string, password: string) {
  const res = await request<{ access_token: string; user: AuthUser }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    return { ok: false as const, error: res.error || "Invalid email or password." };
  }
  return { ok: true as const, user: res.data!.user };
}

export async function signup(name: string, email: string, password: string) {
  const res = await request<{ access_token: string; user: AuthUser }>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    return { ok: false as const, error: res.error || "Signup failed." };
  }
  return { ok: true as const, user: res.data!.user };
}

export async function fetchMe(): Promise<{ ok: boolean; status: number; user?: AuthUser; error?: string }> {
  const res = await request<AuthUser>("/api/auth/me", { method: "GET", cache: "no-store" });
  if (!res.ok) return { ok: false, status: res.status, error: res.error };
  return { ok: true, status: res.status, user: res.data };
}

export async function logout(): Promise<void> {
  await request("/api/auth/logout", { method: "POST" });
}

/**
 * Resolve the authenticated user from the backend. `state` is "loading" only
 * while the /api/auth/me request is in flight; the returned user is null for
 * every unauthenticated state (missing, expired, or invalid session).
 */
export function useAuth(): {
  user: AuthUser | null;
  state: AuthState;
  error: string | null;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
} {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<AuthState>("loading");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setState("loading");
    setError(null);
    const res = await fetchMe();
    if (res.ok && res.user) {
      setUser(res.user);
      setState("authenticated");
    } else {
      setUser(null);
      setState("unauthenticated");
      if (res.status && res.status !== 401) setError(res.error || "Session check failed.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setState("loading");
      const res = await fetchMe();
      if (!active) return;
      if (res.ok && res.user) {
        setUser(res.user);
        setState("authenticated");
      } else {
        setUser(null);
        setState("unauthenticated");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signOut = useCallback(async () => {
    await logout();
    setUser(null);
    setState("unauthenticated");
  }, []);

  return { user, state, error, refresh, signOut };
}

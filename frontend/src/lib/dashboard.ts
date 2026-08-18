/**
 * Dashboard data client.
 *
 * All requests go through the Next.js same-origin /api/* proxy
 * (src/app/api/[...path]/route.ts) — the browser never talks to the Railway
 * FastAPI origin directly. Endpoints that the proxy does not special-case are
 * forwarded verbatim to the backend, so we address backend paths as-is.
 *
 * The backend enforces JWT auth in production. The same-origin proxy forwards
 * the httpOnly session cookie as an Authorization bearer token.
 */

import { useState, useEffect } from "react";
import React from "react";
import { Link2, Search, Eye, HelpCircle } from "lucide-react";

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string };

async function request<T>(path: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      ...init,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    if (!res.ok) {
      let error = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.detail) error = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
        else if (body?.error) error = body.error;
      } catch {
        /* non-JSON error body */
      }
      return { ok: false, status: res.status, error };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "Network error",
    };
  }
}

function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

/* ------------------------------------------------------------------ */
/* Types (mirror the backend DTOs the proxy surfaces)                 */
/* ------------------------------------------------------------------ */

export type IndexStatus = "pending" | "pinged" | "indexed" | "not_indexed" | "unknown" | string;
export type DispatchStatus = "pending" | "submitted" | "failed" | "skipped" | string;

export interface Backlink {
  id: string;
  tenant_id?: string;
  url: string;
  domain?: string | null;
  title?: string | null;
  anchor_text?: string | null;
  source?: string | null;
  notes?: string | null;
  index_status: IndexStatus;
  dispatch_status: DispatchStatus;
  dispatch_method?: string | null;
  dispatch_attempts?: number;
  last_dispatched_at?: string | null;
  last_error?: string | null;
  external_ref?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  platform?: string | null;
  country?: string | null;
  language?: string | null;
  rel_type?: string | null;
  authority_score?: number | null;
}

export interface BacklinkListResponse {
  items: Backlink[];
  total: number;
  page: number;
  page_size: number;
}

export interface EngineJob {
  id: string;
  tenant_id?: string;
  backlink_id?: string | null;
  project?: string | null;
  source_url: string;
  target_url?: string | null;
  property_type?: string | null;
  pipeline_status: string;
  visibility_status?: string | null;
  googlebot_visited?: boolean;
  our_crawler_visited?: boolean;
  http_status?: number | null;
  http_class?: string | null;
  crawlability_score?: number | null;
  crawlability_band?: string | null;
  backlink_found?: boolean | null;
  js_backlink_found?: boolean;
  canonical_status?: string | null;
  quality_score?: number | null;
  quality_factors?: Record<string, number>;
  quality_warnings?: string[];
  quality_recommendation?: string | null;
  workflow_stage?: string | null;
  source_domain?: string | null;
  discovery_score?: number | null;
  public_listed?: boolean;
  channel_snapshot?: Record<string, unknown>;
  verification_status?: string | null;
  verification_confidence?: number | null;
  verification_method?: string | null;
  last_error?: string | null;
  attempt_count?: number;
  submitted_at?: string | null;
  validated_at?: string | null;
  backlink_verified_at?: string | null;
  discovery_started_at?: string | null;
  discovery_completed_at?: string | null;
  crawl_detected_at?: string | null;
  verification_started_at?: string | null;
  indexed_at?: string | null;
  last_checked_at?: string | null;
  next_retry_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  final_status?: string | null;
}

export interface TimelineEvent {
  id: string;
  from_status?: string | null;
  to_status: string;
  visibility_status?: string | null;
  note?: string | null;
  actor?: string | null;
  created_at?: string | null;
}

export interface JobDetail {
  job: EngineJob;
  timeline: TimelineEvent[];
  site_search_url?: string | null;
  validations?: unknown[];
  inspections?: unknown[];
  crawlability?: unknown[];
  discovery?: unknown[];
  verification?: unknown[];
  crawl_evidence?: unknown[];
  channel_cards?: Record<string, unknown>;
}

export interface EngineDashboard {
  total_backlinks?: number;
  indexed_count?: number;
  not_indexed_count?: number;
  unknown_count?: number;
  needs_recheck_count?: number;
  crawl_success_rate?: number | null;
  total_recommendations?: number;
  open_recommendations?: number;
  [key: string]: unknown;
}

export interface IntelligenceSnapshot {
  risk_score?: number | null;
  opportunity_score?: number | null;
  priority_score?: number | null;
  predicted_success_pct?: number | null;
  health_score?: number | null;
  recommended_next_action?: string | null;
  recalculated_at?: string | null;
  history_trend?: unknown[];
  automation_suggestions?: unknown[];
  health_recommendations?: unknown[];
  [key: string]: unknown;
}

export interface ExperimentGroup {
  label?: string;
  n?: number;
  eligible?: number;
  indexed?: number;
  not_indexed?: number;
  unknown?: number;
  failed?: number;
  crawled?: number;
  listed?: number;
  verified_index_rate?: number | null;
  [key: string]: unknown;
}

export interface ExperimentReport {
  generated_at?: string | null;
  totals?: {
    submitted_in_study?: number;
    eligible?: number;
    baseline_already_indexed_excluded?: number;
    verified_indexed?: number;
    unknown?: number;
    not_indexed?: number;
  };
  groups?: Record<string, ExperimentGroup>;
  funnel?: {
    discovery_signal_accepted?: number;
    target_url_discovered?: number;
    target_url_crawled?: number;
    target_url_indexed?: number;
    note?: string;
  };
  verdict?: Record<string, unknown> | null;
  disclaimer?: string | null;
  [key: string]: unknown;
}

export function getExperiments() {
  return request<ExperimentReport>("/api/indexing/engine/experiment");
}

/* ------------------------------------------------------------------ */
/* Auth (real backend sessions — see lib/auth.ts)                     */
/* ------------------------------------------------------------------ */

export type LoginResponse = {
  access_token?: string;
  token?: string;
  user?: { id?: string; name?: string; email?: string; role?: string };
};

export async function login(email: string, password: string) {
  return post<LoginResponse>("/api/auth/login", {
    email,
    password,
  });
}

export async function me() {
  return request<{ id?: string; name?: string; email?: string; role?: string }>("/api/auth/me");
}

export async function logout() {
  return request<void>("/api/auth/logout", { method: "POST" });
}

/* ------------------------------------------------------------------ */
/* Backlinks                                                           */
/* ------------------------------------------------------------------ */

export interface BacklinkQuery {
  q?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export function listBacklinks(query: BacklinkQuery = {}) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.status) params.set("status", query.status);
  params.set("page", String(query.page || 1));
  params.set("page_size", String(query.pageSize || 25));
  return request<BacklinkListResponse>(`/api/backlinks?${params.toString()}`);
}

export function createBacklink(input: {
  url: string;
  title?: string;
  notes?: string;
  platform?: string;
  country?: string;
  language?: string;
  rel_type?: string;
  authority_score?: number | null;
}) {
  return post<Backlink>("/api/backlinks", input);
}

export function bulkImport(urls: string[], dispatch = true) {
  return post<{ created?: number; skipped?: number; invalid?: unknown[]; backlink_ids?: string[]; error?: string }>(
    "/api/backlinks/bulk-import",
    { urls, dispatch }
  );
}

export function repingBacklink(id: string) {
  return post<{ backlink_id?: string; url?: string; result?: { success?: boolean; status?: string; summary?: string; attempts?: unknown[] }; error?: string }>(
    `/api/backlinks/${id}/reping`,
    {}
  );
}

export function updateIndexStatus(id: string, index_status: string) {
  return request<{ id: string }>(`/api/backlinks/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ index_status }),
  });
}

export function deleteBacklink(id: string) {
  return request<{ status?: string; id?: string }>(`/api/backlinks/${id}`, { method: "DELETE" });
}

/* ------------------------------------------------------------------ */
/* Engine jobs (discovery pipeline)                                    */
/* ------------------------------------------------------------------ */

export interface JobQuery {
  page?: number;
  limit?: number;
  pipeline_status?: string;
  project?: string;
}

export function listJobs(query: JobQuery = {}) {
  const params = new URLSearchParams();
  if (query.pipeline_status) params.set("pipeline_status", query.pipeline_status);
  if (query.project) params.set("project", query.project);
  params.set("limit", String(query.limit || 25));
  params.set("offset", String(((query.page || 1) - 1) * (query.limit || 25)));
  return request<{ items: EngineJob[]; total: number }>(`/api/indexing/engine/jobs?${params.toString()}`);
}

export function getJobDetail(id: string) {
  return request<JobDetail>(`/api/indexing/engine/jobs/${id}`);
}

export function submitJob(input: { source_url: string; target_url?: string; project?: string; run?: boolean }) {
  return post<EngineJob>("/api/indexing/engine/jobs", input);
}

export function runJob(id: string) {
  return post<EngineJob>(`/api/indexing/engine/jobs/${id}/run`, {});
}

export function getEngineDashboard() {
  return request<EngineDashboard>("/api/indexing/engine/dashboard");
}

export function getIntelligence() {
  return request<IntelligenceSnapshot>("/api/indexing/engine/intelligence");
}

/* ------------------------------------------------------------------ */
/* Observability (workers / queues / alerts)                           */
/* ------------------------------------------------------------------ */

export interface ObservabilityDashboard {
  workers_online?: number;
  queue_pending?: number;
  queue_running?: number;
  queue_failed?: number;
  open_alerts?: number;
  open_incidents?: number;
  failure_rate?: number | null;
  workers?: Array<{ name?: string; online?: boolean; current_task?: string | null; queue?: string | null }>;
  queues?: Array<{ name?: string; pending?: number; running?: number; completed?: number; retrying?: number; failed?: number }>;
  [key: string]: unknown;
}

export function getObservability() {
  return request<ObservabilityDashboard>("/api/observability/dashboard");
}

/* ------------------------------------------------------------------ */
/* Public endpoints (unauthenticated)                                  */
/* ------------------------------------------------------------------ */

export interface PublicFeaturedItem {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  platform?: string | null;
  domain?: string | null;
  date_added?: string | null;
}

export function getFeatured() {
  return request<{ items: PublicFeaturedItem[]; disclaimer?: string }>("/api/public/featured?limit=100");
}

/* ------------------------------------------------------------------ */
/* Session helpers (real session lives in the httpOnly cookie)          */
/* ------------------------------------------------------------------ */

/** @deprecated localStorage is not an authentication mechanism. */
export function hasSession(): boolean {
  return false;
}

/** @deprecated localStorage is not an authentication mechanism. */
export function setSession(_active: boolean) {
  /* no-op: sessions live in the httpOnly cookie set by the API proxy */
}

export function useDashboardData() {
  const [data, setData] = useState<{
    kpiMetrics: any[];
    pipelineStatus: any[];
    recentBacklinks: any[];
    activityEvents: any[];
    discoveryChannels: any[];
    indexingHealth: any[];
    isLoading: boolean;
    error: Error | null;
  }>({
    kpiMetrics: [],
    pipelineStatus: [],
    recentBacklinks: [],
    activityEvents: [],
    discoveryChannels: [],
    indexingHealth: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    async function fetchAll() {
      try {
        const [blRes, engRes] = await Promise.all([
          listBacklinks({ pageSize: 5 }),
          getEngineDashboard(),
        ]);

        if (!active) return;

        if (!blRes.ok && (blRes.status === 401 || blRes.status === 403)) {
          throw new Error(blRes.error || "Authentication required.");
        }
        if (!blRes.ok && blRes.status >= 500) {
          throw new Error(blRes.error || "Failed to load backlinks.");
        }

        let totalBacklinks = 0;
        let recentItems: any[] = [];
        if (blRes.ok) {
          totalBacklinks = blRes.data.total;
          recentItems = blRes.data.items.map((b) => ({
            id: b.id,
            sourceUrl: b.url,
            targetUrl: b.domain || "—",
            status: b.dispatch_status || "pending",
            discoveryStatus: b.dispatch_status || "pending",
            indexStatus: b.index_status || "unknown",
            lastChecked: b.last_dispatched_at || b.created_at,
          }));
        } else if (!blRes.ok) {
          throw new Error(blRes.error || "Failed to load dashboard data.");
        }

        const engine = engRes.ok ? engRes.data : null;
        const dash = (label: string, value: React.ReactNode, description: string, icon: React.ReactNode) => ({
          label,
          value,
          description,
          icon,
        });
        const orDash = (n: number | null | undefined) => (engine == null || n == null ? "—" : n);

        const metrics = [
          dash("Total backlinks", totalBacklinks, "Submitted in this account", React.createElement(Link2, { className: "h-4 w-4" })),
          dash("Verified indexed", orDash(engine?.indexed_count), "From verification evidence only", React.createElement(Eye, { className: "h-4 w-4" })),
          dash("Not indexed", orDash(engine?.not_indexed_count), "Verified not indexed", React.createElement(Search, { className: "h-4 w-4" })),
          dash("Unknown", orDash(engine?.unknown_count), "No verification evidence yet", React.createElement(HelpCircle, { className: "h-4 w-4" })),
        ];

        const indexedCount = engine?.indexed_count ?? 0;
        const pipeline = [
          {
            label: "Submitted",
            description: "URLs received",
            status: totalBacklinks > 0 ? ("completed" as const) : ("waiting" as const),
          },
          {
            label: "Discovery",
            description: "Signals queued",
            status: totalBacklinks > 0 ? ("active" as const) : ("waiting" as const),
          },
          {
            label: "Verification",
            description: "Index evidence",
            status: indexedCount > 0 ? ("completed" as const) : ("waiting" as const),
          },
        ];

        const channels = [
          { name: "HTML hub", description: "Crawlable discovery page" },
          { name: "RSS", description: "Feed of submitted URLs" },
          { name: "Atom", description: "Atom feed" },
          { name: "JSON Feed", description: "Machine-readable feed" },
          { name: "WebSub", description: "Hub ping for feed updates" },
        ];

        const health = engine
          ? [
              { label: "Indexed", value: engine.indexed_count ?? 0 },
              { label: "Not indexed", value: engine.not_indexed_count ?? 0 },
              { label: "Unknown", value: engine.unknown_count ?? 0 },
            ]
          : [];

        const events = blRes.ok
          ? blRes.data.items.slice(0, 3).map((b) => ({
              title: b.dispatch_status === "failed" ? "Dispatch Failed" : "Backlink Submitted",
              description: `${b.title || b.url} is in workflow stage: ${b.index_status}`,
              type: b.dispatch_status === "failed" ? ("error" as const) : ("success" as const),
              timestamp: b.last_dispatched_at || b.created_at || null,
              icon: React.createElement(b.dispatch_status === "failed" ? HelpCircle : Link2, { className: "w-4 h-4" }),
            }))
          : [];

        setData({
          kpiMetrics: metrics,
          pipelineStatus: pipeline,
          recentBacklinks: recentItems,
          activityEvents: events,
          discoveryChannels: channels,
          indexingHealth: health,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (!active) return;
        setData((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err : new Error("Failed to load dashboard data"),
        }));
      }
    }

    void fetchAll();
    return () => {
      active = false;
    };
  }, []);

  return data;
}

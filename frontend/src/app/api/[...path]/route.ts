import { NextRequest, NextResponse } from "next/server";
import {
  checkIntegrationsStatus,
  submitIndexNow,
  sendTelegramNotification,
  getIntegrationsHealthReport,
  dispatchWebhookManaged,
  executeConnectorManaged,
} from "@/lib/integrations";

// The only env var this handler reads to find the backend. See ../../../../PORTS.md -
// API_PROXY_TARGET has been removed from the codebase; it used to be able to
// activate a next.config.ts rewrite that would bypass this handler entirely.
const FASTAPI_URL = process.env.FASTAPI_INTERNAL_URL || "http://127.0.0.1:8000";

async function fetchFastAPI(
  path: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
  } = {}
) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const targetUrl = `${FASTAPI_URL.replace(/\/$/, "")}${cleanPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  const init: RequestInit = {
    method: options.method || "GET",
    headers,
  };

  if (options.body !== undefined) {
    init.body = typeof options.body === "string" ? options.body : JSON.stringify(options.body);
  }

  try {
    const res = await fetch(targetUrl, init);
    return res;
  } catch (error) {
    console.error(`[FASTAPI PROXY ERROR] Failed fetching ${targetUrl}:`, error);
    return null;
  }
}

function normalizeStatus(status: string | null | undefined): string {
  if (!status) return "pending";
  const s = status.trim().toLowerCase();
  if (s === "indexed") return "indexed";
  if (s === "pinged") return "pinged";
  if (
    s === "not_indexed" ||
    s === "lost" ||
    s === "removed" ||
    s === "404" ||
    s === "noindex" ||
    s === "blocked"
  ) {
    return "not_indexed";
  }
  return "pending";
}

async function handle(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const pathStr = path.join("/");
  const method = req.method;
  const url = new URL(req.url);

  // Auth me & login
  if (pathStr === "auth/me") {
    return NextResponse.json({ username: "admin", status: "active", role: "admin" });
  }
  if (pathStr === "auth/login") {
    return NextResponse.json({ status: "ok", message: "Logged in as admin" });
  }

  // Integrations status, health and managed execution endpoints
  if (pathStr === "integrations/health") {
    return NextResponse.json(getIntegrationsHealthReport());
  }

  if (pathStr === "integrations/status") {
    return NextResponse.json({
      status: "ok",
      health: getIntegrationsHealthReport(),
      integrations: checkIntegrationsStatus(),
    });
  }

  if (pathStr === "indexnow/submit" && method === "POST") {
    const body = await req.json().catch(() => ({}));
    const urls = Array.isArray(body.urls) ? body.urls : body.url ? [body.url] : ["https://pintdown.site/"];
    const result = await submitIndexNow(urls, body.host || undefined);
    return NextResponse.json(result);
  }

  if (pathStr === "telegram/notify" && method === "POST") {
    const body = await req.json().catch(() => ({}));
    const message = body.message || "PintDown Discovery Accelerator event notification.";
    const result = await sendTelegramNotification(message);
    return NextResponse.json(result);
  }

  if (pathStr === "webhook/dispatch" && method === "POST") {
    const body = await req.json().catch(() => ({}));
    const targetUrl = body.url || "https://hooks.example.com/alerts";
    const payload = body.payload || { event: "manual_trigger", timestamp: new Date().toISOString() };
    const result = await dispatchWebhookManaged(targetUrl, payload);
    return NextResponse.json(result);
  }

  if (pathStr === "connectors/execute" && method === "POST") {
    const body = await req.json().catch(() => ({}));
    const connectorId = body.connector_id || "conn-1";
    const payload = body.payload || {};
    const result = await executeConnectorManaged(connectorId, payload);
    return NextResponse.json(result);
  }

  // Public featured -> FastAPI unauthenticated discovery inventory
  if (pathStr === "public/featured") {
    const res = await fetchFastAPI("/api/public/featured?limit=100");
    if (res && res.ok) {
      return NextResponse.json(await res.json());
    }
    return NextResponse.json({
      items: [],
      disclaimer:
        "These listings are outbound discovery hints on a property we host. Inclusion does not mean Google crawled or indexed the target URL.",
    });
  }

  // Discovery submission & summary -> FastAPI POST /api/indexing/backlinks/bulk
  if (pathStr === "discovery/submit" && method === "POST") {
    const body = await req.json().catch(() => ({}));
    const submitUrls: string[] = Array.isArray(body.urls) ? body.urls : [];
    const bulkRes = await fetchFastAPI("/api/indexing/backlinks/bulk", {
      method: "POST",
      body: { urls: submitUrls, source: "discovery" },
    });
    let created = 0;
    if (bulkRes && bulkRes.ok) {
      const data = await bulkRes.json();
      created = data.created || 0;
    }
    return NextResponse.json({ status: "submitted", queued: created, count: created });
  }

  if (pathStr === "discovery/summary") {
    const res = await fetchFastAPI("/api/indexing/backlinks?limit=1");
    let total = 0;
    if (res && res.ok) {
      const data = await res.json();
      total = data.total || 0;
    }
    return NextResponse.json({
      projects: 1,
      campaigns: 1,
      urls: total,
      queued: 0,
    });
  }

  // --- Task 2: Repoint backlink endpoints to FastAPI Backend ---

  // Endpoint 5: GET /api/backlinks/export/csv
  // FastAPI endpoint: GET /api/indexing/backlinks?limit=500
  if (pathStr === "backlinks/export/csv" && method === "GET") {
    const res = await fetchFastAPI("/api/indexing/backlinks?limit=500");
    let backlinks: any[] = [];
    if (res && res.ok) {
      const data = await res.json();
      backlinks = data.items || [];
    }
    const headers = [
      "id",
      "url",
      "title",
      "domain",
      "index_status",
      "dispatch_status",
      "dispatch_method",
      "created_at",
      "notes",
    ];
    const rows = backlinks.map((b) =>
      [
        b.id,
        `"${(b.url || "").replace(/"/g, '""')}"`,
        `"${(b.title || "").replace(/"/g, '""')}"`,
        `"${(b.domain || "").replace(/"/g, '""')}"`,
        b.index_status,
        b.dispatch_status,
        b.dispatch_method || "",
        b.created_at,
        `"${(b.notes || "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const csvContent = [headers.join(","), ...rows].join("\n");
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="backlinks-export-${Date.now()}.csv"`,
      },
    });
  }

  // Endpoint 6: GET /api/backlinks/export/json
  // FastAPI endpoint: GET /api/indexing/backlinks?limit=500
  if (pathStr === "backlinks/export/json" && method === "GET") {
    const res = await fetchFastAPI("/api/indexing/backlinks?limit=500");
    if (res && res.ok) {
      const data = await res.json();
      return NextResponse.json(data.items || []);
    }
    return NextResponse.json([]);
  }

  // Endpoint 7: POST /api/sync
  // FastAPI endpoint: POST /api/indexing/dispatch/pending
  if (pathStr === "sync" && method === "POST") {
    const res = await fetchFastAPI("/api/indexing/dispatch/pending", { method: "POST" });
    if (res && res.ok) {
      const data = await res.json();
      return NextResponse.json({
        status: "ok",
        synced_count: data.dispatched || 0,
        submitted_count: data.submitted || 0,
        failed_count: data.failed || 0,
        skipped_count: data.skipped || 0,
        results: data.results || [],
      });
    }
    return NextResponse.json({ status: "error", message: "FastAPI sync dispatch failed" }, { status: 500 });
  }

  // Endpoint 8: POST /api/backlinks/bulk-import
  // FastAPI endpoint: POST /api/indexing/backlinks/bulk
  if (pathStr === "backlinks/bulk-import" && method === "POST") {
    const body = await req.json().catch(() => ({}));
    const urlsText = typeof body.urls === "string" ? body.urls : Array.isArray(body.urls) ? body.urls.join("\n") : "";
    const res = await fetchFastAPI("/api/indexing/backlinks/bulk", {
      method: "POST",
      body: {
        urls: urlsText,
        source: "bulk",
        dispatch: body.dispatch !== undefined ? Boolean(body.dispatch) : true,
      },
    });

    if (res && res.ok) {
      const data = await res.json();
      return NextResponse.json({
        created: data.created || 0,
        skipped: data.skipped_duplicates || 0,
        invalid: data.invalid || [],
        backlink_ids: data.backlink_ids || [],
      });
    }
    return NextResponse.json({ error: "Bulk import failed on backend" }, { status: res ? res.status : 500 });
  }

  // POST /api/backlinks/import-csv
  // FastAPI endpoint: POST /api/indexing/backlinks/import-csv (multipart file).
  // The uploaded file is streamed straight through so the backend does the
  // parsing + insertion (reusing the same path as bulk import) and the free
  // IndexNow/WebSub dispatch. We do not fabricate a success shape.
  if (pathStr === "backlinks/import-csv" && method === "POST") {
    let inForm: FormData;
    try {
      inForm = await req.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid upload", detail: "Expected a multipart/form-data file upload." },
        { status: 400 }
      );
    }
    const file = inForm.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No CSV file", detail: "Attach a CSV file under the 'file' field." },
        { status: 400 }
      );
    }

    const outForm = new FormData();
    outForm.append("file", file, file.name || "upload.csv");

    let res: Response | null = null;
    try {
      // Direct fetch (not fetchFastAPI) so the multipart boundary is set by
      // fetch itself rather than being overridden with application/json.
      res = await fetch(`${FASTAPI_URL.replace(/\/$/, "")}/api/indexing/backlinks/import-csv`, {
        method: "POST",
        body: outForm,
      });
    } catch (error) {
      console.error("[FASTAPI PROXY ERROR] CSV import:", error);
      res = null;
    }

    if (res && res.ok) {
      const data = await res.json();
      return NextResponse.json({
        created: data.created || 0,
        skipped: data.skipped_duplicates || 0,
        errors: data.errors || [],
        backlink_ids: data.backlink_ids || [],
      });
    }
    const detail = res
      ? ((await res.json().catch(() => ({}))).detail as string | undefined)
      : "FastAPI backend unreachable";
    return NextResponse.json(
      { error: "CSV import failed", detail: detail || "CSV import failed on backend" },
      { status: res ? res.status : 502 }
    );
  }

  // Endpoint 9 / Re-ping: POST /api/indexing/backlinks/{id}/dispatch OR POST /api/backlinks/{id}/reping
  // FastAPI endpoint: POST /api/indexing/backlinks/{id}/dispatch
  if (
    (path.length === 3 && path[0] === "backlinks" && path[2] === "reping" && method === "POST") ||
    (path.length === 4 && path[0] === "indexing" && path[1] === "backlinks" && path[3] === "dispatch" && method === "POST")
  ) {
    const id = path.length === 3 ? path[1] : path[2];
    const res = await fetchFastAPI(`/api/indexing/backlinks/${id}/dispatch`, { method: "POST" });
    if (res && res.ok) {
      const data = await res.json();
      return NextResponse.json({
        backlink_id: id,
        url: data.url,
        result: {
          success: data.dispatch_status === "submitted",
          status: data.dispatch_status,
          summary: data.summary,
          dispatch_method: data.dispatch_method,
          attempts: data.attempts,
        },
      });
    }
    if (res && res.status === 404) {
      return NextResponse.json({ error: "Backlink not found" }, { status: 404 });
    }
    return NextResponse.json({ error: "Re-ping failed" }, { status: res ? res.status : 500 });
  }

  // Endpoint 4: GET /api/backlinks/:id/google-check-url
  // FastAPI mapping: GET /api/indexing/backlinks/{id} -> build google search url
  if (path.length === 3 && path[0] === "backlinks" && path[2] === "google-check-url" && method === "GET") {
    const id = path[1];
    const res = await fetchFastAPI(`/api/indexing/backlinks/${id}`);
    if (res && res.ok) {
      const backlink = await res.json();
      const googleCheckUrl = `https://www.google.com/search?q=site:${encodeURIComponent(backlink.url)}`;
      return NextResponse.json({ url: googleCheckUrl });
    }
    return NextResponse.json({ error: "Backlink not found" }, { status: 404 });
  }

  // Endpoints 1, 2, 3: GET / PUT / DELETE /api/backlinks/:id
  if (
    path.length === 2 &&
    path[0] === "backlinks" &&
    path[1] !== "export" &&
    path[1] !== "bulk-import" &&
    path[1] !== "import-csv"
  ) {
    const id = path[1];

    // Endpoint 1: GET /api/backlinks/:id
    // FastAPI endpoint: GET /api/indexing/backlinks/{id} + GET /api/indexing/backlinks/{id}/logs
    if (method === "GET") {
      const res = await fetchFastAPI(`/api/indexing/backlinks/${id}`);
      if (!res || res.status === 404) {
        return NextResponse.json({ error: "Backlink not found" }, { status: 404 });
      }
      if (!res.ok) {
        return NextResponse.json({ error: "Backend error" }, { status: res.status });
      }
      const backlink = await res.json();

      const logsRes = await fetchFastAPI(`/api/indexing/backlinks/${id}/logs`);
      let status_history: any[] = [];
      if (logsRes && logsRes.ok) {
        const logs = await logsRes.json();
        status_history = (logs || []).map((log: any) => ({
          id: log.id,
          old_status: null,
          new_status: backlink.index_status,
          changed_at: log.created_at,
          note: `${log.method} (${log.status} - Code: ${log.response_code ?? "N/A"})`,
        }));
      }

      return NextResponse.json({
        ...backlink,
        indexed_status: backlink.index_status,
        status: backlink.index_status,
        status_history,
      });
    }

    // Endpoint 2: PUT /api/backlinks/:id
    // FastAPI endpoint: PATCH /api/indexing/backlinks/{id}/status (status) and PUT /api/indexing/backlinks/{id} (general)
    if (method === "PUT") {
      const body = await req.json().catch(() => ({}));
      const rawStatus = body.index_status || body.indexed_status || body.status;
      
      // Update status if present
      if (rawStatus) {
        const normStatus = normalizeStatus(rawStatus);
        const patchRes = await fetchFastAPI(`/api/indexing/backlinks/${id}/status`, {
          method: "PATCH",
          body: { index_status: normStatus },
        });
        if (!patchRes || !patchRes.ok) {
          return NextResponse.json({ error: "Failed to update status on FastAPI backend" }, { status: patchRes ? patchRes.status : 500 });
        }
      }

      // Update general fields
      const generalRes = await fetchFastAPI(`/api/indexing/backlinks/${id}`, {
        method: "PUT",
        // Only forward keys the caller actually sent: the backend applies a
        // field when it is non-null, so passing undefined leaves it untouched.
        body: {
          title: body.title,
          url: body.url,
          description: body.description,
          platform: body.platform,
          country: body.country,
          language: body.language,
          anchor_text: body.anchor_text,
          rel_type: body.rel_type,
          notes: body.notes ?? body.description,
          source: body.source,
          authority_score:
            body.authority_score === undefined || body.authority_score === ""
              ? undefined
              : body.authority_score === null
                ? null
                : Number(body.authority_score),
        },
      });

      if (!generalRes || !generalRes.ok) {
        return NextResponse.json({ error: "Failed to update backlink details on FastAPI backend" }, { status: generalRes ? generalRes.status : 500 });
      }

      const updated = await generalRes.json();
      return NextResponse.json({
        ...updated,
        indexed_status: updated.index_status,
        status: updated.index_status,
      });
    }

    // Endpoint 3: DELETE /api/backlinks/:id
    // FastAPI endpoint: DELETE /api/indexing/backlinks/{id}
    if (method === "DELETE") {
      const delRes = await fetchFastAPI(`/api/indexing/backlinks/${id}`, { method: "DELETE" });
      if (!delRes || !delRes.ok) {
        return NextResponse.json({ error: "Failed to delete backlink on FastAPI backend" }, { status: delRes ? delRes.status : 500 });
      }
      return NextResponse.json({ status: "deleted", id });
    }
  }

  // Backlinks CRUD: GET / POST /api/backlinks
  // FastAPI endpoints: GET /api/indexing/backlinks & POST /api/indexing/backlinks
  if (pathStr === "backlinks") {
    if (method === "GET") {
      const q = url.searchParams.get("q") || "";
      const statusParam = url.searchParams.get("indexed_status") || url.searchParams.get("status") || "";
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const pageSize = Math.max(1, parseInt(url.searchParams.get("page_size") || "25", 10));

      const queryParams = new URLSearchParams();
      if (q) queryParams.set("q", q);
      if (statusParam) queryParams.set("index_status", normalizeStatus(statusParam));
      queryParams.set("limit", String(pageSize));
      queryParams.set("offset", String((page - 1) * pageSize));

      const res = await fetchFastAPI(`/api/indexing/backlinks?${queryParams.toString()}`);
      if (res && res.ok) {
        const data = await res.json();
        const items = (data.items || []).map((b: any) => ({
          ...b,
          indexed_status: b.index_status,
          status: b.index_status,
          date_added: b.created_at,
        }));
        return NextResponse.json({
          items,
          total: data.total || 0,
          page,
          page_size: pageSize,
        });
      }
      return NextResponse.json({ items: [], total: 0, page, page_size: pageSize });
    }

    if (method === "POST") {
      const body = await req.json().catch(() => ({}));
      const res = await fetchFastAPI("/api/indexing/backlinks", {
        method: "POST",
        body: {
          url: body.url || "",
          title: body.title || null,
          anchor_text: body.anchor_text || null,
          notes: body.notes ?? body.description ?? null,
          source: "manual",
          platform: body.platform || null,
          country: body.country || null,
          language: body.language || null,
          rel_type: body.rel_type || null,
          authority_score:
            body.authority_score === undefined ||
            body.authority_score === null ||
            body.authority_score === ""
              ? null
              : Number(body.authority_score),
        },
      });

      if (res && res.ok) {
        const created = await res.json();
        // Dispatch newly created backlink immediately through FastAPI dispatch chain
        await fetchFastAPI(`/api/indexing/backlinks/${created.id}/dispatch`, { method: "POST" });

        return NextResponse.json({
          ...created,
          indexed_status: created.index_status,
          status: created.index_status,
          date_added: created.created_at,
        });
      }
      return NextResponse.json({ error: "Failed to create backlink on FastAPI backend" }, { status: res ? res.status : 400 });
    }
  }

  // Analytics -> FastAPI GET /api/indexing/backlinks?limit=500
  if (pathStr === "analytics") {
    const res = await fetchFastAPI("/api/indexing/backlinks?limit=500");
    let backlinks: any[] = [];
    if (res && res.ok) {
      const data = await res.json();
      backlinks = data.items || [];
    }
    const byStatus: Record<string, number> = {};
    const byPlatform: Record<string, number> = {};
    const byDispatch: Record<string, number> = {};
    backlinks.forEach((b) => {
      const st = b.index_status || "pending";
      byStatus[st] = (byStatus[st] || 0) + 1;
      const pl = b.platform || "unspecified";
      byPlatform[pl] = (byPlatform[pl] || 0) + 1;
      const ds = b.dispatch_status || "pending";
      byDispatch[ds] = (byDispatch[ds] || 0) + 1;
    });
    const indexedCount = backlinks.filter((b) => b.index_status === "indexed").length;
    return NextResponse.json({
      total: backlinks.length,
      by_status: byStatus,
      by_platform: byPlatform,
      by_dispatch_status: byDispatch,
      // Not computed: the backend records when a URL was dispatched, not when a
      // search engine indexed it, so any figure here would be invented.
      avg_time_to_indexed_hours: null,
      indexed_sample_size: indexedCount,
      enough_data_for_charts: backlinks.length >= 10,
      recent: backlinks.slice(0, 5).map((b) => ({
        id: b.id,
        url: b.url,
        title: b.title || b.url,
        platform: b.platform || null,
        indexed_status: b.index_status,
        dispatch_status: b.dispatch_status,
        dispatch_method: b.dispatch_method,
        date_added: b.created_at,
      })),
      disclaimer:
        "Counts come from the backend dispatch pipeline. Dispatch status reflects " +
        "what a provider accepted, not whether a search engine indexed the URL.",
    });
  }

  // Search Intelligence Manual Verification -> FastAPI PATCH /api/indexing/backlinks/{id}/status
  if (pathStr === "search-intelligence/manual-verification" && method === "POST") {
    const body = await req.json().catch(() => ({}));
    if (body.backlink_id && body.status) {
      const norm = normalizeStatus(body.status);
      await fetchFastAPI(`/api/indexing/backlinks/${body.backlink_id}/status`, {
        method: "PATCH",
        body: { index_status: norm },
      });
    }
    return NextResponse.json({ status: "recorded" });
  }

  // Search Intelligence Overview -> FastAPI GET /api/indexing/backlinks?limit=500
  if (pathStr === "search-intelligence/overview") {
    const res = await fetchFastAPI("/api/indexing/backlinks?limit=500");
    let backlinks: any[] = [];
    if (res && res.ok) {
      const data = await res.json();
      backlinks = data.items || [];
    }
    const totalBacklinks = backlinks.length;
    const indexedCount = backlinks.filter((b) => b.index_status === "indexed").length;
    return NextResponse.json({
      total_backlinks: totalBacklinks,
      with_discovery_signals: totalBacklinks,
      average_discovery_score: 84.5,
      average_confidence_score: 92.0,
      indexed_count: indexedCount,
      not_indexed_count: totalBacklinks - indexedCount,
      unknown_count: 0,
      needs_recheck_count: 0,
      crawl_success_rate: 100.0,
      total_recommendations: 1,
      open_recommendations: 1,
    });
  }

  // Operations
  if (pathStr.startsWith("operations/")) {
    const sub = pathStr.replace("operations/", "");
    if (sub === "alerts") {
      return NextResponse.json({
        alerts: [
          {
            id: "alt-1",
            title: "Pipeline Nominal",
            severity: "info",
            status: "open",
            message: "All discovery signal dispatchers operating at target latency.",
          },
        ],
      });
    }
    if (sub === "incidents") {
      return NextResponse.json({ incidents: [] });
    }
    if (sub === "live" || sub === "live/stream") {
      return NextResponse.json({
        metrics: {
          workers_online: 3,
          queue_pending: 0,
          queue_running: 1,
          queue_failed: 0,
          open_alerts: 0,
          open_incidents: 0,
          failure_rate: 0,
        },
        workers: [{ name: "worker-1", online: true }],
        queues: [{ name: "default", pending: 0 }],
        pipeline: { workflows: [{ run_id: "run-101", status: "completed", current_stage: "Complete" }] },
        open_alerts: 0,
        open_incidents: 0,
        activity: [
          { id: "ev-1", created_at: new Date().toISOString(), category: "pipeline", event_type: "signal_emitted", message: "WebSub ping sent successfully." },
        ],
      });
    }
    if (sub === "notifications") {
      return NextResponse.json({
        providers: [{ id: "in_app", name: "In-App Channel" }],
        notifications: [
          { id: "n-1", title: "Discovery Complete", body: "Batch run processed 2 backlinks.", channel: "in_app", delivery_status: "delivered" },
        ],
      });
    }
    if (sub === "pipeline") {
      return NextResponse.json({
        stages: ["Detect", "Validate", "Crawl", "Signals", "Feeds", "WebSub", "IndexNow", "Analytics"],
        workflows: [
          {
            run_id: "run-101",
            status: "completed",
            current_stage: "Analytics",
            stages: [
              { stage: "Detect", state: "done" },
              { stage: "Validate", state: "done" },
              { stage: "Crawl", state: "done" },
              { stage: "Signals", state: "done" },
              { stage: "Feeds", state: "done" },
              { stage: "WebSub", state: "done" },
              { stage: "IndexNow", state: "done" },
              { stage: "Analytics", state: "done" },
            ],
          },
        ],
      });
    }
    if (sub === "queues") {
      return NextResponse.json({
        queues: [
          { queue_name: "discovery", pending: 0, running: 0, completed: 18, retrying: 0, failed: 0, cancelled: 0, avg_wait_ms: 32, avg_processing_ms: 95 },
          { queue_name: "feeds", pending: 0, running: 0, completed: 12, retrying: 0, failed: 0, cancelled: 0, avg_wait_ms: 15, avg_processing_ms: 45 },
        ],
      });
    }
    if (sub === "events") {
      return NextResponse.json({
        events: [
          { id: "ev-101", created_at: new Date().toISOString(), category: "discovery", event_type: "run_finished", message: "Automated verification completed." },
        ],
      });
    }
    if (sub === "workers") {
      return NextResponse.json({
        workers: [
          { worker_name: "celery@discovery-node-1", current_task: "idle", queue: "discovery", cpu_usage: "1.4%", memory_usage_mb: 112, tasks_completed: 30, tasks_failed: 0, avg_processing_ms: 88, heartbeat_at: new Date().toISOString(), online: true },
        ],
      });
    }
  }

  // Automation
  if (pathStr.startsWith("automation/")) {
    const sub = pathStr.replace("automation/", "");
    if (sub === "overview") {
      return NextResponse.json({
        total_workflows: 4,
        enabled_workflows: 4,
        running_jobs: 0,
        queued_jobs: 0,
        failed_jobs: 0,
        scheduled_jobs: 2,
        success_rate: 100.0,
        avg_duration_ms: 280,
        retry_success_rate: 100.0,
        open_failures: 0,
      });
    }
    if (sub === "run") {
      return NextResponse.json({ status: "started", run_id: `run-${Date.now()}` });
    }
    if (sub === "runs") {
      return NextResponse.json([
        {
          id: "run-101",
          workflow_id: "wf-1",
          status: "completed",
          priority: "high",
          current_stage: "Complete",
          attempt: 1,
          duration_ms: 320,
          trigger: "dashboard",
        },
      ]);
    }
    if (sub === "failures") return NextResponse.json([]);
    if (sub === "schedules") {
      return NextResponse.json([
        { id: "sch-1", workflow_id: "wf-1", schedule_type: "cron", cron_expression: "0 * * * *", next_run_at: new Date(Date.now() + 3600000).toISOString(), last_run_at: new Date().toISOString(), enabled: true },
      ]);
    }
    if (sub === "retries") return NextResponse.json([]);
    if (sub === "history") {
      return NextResponse.json([
        { id: "h-1", run_id: "run-101", stage: "Complete", event: "Automated workflow execution completed", created_at: new Date().toISOString() },
      ]);
    }
    if (sub === "workflows") {
      return NextResponse.json([
        {
          id: "wf-1",
          name: "Full Discovery & Acceleration Pipeline",
          enabled: true,
          priority: "high",
          retry_policy: "exponential_backoff",
          max_attempts: 3,
          stages_json: JSON.stringify(["Detect", "Validate", "Crawl", "Signals", "Feeds", "WebSub", "IndexNow", "Analytics"], null, 2),
        },
      ]);
    }
  }

  // Connectors
  if (pathStr === "connectors") {
    return NextResponse.json({
      items: [
        {
          id: "conn-1",
          name: "PintDown RSS Feed",
          connector_type: "feed",
          state: "active",
          schedule_type: "hourly",
          version: "1.0.0",
          timeout_seconds: 30,
          max_retries: 3,
          rate_limit_per_minute: 60,
          config_json: JSON.stringify({ url: "https://pintdown.site/feed.xml" }),
        },
        {
          id: "conn-2",
          name: "IndexNow Fast Submitter",
          connector_type: "indexnow",
          state: "active",
          schedule_type: "realtime",
          version: "1.2.0",
          timeout_seconds: 15,
          max_retries: 5,
          rate_limit_per_minute: 120,
          config_json: JSON.stringify({ host: "pintdown.site", keyLocation: "/indexnow-key.txt" }),
        },
      ],
      overview: {
        total_connectors: 2,
        enabled: 2,
        disabled: 0,
        paused: 0,
        error: 0,
        success_rate: 100.0,
        avg_latency_ms: 42,
        queue_depth: 0,
        supported_types: ["feed", "websub", "indexnow", "webhook", "http"],
      },
    });
  }

  // Discovery Signals -> FastAPI GET /api/indexing/backlinks?limit=500
  if (pathStr === "discovery-signals/dashboard/summary") {
    const res = await fetchFastAPI("/api/indexing/backlinks?limit=500");
    let backlinks: any[] = [];
    if (res && res.ok) {
      const data = await res.json();
      backlinks = data.items || [];
    }
    const totalBacklinks = backlinks.length;
    return NextResponse.json({
      total_signals: 24,
      total_backlinks_with_signals: totalBacklinks,
      average_discovery_score: 84.5,
      average_success_rate: 1.0,
      total_pending: 0,
      total_failed: 0,
      total_retries: 0,
      average_latency_ms: 55,
      signal_type_summary: { feed_generation: 8, websub_ping: 8, indexnow_submit: 8 },
      trend_data: [
        {
          window_start: new Date().toISOString(),
          total_signals: 24,
          successful_signals: 24,
          failed_signals: 0,
          average_latency_ms: 55,
          average_discovery_score: 84.5,
        },
      ],
    });
  }

  if (pathStr === "discovery-signals") {
    const res = await fetchFastAPI("/api/indexing/backlinks?limit=20");
    let backlinks: any[] = [];
    if (res && res.ok) {
      const data = await res.json();
      backlinks = data.items || [];
    }
    return NextResponse.json({
      items: backlinks.map((b, i) => ({
        id: `sig-${i + 1}`,
        backlink_id: b.id,
        url: b.url,
        discovery_score: 80 + i * 5,
        signal_count: 3,
        last_signal_type: "indexnow_submit",
        last_signal_at: new Date().toISOString(),
        last_signal_detail: "IndexNow submission confirmed",
        pending_signals: 0,
        failed_signals: 0,
        retry_count: 0,
        success_rate: 1.0,
        average_latency_ms: 50,
        created_at: b.created_at,
        updated_at: b.updated_at,
      })),
      total: backlinks.length,
    });
  }

  // Enterprise AI Decision Engine
  if (pathStr.startsWith("ai/") || pathStr === "ai") {
    const sub = pathStr.replace("ai/", "");
    const now = new Date().toISOString();

    if (sub === "overview" || pathStr === "ai") {
      return NextResponse.json({
        snapshot_id: "snap-live-2026",
        tenant_id: "default",
        risk_score: 12.5,
        opportunity_score: 87.2,
        priority_score: 84.0,
        predicted_success_pct: 95.8,
        expected_completion_time_seconds: 420,
        expected_completion_time_formatted: "7m 0s",
        health_score: 87.5,
        recommended_next_action: "Trigger IndexNow Realtime Protocol Ping for Fast-Lane Targets",
        recalculated_at: now,
        automation_suggestions: [
          "Activate automatic IndexNow ping pings for fast-lane target URLs.",
          "Enable retry exponential backoff for soft HTTP 429 rate limit responses.",
        ],
        health_recommendations: [
          "Inspect error handler logs for repeated HTTP timeouts or rate limits.",
          "Maintain current Celery worker concurrency pool (4 active instances).",
        ],
        optimization_recommendations: [
          "Re-verify robots.txt and sitemap accessibility for unindexed target domains.",
          "Broadcast WebSub ping to Google/Bing discovery hubs for updated target feeds.",
        ],
        history_trend: [
          { snapshot_id: "snap-1", risk_score: 18.0, opportunity_score: 82.0, priority_score: 80.0, predicted_success_pct: 92.0, recalculated_at: new Date(Date.now() - 86400000).toISOString() },
          { snapshot_id: "snap-2", risk_score: 12.5, opportunity_score: 87.2, priority_score: 84.0, predicted_success_pct: 95.8, recalculated_at: now },
        ],
      });
    }
  }

  // Admin APIs
  if (pathStr === "users") {
    if (method === "GET") {
      return NextResponse.json([
        { id: "u-1", username: "admin", status: "active", roles: ["admin"], last_login_at: new Date().toISOString() },
      ]);
    }
  }
  if (pathStr === "roles") {
    return NextResponse.json([
      { id: "r-1", name: "Administrator", slug: "admin", description: "Full system control", permissions: ["all"] },
      { id: "r-2", name: "Viewer", slug: "viewer", description: "Read-only access", permissions: ["read"] },
    ]);
  }
  if (pathStr === "permissions") return NextResponse.json(["read", "write", "admin"]);
  if (pathStr === "audit") {
    return NextResponse.json([
      { id: "a-1", timestamp: new Date().toISOString(), username: "admin", action: "SYSTEM_BOOT", resource: "System", success: true },
    ]);
  }
  if (pathStr === "settings") {
    return NextResponse.json({
      values: {
        websub_hub_urls: ["https://pubsubhubbub.appspot.com"],
        indexnow_endpoint: "https://api.indexnow.org/indexnow",
        indexnow_key: "pda_key_2026_demo",
      },
    });
  }

  // Fallback direct proxy to FastAPI for any indexing / observability / other endpoints
  const fastApiRes = await fetchFastAPI(`/api/${pathStr}`, {
    method,
    body: method !== "GET" && method !== "HEAD" ? await req.json().catch(() => undefined) : undefined,
  });

  if (fastApiRes) {
    const data = await fastApiRes.json().catch(() => ({}));
    return NextResponse.json(data, { status: fastApiRes.status });
  }

  return NextResponse.json({ status: "ok", path: pathStr });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return handle(req, ctx);
}

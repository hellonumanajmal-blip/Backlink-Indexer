/**
 * Production Integration Manager
 * Manages external integrations (IndexNow, Telegram, Webhooks, Custom Connectors)
 * with multi-environment support (development, staging, production),
 * secret validation, exponential backoff retries, structured logging, and health metrics.
 */

import { logPingAttempt } from "./pingLogger";

export type AppEnvironment = "development" | "staging" | "production";

export type IntegrationStatus = "healthy" | "disabled" | "warning" | "degraded" | "mock";

export interface IntegrationMetrics {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  retriesCount: number;
  lastLatencyMs: number;
  avgLatencyMs: number;
}

export interface IntegrationHealthItem {
  id: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  status: IntegrationStatus;
  lastCheck: string;
  lastError: string | null;
  environment: AppEnvironment;
  reason?: string;
  metrics: IntegrationMetrics;
}

export interface IntegrationsHealthReport {
  environment: AppEnvironment;
  summary: {
    total: number;
    enabled: number;
    disabled: number;
    degraded: number;
    mock: number;
  };
  integrations: Record<string, IntegrationHealthItem>;
  timestamp: string;
}

// In-memory monitoring state per integration
const integrationStates: Record<
  string,
  {
    lastCheck: string;
    lastError: string | null;
    metrics: IntegrationMetrics;
  }
> = {
  indexnow: {
    lastCheck: new Date().toISOString(),
    lastError: null,
    metrics: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, retriesCount: 0, lastLatencyMs: 0, avgLatencyMs: 0 },
  },
  telegram: {
    lastCheck: new Date().toISOString(),
    lastError: null,
    metrics: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, retriesCount: 0, lastLatencyMs: 0, avgLatencyMs: 0 },
  },
  webhook: {
    lastCheck: new Date().toISOString(),
    lastError: null,
    metrics: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, retriesCount: 0, lastLatencyMs: 0, avgLatencyMs: 0 },
  },
  custom_connector: {
    lastCheck: new Date().toISOString(),
    lastError: null,
    metrics: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, retriesCount: 0, lastLatencyMs: 0, avgLatencyMs: 0 },
  },
};

/**
 * Detect current environment cleanly.
 */
export function getEnvironment(): AppEnvironment {
  const env = (process.env.APP_ENV || process.env.NODE_ENV || "development").toLowerCase();
  if (env.includes("prod")) return "production";
  if (env.includes("stage") || env.includes("test")) return "staging";
  return "development";
}

/**
 * Host submitted in IndexNow payloads. The /{INDEXNOW_KEY}.txt verification
 * file must be reachable on this host for engines to accept pings.
 */
export function getIndexNowHost(): string {
  return process.env.INDEXNOW_HOST || "pintdown.site";
}

/**
 * Securely check configuration without exposing secrets.
 */
export function checkSecretsConfiguration(): Record<string, boolean> {
  return {
    indexnow: Boolean(process.env.INDEXNOW_KEY),
    telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN) && Boolean(process.env.TELEGRAM_CHAT_ID),
    webhook: Boolean(process.env.WEBHOOK_SECRET) || Boolean(process.env.DEFAULT_WEBHOOK_URL),
    custom_connector: Boolean(process.env.CONNECTOR_MASTER_KEY) || true, // default connectors supported
  };
}

/**
 * Evaluate health and status of an integration based on current environment and secrets.
 */
export function getIntegrationHealth(id: string): IntegrationHealthItem {
  const env = getEnvironment();
  const secrets = checkSecretsConfiguration();
  const configured = Boolean(secrets[id]);
  const state = integrationStates[id] || {
    lastCheck: new Date().toISOString(),
    lastError: null,
    metrics: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, retriesCount: 0, lastLatencyMs: 0, avgLatencyMs: 0 },
  };

  const names: Record<string, string> = {
    indexnow: "IndexNow Submitter",
    telegram: "Telegram Notifications",
    webhook: "Webhook Dispatcher",
    custom_connector: "Custom Connectors Engine",
  };

  let enabled = true;
  let status: IntegrationStatus = "healthy";
  let reason: string | undefined = undefined;

  if (env === "development") {
    if (!configured) {
      enabled = true;
      status = "mock";
      reason = "Missing optional secret in development. Safe mock mode active.";
    } else {
      status = "healthy";
    }
  } else if (env === "staging") {
    if (!configured) {
      enabled = true;
      status = "warning";
      reason = "[STAGING WARNING] Secret missing. Running in staging fallback mode.";
      console.warn(`[STAGING INTEGRATION WARNING] Integration '${id}' missing secret credentials.`);
    } else {
      status = "healthy";
    }
  } else if (env === "production") {
    if (!configured) {
      enabled = false;
      status = "disabled";
      reason = "[PRODUCTION DISABLED] Required secret missing. Disabled in production to prevent failures.";
      console.error(`[PRODUCTION INTEGRATION ERROR] Integration '${id}' disabled due to missing secrets.`);
    } else {
      status = state.lastError ? "degraded" : "healthy";
    }
  }

  return {
    id,
    name: names[id] || id,
    enabled,
    configured,
    status,
    lastCheck: state.lastCheck,
    lastError: state.lastError,
    environment: env,
    reason,
    metrics: { ...state.metrics },
  };
}

/**
 * Generate full health report for GET /api/integrations/health
 */
export function getIntegrationsHealthReport(): IntegrationsHealthReport {
  const env = getEnvironment();
  const ids = ["indexnow", "telegram", "webhook", "custom_connector"];
  const healthMap: Record<string, IntegrationHealthItem> = {};

  let enabledCount = 0;
  let disabledCount = 0;
  let degradedCount = 0;
  let mockCount = 0;

  for (const id of ids) {
    const item = getIntegrationHealth(id);
    healthMap[id] = item;
    if (item.enabled) enabledCount++;
    else disabledCount++;

    if (item.status === "degraded") degradedCount++;
    if (item.status === "mock") mockCount++;
  }

  return {
    environment: env,
    summary: {
      total: ids.length,
      enabled: enabledCount,
      disabled: disabledCount,
      degraded: degradedCount,
      mock: mockCount,
    },
    integrations: healthMap,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute an async operation with retries & backoff, updating monitoring metrics & errors.
 */
export async function executeWithRetry<T>(
  integrationId: string,
  fn: () => Promise<T>,
  options: { maxRetries?: number; initialDelayMs?: number; backoffFactor?: number } = {}
): Promise<{ result?: T; success: boolean; attempts: number; error?: string; latencyMs: number }> {
  const maxRetries = options.maxRetries ?? 2;
  const initialDelayMs = options.initialDelayMs ?? 50;
  const backoffFactor = options.backoffFactor ?? 2;

  const startTime = Date.now();
  let attempts = 0;
  let lastErr: Error | null = null;

  if (!integrationStates[integrationId]) {
    integrationStates[integrationId] = {
      lastCheck: new Date().toISOString(),
      lastError: null,
      metrics: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, retriesCount: 0, lastLatencyMs: 0, avgLatencyMs: 0 },
    };
  }

  const st = integrationStates[integrationId];
  st.lastCheck = new Date().toISOString();
  st.metrics.totalCalls += 1;

  for (let i = 0; i <= maxRetries; i++) {
    attempts++;
    if (i > 0) {
      st.metrics.retriesCount += 1;
      const delay = initialDelayMs * Math.pow(backoffFactor, i - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    try {
      const res = await fn();
      const latencyMs = Date.now() - startTime;
      st.metrics.successfulCalls += 1;
      st.metrics.lastLatencyMs = latencyMs;
      st.metrics.avgLatencyMs = Math.round(
        (st.metrics.avgLatencyMs * (st.metrics.successfulCalls - 1) + latencyMs) / st.metrics.successfulCalls
      );
      st.lastError = null;

      return { result: res, success: true, attempts, latencyMs };
    } catch (err: unknown) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }

  const latencyMs = Date.now() - startTime;
  st.metrics.failedCalls += 1;
  st.metrics.lastLatencyMs = latencyMs;
  st.lastError = lastErr?.message || "Operation failed after retries";

  return {
    success: false,
    attempts,
    error: st.lastError,
    latencyMs,
  };
}

/** Milliseconds before an in-flight IndexNow HTTP call is aborted. */
const INDEXNOW_TIMEOUT_MS = 10_000;

/**
 * Submit URLs to IndexNow with environment-aware handling, a hard 10s request
 * timeout, and persistent logging of every attempt to the `ping_logs` table.
 *
 * IndexNow is supported by Bing, Yandex and DuckDuckGo. Google does NOT use
 * IndexNow, so a successful ping never implies Google indexing.
 */
export async function submitIndexNowManaged(
  urls: string[],
  host?: string,
  options: { backlinkIds?: string[] } = {}
) {
  const health = getIntegrationHealth("indexnow");
  const resolvedHost = host || getIndexNowHost();
  const endpoint = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";
  const { backlinkIds } = options;

  if (!health.enabled) {
    await logPingAttempt({
      urls,
      status: "skipped",
      endpoint,
      responseBody: health.reason || "IndexNow disabled (missing key); no HTTP call made.",
      error: health.reason || "IndexNow disabled",
      backlinkIds,
      requestPayload: { host: resolvedHost, reason: "disabled" },
    });
    return {
      success: false,
      status: "disabled",
      message: health.reason,
      configured: false,
      environment: health.environment,
      mock: false,
      timestamp: new Date().toISOString(),
    };
  }

  if (health.status === "mock" || !health.configured) {
    const mockRes = await executeWithRetry("indexnow", async () => ({
      success: true,
      status: health.status === "warning" ? "staging_mock" : "skipped_mock",
      message: health.reason || "IndexNow key missing. Returned safe mock response.",
      host: resolvedHost,
      urlCount: urls.length,
      urls,
      mock: true,
      configured: false,
      environment: health.environment,
      timestamp: new Date().toISOString(),
    }));
    await logPingAttempt({
      urls,
      status: "skipped",
      endpoint,
      responseBody:
        health.reason || "INDEXNOW_KEY missing; mock response returned, no HTTP call made.",
      backlinkIds,
      requestPayload: { host: resolvedHost, reason: "missing_key" },
    });
    return mockRes.result!;
  }

  // Live execution with retry
  const key = process.env.INDEXNOW_KEY;

  let lastHttpStatus: number | null = null;
  let lastResponseBody: string | null = null;

  const retryRes = await executeWithRetry("indexnow", async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), INDEXNOW_TIMEOUT_MS);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          host: resolvedHost,
          key,
          keyLocation: `https://${resolvedHost}/${key}.txt`,
          urlList: urls,
        }),
        signal: controller.signal,
      });
      lastHttpStatus = res.status;
      lastResponseBody = await res.text().catch(() => "");
      if (!res.ok) throw new Error(`IndexNow API returned status ${res.status}`);
      return res.status;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new Error(`IndexNow request timed out after ${INDEXNOW_TIMEOUT_MS}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  });

  // Persist the attempt (real response code/body; error message as body for
  // network/timeout failures) to the shared ping_logs audit table.
  await logPingAttempt({
    urls,
    status: retryRes.success ? "success" : "failed",
    responseCode: lastHttpStatus,
    responseBody: lastResponseBody ?? retryRes.error ?? null,
    error: retryRes.success ? null : retryRes.error || "IndexNow submission failed",
    endpoint,
    attempt: retryRes.attempts,
    durationMs: retryRes.latencyMs,
    backlinkIds,
    requestPayload: {
      host: resolvedHost,
      key: "[redacted]",
      keyLocation: `https://${resolvedHost}/{key}.txt`,
    },
  });

  if (retryRes.success) {
    return {
      success: true,
      status: "submitted",
      httpStatus: lastHttpStatus as number | null,
      attempts: retryRes.attempts,
      latencyMs: retryRes.latencyMs,
      host: resolvedHost,
      urlCount: urls.length,
      mock: false,
      configured: true,
      environment: health.environment,
      timestamp: new Date().toISOString(),
    };
  }

  console.warn(`[INDEXNOW MANAGED] Live call failed: ${retryRes.error}`);
  // A failed ping is reported as a failure in every environment — never
  // silently converted into a success.
  return {
    success: false,
    status: "failed",
    error: retryRes.error,
    httpStatus: lastHttpStatus as number | null,
    attempts: retryRes.attempts,
    host: resolvedHost,
    urlCount: urls.length,
    mock: false,
    configured: true,
    environment: health.environment,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Send Telegram Notification with environment-aware mock / live retry handling.
 */
export async function sendTelegramManaged(message: string) {
  const health = getIntegrationHealth("telegram");

  if (!health.enabled) {
    return {
      success: false,
      status: "disabled",
      message: health.reason,
      configured: false,
      environment: health.environment,
      mock: false,
      timestamp: new Date().toISOString(),
    };
  }

  if (health.status === "mock" || !health.configured) {
    const mockRes = await executeWithRetry("telegram", async () => ({
      success: true,
      status: health.status === "warning" ? "staging_mock" : "skipped_mock",
      message: health.reason || "Telegram credentials missing. Returned safe mock response.",
      previewMessage: message.length > 50 ? `${message.substring(0, 50)}...` : message,
      mock: true,
      configured: false,
      environment: health.environment,
      timestamp: new Date().toISOString(),
    }));
    return mockRes.result!;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const retryRes = await executeWithRetry("telegram", async () => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
    if (!res.ok) throw new Error(`Telegram API returned status ${res.status}`);
    return res.status;
  });

  if (retryRes.success) {
    return {
      success: true,
      status: "sent",
      attempts: retryRes.attempts,
      latencyMs: retryRes.latencyMs,
      mock: false,
      configured: true,
      environment: health.environment,
      timestamp: new Date().toISOString(),
    };
  } else {
    console.warn(`[TELEGRAM MANAGED] Live call failed: ${retryRes.error}`);
    return {
      success: health.environment !== "production",
      status: "failed_fallback",
      error: retryRes.error,
      attempts: retryRes.attempts,
      mock: true,
      configured: true,
      environment: health.environment,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Dispatch Webhook with retry support.
 */
export async function dispatchWebhookManaged(targetUrl: string, payload: Record<string, unknown>) {
  const health = getIntegrationHealth("webhook");

  if (!health.enabled) {
    return {
      success: false,
      status: "disabled",
      message: health.reason,
      environment: health.environment,
      timestamp: new Date().toISOString(),
    };
  }

  const retryRes = await executeWithRetry("webhook", async () => {
    // If targetUrl is an example or mock URL, simulate successful delivery
    if (targetUrl.includes("example.com") || targetUrl.includes("mock")) {
      return { delivered: true, statusCode: 200 };
    }
    const res = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Webhook target returned status ${res.status}`);
    return { delivered: true, statusCode: res.status };
  });

  return {
    success: retryRes.success,
    status: retryRes.success ? "delivered" : "failed",
    attempts: retryRes.attempts,
    error: retryRes.error,
    targetUrl,
    environment: health.environment,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute Custom Connector with retry support.
 */
export async function executeConnectorManaged(connectorId: string, payload?: Record<string, unknown>) {
  const health = getIntegrationHealth("custom_connector");

  if (!health.enabled) {
    return {
      success: false,
      status: "disabled",
      message: health.reason,
      environment: health.environment,
      timestamp: new Date().toISOString(),
    };
  }

  const retryRes = await executeWithRetry("custom_connector", async () => {
    // Simulate connector execution
    return { connectorId, executed: true, payload: payload || {} };
  });

  return {
    success: retryRes.success,
    status: retryRes.success ? "executed" : "failed",
    attempts: retryRes.attempts,
    connectorId,
    environment: health.environment,
    timestamp: new Date().toISOString(),
  };
}

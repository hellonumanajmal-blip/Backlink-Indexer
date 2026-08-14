/**
 * Integration Manager proxy wrapper
 * Maintains backward compatibility while delegating to Production Integration Manager.
 */

import {
  checkSecretsConfiguration,
  getIndexNowHost,
  getIntegrationHealth,
  getIntegrationsHealthReport,
  sendTelegramManaged,
  submitIndexNowManaged,
  dispatchWebhookManaged,
  executeConnectorManaged,
  getEnvironment,
} from "./integrationManager";

export {
  checkSecretsConfiguration,
  getIndexNowHost,
  getIntegrationHealth,
  getIntegrationsHealthReport,
  getEnvironment,
  dispatchWebhookManaged,
  executeConnectorManaged,
};

export interface IntegrationStatus {
  name: string;
  configured: boolean;
  status: "active" | "disabled_mock" | "healthy" | "disabled" | "warning" | "degraded" | "mock";
  reason?: string;
}

export function checkIntegrationsStatus(): Record<string, IntegrationStatus> {
  const report = getIntegrationsHealthReport();
  const res: Record<string, IntegrationStatus> = {};

  for (const [key, item] of Object.entries(report.integrations)) {
    res[key] = {
      name: item.name,
      configured: item.configured,
      status: item.status,
      reason: item.reason || undefined,
    };
  }

  return res;
}

/**
 * Submit URLs to IndexNow (Bing/Yandex/DuckDuckGo — Google does not use
 * IndexNow). Host defaults to INDEXNOW_HOST. Every attempt is persisted to the
 * `ping_logs` table; pass backlinkIds so log rows can be traced to backlinks.
 */
export async function submitIndexNow(
  urls: string[],
  host?: string,
  options?: { backlinkIds?: string[] }
) {
  return submitIndexNowManaged(urls, host, options);
}

export async function sendTelegramNotification(message: string) {
  return sendTelegramManaged(message);
}

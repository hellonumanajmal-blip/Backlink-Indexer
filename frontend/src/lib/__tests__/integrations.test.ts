import {
  getEnvironment,
  checkSecretsConfiguration,
  getIntegrationHealth,
  getIntegrationsHealthReport,
  executeWithRetry,
  submitIndexNowManaged,
  sendTelegramManaged,
  dispatchWebhookManaged,
  executeConnectorManaged,
} from "../integrationManager.js";

async function runTests() {
  console.log("=== RUNNING PRODUCTION INTEGRATION MANAGER TEST SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${testName}`);
      failed++;
    }
  }

  // Test 1: Environment detection
  const env = getEnvironment();
  assert(["development", "staging", "production"].includes(env), "Environment detection returns valid mode");

  // Test 2: Secret validation does not expose raw secret strings
  const secrets = checkSecretsConfiguration();
  assert(typeof secrets.indexnow === "boolean", "Secret validation exposes boolean for indexnow");
  assert(typeof secrets.telegram === "boolean", "Secret validation exposes boolean for telegram");
  assert(!("INDEXNOW_KEY" in secrets), "Secret validation does not expose raw key names or values");

  // Test 3: Health report structure
  const report = getIntegrationsHealthReport();
  assert(Boolean(report.environment), "Health report contains environment");
  assert(typeof report.summary.total === "number", "Health report contains summary total");
  assert(Boolean(report.integrations.indexnow), "Health report contains indexnow integration");
  assert(Boolean(report.integrations.telegram), "Health report contains telegram integration");
  assert(Boolean(report.integrations.webhook), "Health report contains webhook integration");
  assert(Boolean(report.integrations.custom_connector), "Health report contains custom_connector integration");

  // Test 4: Retry support execution
  let attemptCounter = 0;
  const retryResult = await executeWithRetry(
    "webhook",
    async () => {
      attemptCounter++;
      if (attemptCounter < 2) {
        throw new Error("Simulated transient error");
      }
      return "success";
    },
    { maxRetries: 3, initialDelayMs: 10 }
  );

  assert(retryResult.success === true, "executeWithRetry succeeds after transient error");
  assert(retryResult.attempts === 2, "executeWithRetry retried exactly once before succeeding");
  assert(retryResult.result === "success", "executeWithRetry returns correct payload");

  // Test 5: IndexNow managed submission
  const indexNowRes = await submitIndexNowManaged(["https://pintdown.site/test-url"]);
  assert(indexNowRes.success === true, "IndexNow managed submission completes without crashing");
  assert(Boolean(indexNowRes.status), "IndexNow managed submission returns status");

  // Test 6: Telegram managed notification
  const telegramRes = await sendTelegramManaged("Test notification message");
  assert(telegramRes.success === true, "Telegram managed notification completes without crashing");

  // Test 7: Webhook managed dispatch
  const webhookRes = await dispatchWebhookManaged("https://hooks.example.com/test", { event: "test" });
  assert(webhookRes.success === true, "Webhook managed dispatch succeeds for test target");

  // Test 8: Custom Connector execution
  const connectorRes = await executeConnectorManaged("conn-1", { test: true });
  assert(connectorRes.success === true, "Custom Connector execution succeeds");

  // Test 9: Health report updated with metrics after test calls
  const updatedReport = getIntegrationsHealthReport();
  assert(
    updatedReport.integrations.webhook.metrics.totalCalls > 0,
    "Webhook call metrics recorded in health report"
  );
  assert(
    updatedReport.integrations.indexnow.metrics.totalCalls > 0,
    "IndexNow call metrics recorded in health report"
  );

  console.log(`\n=== TEST SUITE COMPLETE: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution error:", err);
  process.exit(1);
});

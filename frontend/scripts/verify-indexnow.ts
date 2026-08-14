/**
 * Verification script for the IndexNow integration (run with:
 *   npx tsx scripts/verify-indexnow.ts   from the frontend/ directory).
 *
 * 1. Fires a REAL IndexNow ping (api.indexnow.org) and prints the result.
 * 2. Fires a ping against a black-hole endpoint to exercise the 10s
 *    AbortController timeout and the truthful failure reporting.
 * 3. Prints the most recent ping_logs rows (backend SQLite database) proving
 *    both attempts were persisted.
 */

process.loadEnvFile(".env");

import { submitIndexNow } from "../src/lib/integrations";
import { readRecentPingLogs, resolvePingLogDbPath } from "../src/lib/pingLogger";

const TEST_URL = "https://pintdown.site/";

async function main() {
  console.log("ENV INDEXNOW_KEY:", process.env.INDEXNOW_KEY);
  console.log("ENV INDEXNOW_HOST:", process.env.INDEXNOW_HOST || "(default pintdown.site)");
  console.log("PING LOG DB:", resolvePingLogDbPath());

  console.log("\n--- 1) LIVE PING against real IndexNow endpoint ---");
  const live = await submitIndexNow([TEST_URL]);
  console.log("LIVE RESULT:", JSON.stringify(live, null, 2));

  console.log("\n--- 2) NETWORK-FAILURE PING against black-hole endpoint ---");
  process.env.INDEXNOW_ENDPOINT = "http://10.255.255.1:9/indexnow";
  const started = Date.now();
  const failed = await submitIndexNow([TEST_URL]);
  console.log(`elapsed: ${Date.now() - started}ms`);
  console.log("FAILURE RESULT:", JSON.stringify(failed, null, 2));
  delete process.env.INDEXNOW_ENDPOINT;

  console.log("\n--- 2b) TIMEOUT PING against a stalling local server (10s abort × 3 attempts) ---");
  const { createServer } = await import("node:net");
  // Accepts TCP connections but never sends an HTTP response, forcing the
  // AbortController timeout to fire.
  const stall = createServer(() => {});
  await new Promise<void>((resolve) => stall.listen(9099, "127.0.0.1", resolve));
  process.env.INDEXNOW_ENDPOINT = "http://127.0.0.1:9099/indexnow";
  const t0 = Date.now();
  const timedOut = await submitIndexNow([TEST_URL]);
  console.log(`elapsed: ${Date.now() - t0}ms`);
  console.log("TIMEOUT RESULT:", JSON.stringify(timedOut, null, 2));
  delete process.env.INDEXNOW_ENDPOINT;
  stall.close();

  console.log("\n--- 3) Most recent ping_logs rows ---");
  const rows = await readRecentPingLogs(5);
  for (const r of rows) {
    console.log(
      `${r.created_at} | status=${r.status} | code=${r.response_code} | attempt=${r.attempt} | url=${r.url} | error=${String(r.error ?? "").slice(0, 80)} | body=${String(r.response_body ?? "").slice(0, 80)}`
    );
  }
}

main().catch((err) => {
  console.error("VERIFY SCRIPT ERROR:", err);
  process.exit(1);
});

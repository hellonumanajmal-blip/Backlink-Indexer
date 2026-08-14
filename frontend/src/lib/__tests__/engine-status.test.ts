import { PropertyBadge, StatusBadge, formatDispatchSummary } from "../../components/StatusBadge.js";

async function runTests() {
  console.log("=== ENGINE STATUS DISTINCTION TESTS ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`✓ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`✗ [FAIL] ${name}`);
      failed++;
    }
  }

  assert(formatDispatchSummary("websub").includes("signal sent"), "Dispatch summary never says indexed");
  assert(!formatDispatchSummary("indexnow").toLowerCase().includes("google indexed"), "IndexNow summary does not claim Google indexed");
  assert(!formatDispatchSummary("websub").toLowerCase().includes("guaranteed"), "Dispatch never says guaranteed indexing");
  assert(!formatDispatchSummary("websub").toLowerCase().includes("instant google"), "Dispatch never says instant Google indexing");

  const pinged = StatusBadge({ status: "pinged", type: "index" });
  assert(JSON.stringify(pinged).toLowerCase().includes("pinged"), "Pinged status renders as pinged, not indexed");

  const unknown = StatusBadge({ status: "unknown", type: "index" });
  assert(JSON.stringify(unknown).toLowerCase().includes("unknown"), "Unknown visibility is distinct from indexed");

  const owned = PropertyBadge({ propertyType: "OWNED_PROPERTY" });
  const third = PropertyBadge({ propertyType: "THIRD_PARTY_BACKLINK" });
  assert(JSON.stringify(owned).includes("OWNED PROPERTY"), "Owned property label");
  assert(JSON.stringify(third).includes("THIRD-PARTY BACKLINK"), "Third-party backlink label");

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

void runTests();

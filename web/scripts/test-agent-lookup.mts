/**
 * Test script: verifies agent lookup returns a valid agentId
 * for both Abstract and Base chains.
 *
 * Usage: npx tsx scripts/test-agent-lookup.mts [base_url]
 *   base_url defaults to http://localhost:3000
 */

const BASE = process.argv[2] || "http://localhost:3000";
const ADDR = "0x189576DAD5817458535064173dC10DD2434C73a5";

interface AgentResponse {
  registrations?: { agentId: string | null; agentRegistry: string }[];
  error?: string;
}

async function check(chain: string, requireRegistry = true) {
  const url = `${BASE}/api/agent/${ADDR}?chain=${chain}`;
  const res = await fetch(url);
  const json: AgentResponse = await res.json();

  // Registry not configured is acceptable for chains without deployment
  if (!res.ok && json.error?.includes("not configured")) {
    console.log(`  SKIP [${chain}] registry not configured (expected)`);
    return true;
  }

  if (!res.ok) {
    console.error(`  FAIL [${chain}] HTTP ${res.status}: ${json.error}`);
    return false;
  }

  const agentId = json.registrations?.[0]?.agentId;
  if (requireRegistry && (!agentId || agentId === "null" || agentId === "0")) {
    console.error(`  FAIL [${chain}] agentId is missing/zero: ${agentId}`);
    console.error(`  Full response:`, JSON.stringify(json, null, 2));
    return false;
  }

  console.log(`  PASS [${chain}] agentId=${agentId}`);
  return true;
}

async function main() {
  console.log(`Testing agent lookup at ${BASE}`);
  console.log(`Address: ${ADDR}\n`);

  const abstractOk = await check("abstract");
  const baseOk = await check("base");

  console.log();
  if (abstractOk && baseOk) {
    console.log("All checks passed.");
    process.exit(0);
  } else {
    console.log("Some checks failed.");
    process.exit(1);
  }
}

main();

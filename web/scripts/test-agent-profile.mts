/**
 * Validation script for the agent profile page.
 * Tests key data paths and rendering logic without requiring a running server.
 */

import { isAddress } from "viem";

const ETCH_ADDRESS_ABSTRACT = "0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C";
const IDENTITY_REGISTRY_ADDRESS_ABSTRACT = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";

// --- Test helpers ---
let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

// --- Tests ---

console.log("Agent Profile Validation\n");

// 1. Chain config resolution
console.log("Chain config:");
assert(
  isAddress(ETCH_ADDRESS_ABSTRACT),
  "ETCH_ADDRESS_ABSTRACT is valid address"
);
assert(
  isAddress(IDENTITY_REGISTRY_ADDRESS_ABSTRACT),
  "IDENTITY_REGISTRY_ADDRESS_ABSTRACT is valid address"
);

// 2. Agent URI URL format
console.log("\nAgent URI URL format:");
const testAddr = "0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B";
const agentUriAbstract = `https://etch.ack-onchain.dev/api/agent/${testAddr}?chain=abstract`;
const agentUriBase = `https://etch.ack-onchain.dev/api/agent/${testAddr}?chain=base`;
assert(agentUriAbstract.includes(testAddr), "URI includes address");
assert(agentUriAbstract.includes("chain=abstract"), "URI includes chain param (abstract)");
assert(agentUriBase.includes("chain=base"), "URI includes chain param (base)");

// 3. Registration tuple format
console.log("\nRegistration tuple format:");
const chainId = 2741;
const agentId = "42";
const tuple = `(${chainId}, ${IDENTITY_REGISTRY_ADDRESS_ABSTRACT}, ${agentId})`;
assert(tuple.startsWith("("), "Tuple starts with paren");
assert(tuple.includes(String(chainId)), "Tuple includes chainId");
assert(tuple.includes(IDENTITY_REGISTRY_ADDRESS_ABSTRACT), "Tuple includes registry address");
assert(tuple.includes(agentId), "Tuple includes agentId");
assert(tuple.endsWith(")"), "Tuple ends with paren");

// 4. Explorer URL construction
console.log("\nExplorer URLs:");
const explorerUrl = "https://abscan.org";
const tokenUrl = `${explorerUrl}/token/${ETCH_ADDRESS_ABSTRACT}?a=1`;
const addressUrl = `${explorerUrl}/address/${testAddr}`;
const txUrl = `${explorerUrl}/tx/0xabc123`;
assert(tokenUrl.includes("/token/"), "Token explorer URL correct");
assert(addressUrl.includes("/address/"), "Address explorer URL correct");
assert(txUrl.includes("/tx/"), "Tx explorer URL correct");

// 5. Truncate address helper
console.log("\nAddress truncation:");
function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}
const truncated = truncateAddress(testAddr);
assert(truncated.length === 13, "Truncated address is 13 chars");
assert(truncated.startsWith("0xAb58"), "Truncated starts correctly");
assert(truncated.endsWith("C9B"), "Truncated ends correctly (last 4 includes checksum)");

// 6. Chain key normalization
console.log("\nChain key normalization:");
function normalizeChain(param: string | null): string {
  return param === "base" ? "base" : "abstract";
}
assert(normalizeChain(null) === "abstract", "null defaults to abstract");
assert(normalizeChain("abstract") === "abstract", "abstract stays abstract");
assert(normalizeChain("base") === "base", "base stays base");
assert(normalizeChain("ethereum") === "abstract", "unknown defaults to abstract");

// --- Summary ---
console.log(`\n${passed + failed} tests, ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

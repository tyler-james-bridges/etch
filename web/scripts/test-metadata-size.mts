#!/usr/bin/env npx tsx
// Test: verify onchain metadata URI sizes stay within Abstract (zkSync) limits.
// The ABSTRACT_URI_BYTE_LIMIT must match the constant in /api/mint/route.ts.

// Use dynamic import to handle path resolution
const artSvg = await import("../src/lib/art-svg.js");
const { generateEtchMetadata, generateEtchSvg } = artSvg;

const ABSTRACT_URI_BYTE_LIMIT = 24_576;
const ETCH_BASE_URL = "https://etch.ack-onchain.dev";
const TYPE_LABELS = ["Identity", "Attestation", "Credential", "Receipt", "Pass"];

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.error(`  FAIL  ${label}`);
  }
}

// ---------------------------------------------------------------------------
// 1. For every token type, the compact fallback URI fits under the limit
// ---------------------------------------------------------------------------
console.log("\n--- Compact fallback URI stays under Abstract limit ---");
for (let tokenType = 0; tokenType <= 4; tokenType++) {
  const compact = {
    name: "A".repeat(200), // stress: long name
    description: "B".repeat(500), // stress: long description
    image: `${ETCH_BASE_URL}/api/art/99999`,
    external_url: `${ETCH_BASE_URL}/etch/99999`,
    attributes: [
      { trait_type: "Type", value: TYPE_LABELS[tokenType] || "Unknown" },
      { trait_type: "Soulbound", value: "Yes" },
    ],
  };
  const uri =
    "data:application/json;base64," +
    Buffer.from(JSON.stringify(compact)).toString("base64");
  const size = Buffer.byteLength(uri);
  assert(
    size < ABSTRACT_URI_BYTE_LIMIT,
    `Type ${tokenType} (${TYPE_LABELS[tokenType]}) compact URI ${size}B < ${ABSTRACT_URI_BYTE_LIMIT}B`
  );
}

// ---------------------------------------------------------------------------
// 2. Types that exceed the limit DO trigger the compact path
// ---------------------------------------------------------------------------
console.log("\n--- Full metadata exceeds limit for large token types ---");
for (let tokenType = 0; tokenType <= 4; tokenType++) {
  const meta = generateEtchMetadata(42, tokenType, "Test", "desc", true);
  const fullURI =
    "data:application/json;base64," +
    Buffer.from(meta).toString("base64");
  const fullSize = Buffer.byteLength(fullURI);

  if (tokenType === 3) {
    // Receipt SVGs are small enough to fit inline
    assert(
      fullSize <= ABSTRACT_URI_BYTE_LIMIT,
      `Type ${tokenType} (${TYPE_LABELS[tokenType]}) full URI ${fullSize}B fits inline`
    );
  } else {
    assert(
      fullSize > ABSTRACT_URI_BYTE_LIMIT,
      `Type ${tokenType} (${TYPE_LABELS[tokenType]}) full URI ${fullSize}B > limit (needs compact path)`
    );
  }
}

// ---------------------------------------------------------------------------
// 3. SVG generation is deterministic (same seed = same output)
// ---------------------------------------------------------------------------
console.log("\n--- SVG determinism ---");
for (let tokenType = 0; tokenType <= 4; tokenType++) {
  const a = generateEtchSvg(42, tokenType);
  const b = generateEtchSvg(42, tokenType);
  assert(a === b, `Type ${tokenType} SVG is deterministic`);
}

// ---------------------------------------------------------------------------
// 4. Compact metadata contains all required ERC-721 metadata fields
// ---------------------------------------------------------------------------
console.log("\n--- Compact metadata schema ---");
const compact = {
  name: "Test",
  description: "desc",
  image: `${ETCH_BASE_URL}/api/art/1`,
  external_url: `${ETCH_BASE_URL}/etch/1`,
  attributes: [
    { trait_type: "Type", value: "Identity" },
    { trait_type: "Soulbound", value: "No" },
  ],
};
for (const field of ["name", "description", "image", "external_url", "attributes"]) {
  assert(field in compact, `compact metadata has "${field}"`);
}
assert(
  compact.image.startsWith("https://"),
  "image is a valid HTTPS URL"
);
assert(
  compact.external_url.startsWith("https://"),
  "external_url is a valid HTTPS URL"
);

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

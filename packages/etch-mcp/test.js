#!/usr/bin/env node

import {
  TOOL_DEFINITIONS,
  tokenTypeToU8,
  tokenTypeToString,
  handleMessage,
} from "./server.js";

let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    passed++;
    process.stderr.write(`  PASS: ${msg}\n`);
  } else {
    failed++;
    process.stderr.write(`  FAIL: ${msg}\n`);
  }
}

function assertEqual(actual, expected, msg) {
  if (actual === expected) {
    passed++;
    process.stderr.write(`  PASS: ${msg}\n`);
  } else {
    failed++;
    process.stderr.write(`  FAIL: ${msg} (expected ${expected}, got ${actual})\n`);
  }
}

// -- Tool definitions structure --

process.stderr.write("\n--- Tool Definitions ---\n");

assert(Array.isArray(TOOL_DEFINITIONS), "tool definitions is an array");
assertEqual(TOOL_DEFINITIONS.length, 3, "3 tools defined");

for (const tool of TOOL_DEFINITIONS) {
  assert(typeof tool.name === "string", `tool "${tool.name}" has name`);
  assert(typeof tool.description === "string", `tool "${tool.name}" has description`);
  assert(
    typeof tool.inputSchema === "object",
    `tool "${tool.name}" has inputSchema`
  );
  assert(
    tool.inputSchema.type === "object",
    `tool "${tool.name}" schema type is object`
  );
}

// etch tool specifics
const etchTool = TOOL_DEFINITIONS.find((t) => t.name === "etch");
assert(etchTool !== undefined, "etch tool exists");
const etchRequired = etchTool.inputSchema.required;
assert(etchRequired.includes("to"), "etch requires 'to'");
assert(etchRequired.includes("name"), "etch requires 'name'");
assert(etchRequired.includes("tokenType"), "etch requires 'tokenType'");

// etch_resolve tool specifics
const resolveTool = TOOL_DEFINITIONS.find((t) => t.name === "etch_resolve");
assert(resolveTool !== undefined, "etch_resolve tool exists");
assert(
  resolveTool.inputSchema.required.includes("address"),
  "etch_resolve requires 'address'"
);

// -- Token type mapping --

process.stderr.write("\n--- Token Type Mapping ---\n");

assertEqual(tokenTypeToU8("identity"), 0, "identity -> 0");
assertEqual(tokenTypeToU8("attestation"), 1, "attestation -> 1");
assertEqual(tokenTypeToU8("credential"), 2, "credential -> 2");
assertEqual(tokenTypeToU8("receipt"), 3, "receipt -> 3");
assertEqual(tokenTypeToU8("pass"), 4, "pass -> 4");
assertEqual(tokenTypeToU8("Identity"), 0, "Identity (caps) -> 0");
assertEqual(tokenTypeToU8("PASS"), 4, "PASS (caps) -> 4");
assertEqual(tokenTypeToU8("invalid"), null, "invalid -> null");
assertEqual(tokenTypeToU8(""), null, "empty -> null");

assertEqual(tokenTypeToString(0), "identity", "0 -> identity");
assertEqual(tokenTypeToString(1), "attestation", "1 -> attestation");
assertEqual(tokenTypeToString(2), "credential", "2 -> credential");
assertEqual(tokenTypeToString(3), "receipt", "3 -> receipt");
assertEqual(tokenTypeToString(4), "pass", "4 -> pass");
assertEqual(tokenTypeToString(5), "unknown", "5 -> unknown");
assertEqual(tokenTypeToString(255), "unknown", "255 -> unknown");

// -- Base64 encoding --

process.stderr.write("\n--- Base64 Encoding ---\n");

const testMeta = { name: "Test", description: "A test" };
const b64 = Buffer.from(JSON.stringify(testMeta)).toString("base64");
const decoded = JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
assertEqual(decoded.name, "Test", "base64 roundtrip preserves name");
assertEqual(decoded.description, "A test", "base64 roundtrip preserves description");

// -- MCP Protocol: initialize --

process.stderr.write("\n--- MCP Protocol ---\n");

const initResp = JSON.parse(
  await handleMessage(
    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} })
  )
);
assertEqual(initResp.jsonrpc, "2.0", "initialize response has jsonrpc 2.0");
assertEqual(initResp.id, 1, "initialize response has correct id");
assertEqual(
  initResp.result.serverInfo.name,
  "etch-mcp-server",
  "server name is etch-mcp-server"
);
assertEqual(
  initResp.result.protocolVersion,
  "2024-11-05",
  "protocol version is 2024-11-05"
);
assert(
  typeof initResp.result.capabilities.tools === "object",
  "capabilities includes tools"
);

// -- MCP Protocol: tools/list --

const listResp = JSON.parse(
  await handleMessage(
    JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" })
  )
);
assertEqual(listResp.result.tools.length, 3, "tools/list returns 3 tools");
const toolNames = listResp.result.tools.map((t) => t.name);
assert(toolNames.includes("etch"), "tools/list includes etch");
assert(toolNames.includes("etch_check"), "tools/list includes etch_check");
assert(toolNames.includes("etch_resolve"), "tools/list includes etch_resolve");

// -- MCP Protocol: notifications/initialized returns null --

const notifResp = await handleMessage(
  JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })
);
assertEqual(notifResp, null, "notifications/initialized returns null (no response)");

// -- MCP Protocol: unknown method --

const unknownResp = JSON.parse(
  await handleMessage(
    JSON.stringify({ jsonrpc: "2.0", id: 3, method: "unknown/method" })
  )
);
assert(unknownResp.error !== undefined, "unknown method returns error");
assertEqual(unknownResp.error.code, -32601, "unknown method error code is -32601");

// -- MCP Protocol: malformed JSON --

const badResp = JSON.parse(await handleMessage("not valid json"));
assert(badResp.error !== undefined, "malformed JSON returns error");
assertEqual(badResp.error.code, -32700, "malformed JSON error code is -32700");

// -- Tool errors: missing params --

process.stderr.write("\n--- Tool Error Handling ---\n");

const etchNoParams = JSON.parse(
  await handleMessage(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: { name: "etch", arguments: {} },
    })
  )
);
assert(etchNoParams.result.isError === true, "etch with no params returns isError");
assert(
  etchNoParams.result.content[0].text.includes("Missing required parameter"),
  "etch error mentions missing parameter"
);

const checkNoParams = JSON.parse(
  await handleMessage(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "etch_check", arguments: {} },
    })
  )
);
assert(
  checkNoParams.result.isError === true,
  "etch_check with no params returns isError"
);
assert(
  checkNoParams.result.content[0].text.includes("Must provide either"),
  "etch_check error mentions required params"
);

const resolveNoParams = JSON.parse(
  await handleMessage(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: { name: "etch_resolve", arguments: {} },
    })
  )
);
assert(
  resolveNoParams.result.isError === true,
  "etch_resolve with no params returns isError"
);
assert(
  resolveNoParams.result.content[0].text.includes("Missing required parameter"),
  "etch_resolve error mentions missing parameter"
);

// -- Tool errors: unknown tool --

const unknownTool = JSON.parse(
  await handleMessage(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: { name: "nonexistent", arguments: {} },
    })
  )
);
assert(unknownTool.result.isError === true, "unknown tool returns isError");
assert(
  unknownTool.result.content[0].text.includes("Unknown tool"),
  "unknown tool error message"
);

// -- Tool errors: invalid token type --

const badType = JSON.parse(
  await handleMessage(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 14,
      method: "tools/call",
      params: {
        name: "etch",
        arguments: {
          to: "0x1234567890abcdef1234567890abcdef12345678",
          name: "Test",
          tokenType: "invalid_type",
        },
      },
    })
  )
);
assert(badType.result.isError === true, "invalid tokenType returns isError");
assert(
  badType.result.content[0].text.includes("Invalid tokenType"),
  "invalid tokenType error message"
);

// -- Tool errors: no private key --

const noKey = JSON.parse(
  await handleMessage(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 15,
      method: "tools/call",
      params: {
        name: "etch",
        arguments: {
          to: "0x1234567890abcdef1234567890abcdef12345678",
          name: "Test",
          tokenType: "identity",
        },
      },
    })
  )
);
assert(noKey.result.isError === true, "etch without private key returns isError");
assert(
  noKey.result.content[0].text.includes("ETCH_PRIVATE_KEY"),
  "error mentions ETCH_PRIVATE_KEY"
);

// -- Summary --

process.stderr.write(`\n--- Results: ${passed} passed, ${failed} failed ---\n`);

if (failed > 0) {
  process.exit(1);
}

// Force exit since server main loop is also running
process.exit(0);

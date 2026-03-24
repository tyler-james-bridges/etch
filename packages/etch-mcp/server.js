#!/usr/bin/env node

import { createInterface } from "node:readline";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  decodeEventLog,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abstract as abstractMainnet } from "viem/chains";

// -- Configuration --

const ETCH_FACTORY = "0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C";
const IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432";
const DEFAULT_RPC = "https://api.mainnet.abs.xyz";

const rpcUrl = process.env.ETCH_RPC_URL || DEFAULT_RPC;
const privateKey = process.env.ETCH_PRIVATE_KEY || "";

// -- ABIs --

const etchFactoryAbi = parseAbi([
  "function etch(address to, string uri, uint8 tokenType, bool soulbound) returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function tokenType(uint256 tokenId) view returns (uint8)",
  "function isSoulbound(uint256 tokenId) view returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function totalSupply() view returns (uint256)",
  "event Etched(uint256 indexed tokenId, address indexed to, string uri, uint8 tokenType, bool soulbound)",
]);

const identityRegistryAbi = parseAbi([
  "function agentOf(address agent) view returns (uint256)",
  "function agentUri(uint256 tokenId) view returns (string)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

// -- Token type helpers --

const TOKEN_TYPES = ["identity", "attestation", "credential", "receipt", "pass"];

function tokenTypeToU8(typeStr) {
  const idx = TOKEN_TYPES.indexOf(typeStr.toLowerCase());
  return idx >= 0 ? idx : null;
}

function tokenTypeToString(typeU8) {
  return TOKEN_TYPES[typeU8] || "unknown";
}

// -- Viem clients --

function getPublicClient() {
  return createPublicClient({
    chain: abstractMainnet,
    transport: http(rpcUrl),
  });
}

function getWalletClient() {
  if (!privateKey) return null;
  const account = privateKeyToAccount(privateKey);
  return createWalletClient({
    account,
    chain: abstractMainnet,
    transport: http(rpcUrl),
  });
}

// -- Tool definitions --

const TOOL_DEFINITIONS = [
  {
    name: "etch",
    description:
      "Create a permanent onchain ETCH record on Abstract. Mints an ERC-721 token with generative art and typed metadata. The art is automatically generated and embedded in the token.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          type: "string",
          description: "Recipient Ethereum address (0x...)",
        },
        name: {
          type: "string",
          description:
            "Name for the record (e.g. 'My Agent Identity', 'Audit Attestation')",
        },
        description: {
          type: "string",
          description: "Description of what this record represents",
        },
        tokenType: {
          type: "string",
          description:
            "Token type: identity (onchain ID), attestation (verified claim), credential (qualification), receipt (transaction record), or pass (access token)",
          enum: ["identity", "attestation", "credential", "receipt", "pass"],
        },
        soulbound: {
          type: "boolean",
          description:
            "Whether the token is soulbound (non-transferable). Default: true for identity/attestation/credential, false for receipt/pass",
        },
      },
      required: ["to", "name", "tokenType"],
    },
  },
  {
    name: "etch_check",
    description:
      "Look up etched records. Query by address (get balance) or by token ID (get details).",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Look up token balance for this address",
        },
        tokenId: {
          type: "string",
          description: "Look up details for a specific token ID",
        },
      },
    },
  },
  {
    name: "etch_resolve",
    description:
      "Resolve an agent's identity via the ERC-8004 Identity Registry on Abstract",
    inputSchema: {
      type: "object",
      properties: {
        address: {
          type: "string",
          description: "Agent address to resolve",
        },
      },
      required: ["address"],
    },
  },
];

// -- Tool implementations --

async function toolEtch(args) {
  const to = args.to;
  if (!to) throw new Error("Missing required parameter: to");
  const name = args.name;
  if (!name) throw new Error("Missing required parameter: name");
  const tokenTypeStr = args.tokenType;
  if (!tokenTypeStr) throw new Error("Missing required parameter: tokenType");

  const tokenTypeU8 = tokenTypeToU8(tokenTypeStr);
  if (tokenTypeU8 === null) {
    throw new Error(
      "Invalid tokenType. Must be one of: identity, attestation, credential, receipt, pass"
    );
  }

  const description = args.description || "";

  const soulbound =
    typeof args.soulbound === "boolean"
      ? args.soulbound
      : ["identity", "attestation", "credential"].includes(
          tokenTypeStr.toLowerCase()
        );

  if (!privateKey) {
    throw new Error("ETCH_PRIVATE_KEY not configured");
  }

  const walletClient = getWalletClient();
  const publicClient = getPublicClient();

  // Build metadata
  const typeLabel = tokenTypeToString(tokenTypeU8);
  const desc = description || `Onchain ${typeLabel} record on Abstract.`;

  // Step 1: Mint with temporary metadata (no art image, avoids tokenId guessing)
  const tempMetadata = {
    name,
    description: desc,
    attributes: [
      { trait_type: "Type", value: typeLabel },
      { trait_type: "Soulbound", value: soulbound ? "Yes" : "No" },
    ],
  };

  const tempUri = `data:application/json;base64,${Buffer.from(JSON.stringify(tempMetadata)).toString("base64")}`;

  const hash = await walletClient.writeContract({
    address: ETCH_FACTORY,
    abi: etchFactoryAbi,
    functionName: "etch",
    args: [to, tempUri, tokenTypeU8, soulbound],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Step 2: Parse actual tokenId from Etched event
  let tokenId = null;
  for (const log of receipt.logs) {
    try {
      const event = decodeEventLog({
        abi: etchFactoryAbi,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName === "Etched") {
        tokenId = event.args.tokenId.toString();
        break;
      }
    } catch {
      // Not our event, skip
    }
  }

  // Step 3: Update token URI with real tokenId in URLs
  if (tokenId !== null) {
    const finalMetadata = {
      name,
      description: desc,
      image: `https://etch.ack-onchain.dev/api/art/${tokenId}`,
      external_url: `https://etch.ack-onchain.dev/etch/${tokenId}`,
      attributes: [
        { trait_type: "Type", value: typeLabel },
        { trait_type: "Soulbound", value: soulbound ? "Yes" : "No" },
      ],
    };

    const finalUri = `data:application/json;base64,${Buffer.from(JSON.stringify(finalMetadata)).toString("base64")}`;

    const setTokenUriAbi = parseAbi([
      "function setTokenURI(uint256 tokenId, string uri)",
    ]);

    const updateHash = await walletClient.writeContract({
      address: ETCH_FACTORY,
      abi: setTokenUriAbi,
      functionName: "setTokenURI",
      args: [BigInt(tokenId), finalUri],
    });

    await publicClient.waitForTransactionReceipt({ hash: updateHash });
  }

  const result = {
    txHash: hash,
    tokenId,
    blockNumber: Number(receipt.blockNumber),
    status: "success",
    view: tokenId
      ? `https://etch.ack-onchain.dev/etch/${tokenId}`
      : null,
    art: tokenId
      ? `https://etch.ack-onchain.dev/api/art/${tokenId}`
      : null,
    opensea: tokenId
      ? `https://opensea.io/item/abstract/${ETCH_FACTORY}/${tokenId}`
      : null,
  };

  return JSON.stringify(result, null, 2);
}

async function toolEtchCheck(args) {
  const addressStr = args.address || null;
  const tokenIdStr = args.tokenId || null;

  if (!addressStr && !tokenIdStr) {
    throw new Error("Must provide either 'address' or 'tokenId'");
  }

  const publicClient = getPublicClient();

  if (tokenIdStr) {
    const tokenId = BigInt(tokenIdStr);

    const [uri, typeRaw, soulbound, owner] = await Promise.all([
      publicClient.readContract({
        address: ETCH_FACTORY,
        abi: etchFactoryAbi,
        functionName: "tokenURI",
        args: [tokenId],
      }),
      publicClient.readContract({
        address: ETCH_FACTORY,
        abi: etchFactoryAbi,
        functionName: "tokenType",
        args: [tokenId],
      }),
      publicClient.readContract({
        address: ETCH_FACTORY,
        abi: etchFactoryAbi,
        functionName: "isSoulbound",
        args: [tokenId],
      }),
      publicClient.readContract({
        address: ETCH_FACTORY,
        abi: etchFactoryAbi,
        functionName: "ownerOf",
        args: [tokenId],
      }),
    ]);

    const result = {
      tokenId: tokenIdStr,
      uri,
      tokenType: tokenTypeToString(typeRaw),
      tokenTypeRaw: typeRaw,
      soulbound,
      owner,
    };

    return JSON.stringify(result, null, 2);
  }

  // address query
  const balance = await publicClient.readContract({
    address: ETCH_FACTORY,
    abi: etchFactoryAbi,
    functionName: "balanceOf",
    args: [addressStr],
  });

  const result = {
    address: addressStr,
    balance: balance.toString(),
  };

  return JSON.stringify(result, null, 2);
}

async function toolEtchResolve(args) {
  const addressStr = args.address;
  if (!addressStr) throw new Error("Missing required parameter: address");

  const publicClient = getPublicClient();

  let tokenId;
  try {
    tokenId = await publicClient.readContract({
      address: IDENTITY_REGISTRY,
      abi: identityRegistryAbi,
      functionName: "agentOf",
      args: [addressStr],
    });
  } catch (e) {
    throw new Error(
      `agentOf call failed (address may not be registered): ${e.message}`
    );
  }

  if (tokenId === 0n) {
    return JSON.stringify({
      address: addressStr,
      registered: false,
      message:
        "Address is not registered in the ERC-8004 Identity Registry",
    });
  }

  const uri = await publicClient.readContract({
    address: IDENTITY_REGISTRY,
    abi: identityRegistryAbi,
    functionName: "agentUri",
    args: [tokenId],
  });

  const result = {
    address: addressStr,
    registered: true,
    tokenId: tokenId.toString(),
    metadataUri: uri,
  };

  return JSON.stringify(result, null, 2);
}

async function callTool(name, args) {
  switch (name) {
    case "etch":
      return await toolEtch(args);
    case "etch_check":
      return await toolEtchCheck(args);
    case "etch_resolve":
      return await toolEtchResolve(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// -- MCP Protocol --

function makeResponse(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result });
}

function makeError(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleMessage(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return makeError(null, -32700, "Parse error");
  }

  const { id, method, params } = request;

  switch (method) {
    case "initialize":
      return makeResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "etch-mcp-server", version: "0.1.0" },
      });

    case "notifications/initialized":
      // No response for notifications
      return null;

    case "tools/list":
      return makeResponse(id, { tools: TOOL_DEFINITIONS });

    case "tools/call": {
      if (!params) {
        return makeError(id, -32602, "Missing params");
      }
      const toolName = params.name || "";
      const args = params.arguments || {};

      try {
        const content = await callTool(toolName, args);
        return makeResponse(id, {
          content: [{ type: "text", text: content }],
        });
      } catch (e) {
        return makeResponse(id, {
          content: [{ type: "text", text: `Error: ${e.message}` }],
          isError: true,
        });
      }
    }

    default:
      return makeError(id, -32601, `Method not found: ${method}`);
  }
}

// -- Main loop --

function log(...args) {
  process.stderr.write(args.join(" ") + "\n");
}

async function main() {
  log("[etch-mcp] Starting MCP server (stdio)");

  const rl = createInterface({ input: process.stdin });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const response = await handleMessage(trimmed);
    if (response !== null) {
      process.stdout.write(response + "\n");
    }
  }

  log("[etch-mcp] stdin closed, shutting down");
}

// Export for testing
export {
  TOOL_DEFINITIONS,
  tokenTypeToU8,
  tokenTypeToString,
  callTool,
  handleMessage,
};

main().catch((e) => {
  log("[etch-mcp] Fatal error:", e.message);
  process.exit(1);
});

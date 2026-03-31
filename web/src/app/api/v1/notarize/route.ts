import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Hex } from "viem";
import { mintNotarizedToken } from "@/lib/notarize";
import type { NotarizeInput } from "@/lib/notarize";
import { withPaymentForChain } from "@/lib/x402";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";

// Rate limiting: max 3 per recipient per hour
const notarizeTimestamps = new Map<string, number[]>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(address: string): boolean {
  const now = Date.now();
  const key = address.toLowerCase();
  const timestamps = notarizeTimestamps.get(key) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  notarizeTimestamps.set(key, recent);
  return recent.length < RATE_LIMIT_MAX;
}

function recordNotarize(address: string): void {
  const key = address.toLowerCase();
  const timestamps = notarizeTimestamps.get(key) || [];
  timestamps.push(Date.now());
  notarizeTimestamps.set(key, timestamps);
}

function normalizePrivateKey(input?: string): Hex | null {
  if (!input) return null;
  const trimmed = input.trim().replace(/^['"]|['"]$/g, '');
  const normalized = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(normalized) ? (normalized as Hex) : null;
}

async function handler(request: NextRequest) {
  const privateKey = normalizePrivateKey(process.env.ETCH_MINTER_PRIVATE_KEY);
  if (!privateKey) {
    return NextResponse.json({ error: "Minter not configured" }, { status: 500 });
  }

  let body: NotarizeInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.data || typeof body.data !== "string" || body.data.trim().length === 0) {
    return NextResponse.json({ error: "data is required" }, { status: 400 });
  }

  if (body.type && body.type !== "receipt" && body.type !== "attestation") {
    return NextResponse.json(
      { error: "type must be 'receipt' or 'attestation'" },
      { status: 400 }
    );
  }

  if (body.chain && body.chain !== "abstract" && body.chain !== "base") {
    return NextResponse.json(
      { error: "chain must be 'abstract' or 'base'" },
      { status: 400 }
    );
  }

  const minterAddress = process.env.ETCH_MINTER_ADDRESS;
  const recipient = (body.to || minterAddress) as string;

  if (!recipient || !isAddress(recipient)) {
    return NextResponse.json(
      { error: "Invalid or missing recipient address" },
      { status: 400 }
    );
  }

  if (!checkRateLimit(recipient)) {
    return NextResponse.json(
      { error: "Rate limit exceeded: max 3 notarizations per address per hour" },
      { status: 429 }
    );
  }

  try {
    const result = await mintNotarizedToken(
      body,
      recipient as Hex,
      privateKey
    );

    recordNotarize(recipient);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Notarization failed";
    console.error("Notarize error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const notarizeExtensions = declareDiscoveryExtension({
  bodyType: "json",
  input: {
    data: "The UTF-8 string data to notarize",
    type: "receipt",
    soulbound: true,
    chain: "abstract",
  },
  inputSchema: {
    type: "object",
    required: ["data"],
    properties: {
      data: { type: "string", description: "The UTF-8 string data to notarize." },
      type: {
        type: "string",
        enum: ["receipt", "attestation"],
        description: "Token type for the notarization.",
      },
      soulbound: {
        type: "boolean",
        description: "Whether the token is non-transferable.",
      },
      to: {
        type: "string",
        description: "Recipient address (0x...). Defaults to minter address.",
      },
      chain: {
        type: "string",
        enum: ["abstract", "base"],
        description: "Target chain for notarization. Defaults to abstract.",
      },
    },
  },
  output: {
    example: {
      tokenId: 42,
      txHash: "0xabc...",
      dataHash: "0xdef...",
      timestamp: "2026-01-01T00:00:00Z",
      explorerUrl: "https://abscan.org/tx/0xabc...",
      tokenUrl: "https://etch.ack-onchain.dev/etch/42",
    },
    schema: {
      type: "object",
      properties: {
        tokenId: { type: "integer" },
        txHash: { type: "string" },
        updateTxHash: { type: "string" },
        dataHash: { type: "string" },
        timestamp: { type: "string" },
        explorerUrl: { type: "string" },
        tokenUrl: { type: "string" },
      },
    },
  },
});

export async function POST(request: NextRequest) {
  let requestedChain: 'abstract' | 'base' = 'abstract';
  try {
    const probe = await request.clone().json();
    if (probe?.chain === 'base') requestedChain = 'base';
  } catch {
    // ignore body parse errors here, handler will return 400
  }

  const gated = withPaymentForChain<unknown>(
    requestedChain,
    handler,
    '0.01',
    'ETCH notarization: hash data and mint onchain proof token',
    process.env.ETCH_MINTER_ADDRESS,
    notarizeExtensions
  );

  return gated(request);
}

import { NextRequest, NextResponse } from "next/server";
import { isAddress, type Hex } from "viem";
import { mintNotarizedToken } from "@/lib/notarize";
import type { NotarizeInput } from "@/lib/notarize";
import { withPayment } from "@/lib/x402";

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

async function handler(request: NextRequest) {
  const privateKey = process.env.ETCH_MINTER_PRIVATE_KEY;
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
      privateKey as Hex
    );

    recordNotarize(recipient);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Notarization failed";
    console.error("Notarize error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const gated = withPayment<any>(
    handler,
    '0.01',
    'ETCH notarization: hash data and mint onchain proof token',
    process.env.ETCH_MINTER_ADDRESS
  );

  return gated(request);
}

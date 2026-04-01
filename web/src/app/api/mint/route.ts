import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  isAddress,
  parseEventLogs,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abstract, base } from "viem/chains";
import { ETCH_ABI } from "@/lib/contract";
import { generateEtchMetadata } from "@/lib/art-svg";

// Abstract (zkSync) has strict per-tx storage limits. Data URIs above this
// byte threshold will exceed the "Storage invocations limit" when written
// to contract storage via setTokenURI. When the full onchain metadata
// would exceed this, we store a compact JSON with an image URL pointing to
// our deterministic art API instead of an inline base64 SVG.
const ABSTRACT_URI_BYTE_LIMIT = 24_576; // 24 KB - safe margin under zkSync limits
const ETCH_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://etch.ack-onchain.dev").replace(/\/$/, "");

const CHAIN_CONFIG = {
  abstract: {
    chain: abstract,
    rpcUrl: "https://api.mainnet.abs.xyz",
    etchAddress: (process.env.ETCH_ADDRESS_ABSTRACT || "0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C").trim() as Hex,
  },
  base: {
    chain: base,
    rpcUrl: "https://mainnet.base.org",
    etchAddress: (process.env.ETCH_ADDRESS_BASE || "0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459").trim() as Hex,
  },
} as const;

// Rate limiting: max 3 mints per address per hour
const mintTimestamps = new Map<string, number[]>();
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function checkRateLimit(address: string): boolean {
  const now = Date.now();
  const key = address.toLowerCase();
  const timestamps = mintTimestamps.get(key) || [];
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  mintTimestamps.set(key, recent);
  return recent.length < RATE_LIMIT_MAX;
}

function recordMint(address: string): void {
  const key = address.toLowerCase();
  const timestamps = mintTimestamps.get(key) || [];
  timestamps.push(Date.now());
  mintTimestamps.set(key, timestamps);
}

function checkApiKey(request: NextRequest): boolean {
  const requiredKey = process.env.ETCH_MINT_API_KEY;
  if (!requiredKey) return true;
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;
  const parts = authHeader.split(" ");
  return parts.length === 2 && parts[0] === "Bearer" && parts[1] === requiredKey;
}

function normalizePrivateKey(input?: string): Hex | null {
  if (!input) return null;
  const trimmed = input.trim().replace(/^['"]|['"]$/g, "");
  const normalized = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return /^0x[0-9a-fA-F]{64}$/.test(normalized) ? (normalized as Hex) : null;
}

export async function POST(request: NextRequest) {
  if (!checkApiKey(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const privateKey = normalizePrivateKey(process.env.ETCH_MINTER_PRIVATE_KEY);
  if (!privateKey) {
    return NextResponse.json(
      { error: "Minter not configured" },
      { status: 500 }
    );
  }

  let body: {
    to: string;
    name: string;
    description: string;
    tokenType: number;
    soulbound: boolean;
    chain?: "abstract" | "base";
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, name, description, tokenType, soulbound } = body;
  const targetChain = body.chain === "base" ? "base" : "abstract";
  const cfg = CHAIN_CONFIG[targetChain];

  if (!to || !isAddress(to)) {
    return NextResponse.json(
      { error: "Invalid recipient address" },
      { status: 400 }
    );
  }

  if (!checkRateLimit(to)) {
    return NextResponse.json(
      { error: "Rate limit exceeded: max 3 mints per address per hour" },
      { status: 429 }
    );
  }

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (typeof tokenType !== "number" || tokenType < 0 || tokenType > 4) {
    return NextResponse.json(
      { error: "Invalid token type (must be 0-4)" },
      { status: 400 }
    );
  }

  try {
    const account = privateKeyToAccount(privateKey);

    const publicClient = createPublicClient({
      chain: cfg.chain,
      transport: http(cfg.rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: cfg.chain,
      transport: http(cfg.rpcUrl),
    });

    const typeLabels = ["Identity", "Attestation", "Credential", "Receipt", "Pass"];

    // Step 1: Mint with temporary metadata (no art, avoids race condition)
    const tempMetadata = {
      name: name.trim(),
      description: description?.trim() || `An onchain ${typeLabels[tokenType] || "token"} etched permanently on Abstract.`,
      attributes: [
        { trait_type: "Type", value: typeLabels[tokenType] || "Unknown" },
        { trait_type: "Soulbound", value: soulbound ? "Yes" : "No" },
      ],
    };

    const tempMetadataBase64 = Buffer.from(JSON.stringify(tempMetadata)).toString("base64");
    const tempMetadataURI = `data:application/json;base64,${tempMetadataBase64}`;

    const hash = await walletClient.writeContract({
      address: cfg.etchAddress,
      abi: ETCH_ABI,
      functionName: "etch",
      args: [to as `0x${string}`, tempMetadataURI, tokenType, soulbound],
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Step 2: Parse actual tokenId from Etched event logs
    const etchedEvents = parseEventLogs({
      abi: ETCH_ABI,
      eventName: "Etched",
      logs: receipt.logs,
    });

    if (etchedEvents.length === 0) {
      return NextResponse.json(
        { error: "Mint succeeded but could not parse tokenId from logs", txHash: hash },
        { status: 500 }
      );
    }

    const mintedTokenId = Number(etchedEvents[0].args.tokenId);

    // Step 3: Generate correct art metadata using the real tokenId
    const metadataJson = generateEtchMetadata(
      mintedTokenId,
      tokenType,
      name.trim(),
      description?.trim() || "",
      soulbound
    );

    const metadataBase64 = Buffer.from(metadataJson).toString("base64");
    const fullMetadataURI = `data:application/json;base64,${metadataBase64}`;

    // Step 4: Update token URI with correct art
    // On Abstract (zkSync), large data URIs exceed storage invocation limits.
    // Fall back to a compact URI with a hosted image URL when the full
    // onchain metadata is too large.
    let correctMetadataURI = fullMetadataURI;
    if (targetChain === "abstract" && Buffer.byteLength(fullMetadataURI) > ABSTRACT_URI_BYTE_LIMIT) {
      const compactMetadata = {
        name: name.trim() || `ETCH #${mintedTokenId}`,
        description: description?.trim() || `An onchain ${typeLabels[tokenType] || "token"} etched permanently on Abstract.`,
        image: `${ETCH_BASE_URL}/api/art/${mintedTokenId}`,
        external_url: `${ETCH_BASE_URL}/etch/${mintedTokenId}`,
        attributes: [
          { trait_type: "Type", value: typeLabels[tokenType] || "Unknown" },
          { trait_type: "Soulbound", value: soulbound ? "Yes" : "No" },
        ],
      };
      const compactBase64 = Buffer.from(JSON.stringify(compactMetadata)).toString("base64");
      correctMetadataURI = `data:application/json;base64,${compactBase64}`;
    }

    let updateHash = hash;

    if (targetChain === "abstract") {
      updateHash = await walletClient.writeContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "setTokenURI",
        args: [BigInt(mintedTokenId), correctMetadataURI],
      });

      await publicClient.waitForTransactionReceipt({ hash: updateHash });
    }

    recordMint(to);

    return NextResponse.json({
      tokenId: mintedTokenId,
      txHash: hash,
      updateTxHash: updateHash,
      chain: targetChain,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    console.error("Mint error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

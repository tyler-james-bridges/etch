import { NextRequest, NextResponse } from "next/server";
import {
  createWalletClient,
  createPublicClient,
  http,
  isAddress,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abstract } from "viem/chains";
import { ETCH_ADDRESS, ETCH_ABI } from "@/lib/contract";
import { generateEtchMetadata } from "@/lib/art-svg";

const RPC_URL = "https://api.mainnet.abs.xyz";

export async function POST(request: NextRequest) {
  const privateKey = process.env.ETCH_MINTER_PRIVATE_KEY;
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
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { to, name, description, tokenType, soulbound } = body;

  if (!to || !isAddress(to)) {
    return NextResponse.json(
      { error: "Invalid recipient address" },
      { status: 400 }
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
    const account = privateKeyToAccount(privateKey as Hex);

    const publicClient = createPublicClient({
      chain: abstract,
      transport: http(RPC_URL),
    });

    const walletClient = createWalletClient({
      account,
      chain: abstract,
      transport: http(RPC_URL),
    });

    // Get next token ID to generate art deterministically
    const totalSupply = await publicClient.readContract({
      address: ETCH_ADDRESS,
      abi: ETCH_ABI,
      functionName: "totalSupply",
    });
    const nextTokenId = Number(totalSupply);

    // Generate metadata with embedded art
    const metadataJson = generateEtchMetadata(
      nextTokenId,
      tokenType,
      name.trim(),
      description?.trim() || "",
      soulbound
    );

    const metadataBase64 = Buffer.from(metadataJson).toString("base64");
    const metadataURI = `data:application/json;base64,${metadataBase64}`;

    // Send the mint transaction
    const hash = await walletClient.writeContract({
      address: ETCH_ADDRESS,
      abi: ETCH_ABI,
      functionName: "etch",
      args: [to as `0x${string}`, metadataURI, tokenType, soulbound],
    });

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Parse tokenId from Etched event logs
    let mintedTokenId = nextTokenId;
    for (const log of receipt.logs) {
      if (
        log.topics.length >= 2 &&
        log.address.toLowerCase() === ETCH_ADDRESS.toLowerCase()
      ) {
        const parsedId = parseInt(log.topics[1] as string, 16);
        if (!isNaN(parsedId)) {
          mintedTokenId = parsedId;
          break;
        }
      }
    }

    return NextResponse.json({
      tokenId: mintedTokenId,
      txHash: hash,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Transaction failed";
    console.error("Mint error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

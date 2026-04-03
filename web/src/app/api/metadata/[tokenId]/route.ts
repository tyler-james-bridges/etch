import { NextRequest, NextResponse } from "next/server";
import {
  publicClientAbstract,
  publicClientBase,
  ETCH_ADDRESS_ABSTRACT,
  ETCH_ADDRESS_BASE,
  ETCH_ABI,
  TOKEN_TYPE_LABELS,
} from "@/lib/contract";
import { generateEtchMetadata } from "@/lib/art-svg";

function getChainConfig(chain: string) {
  if (chain === "base") {
    return {
      client: publicClientBase,
      etchAddress: ETCH_ADDRESS_BASE,
      chainName: "Base",
    };
  }

  return {
    client: publicClientAbstract,
    etchAddress: ETCH_ADDRESS_ABSTRACT,
    chainName: "Abstract",
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: tokenIdStr } = await params;
  const tokenId = Number(tokenIdStr);

  if (isNaN(tokenId) || tokenId < 0) {
    return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
  }

  const chain = request.nextUrl.searchParams.get("chain") === "base" ? "base" : "abstract";
  const cfg = getChainConfig(chain);

  try {
    const [tokenType, soulbound, owner] = await Promise.all([
      cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenType",
        args: [BigInt(tokenId)],
      }),
      cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "isSoulbound",
        args: [BigInt(tokenId)],
      }),
      cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      }),
    ]);

    const type = Number(tokenType);
    const typeName = TOKEN_TYPE_LABELS[type] || "Unknown";

    // Parse original URI for description (best effort only, do not fail endpoint)
    let description = `An onchain ${typeName} etched permanently on ${cfg.chainName}.`;
    try {
      const uri = await cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      });
      const uriStr = uri as string;
      if (uriStr.startsWith("data:,")) {
        const parsed = JSON.parse(decodeURIComponent(uriStr.slice(6)));
        if (parsed.subject) description = parsed.subject;
      }
    } catch {
      // Keep default description if tokenURI is unavailable or oversized at RPC layer
    }

    const metadata = generateEtchMetadata(
      tokenId,
      type,
      `ETCH #${tokenId}`,
      description,
      soulbound as boolean
    );

    return new NextResponse(metadata, {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
}

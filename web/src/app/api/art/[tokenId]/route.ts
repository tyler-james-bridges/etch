import { NextRequest, NextResponse } from "next/server";
import {
  publicClientAbstract,
  publicClientBase,
  ETCH_ADDRESS_ABSTRACT,
  ETCH_ADDRESS_BASE,
  ETCH_ABI,
} from "@/lib/contract";
import { generateEtchSvg } from "@/lib/art-svg";

function getChainConfig(chain: string) {
  if (chain === "base") {
    return {
      client: publicClientBase,
      etchAddress: ETCH_ADDRESS_BASE,
    };
  }

  return {
    client: publicClientAbstract,
    etchAddress: ETCH_ADDRESS_ABSTRACT,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: tokenIdStr } = await params;
  const tokenId = Number(tokenIdStr);

  if (isNaN(tokenId) || tokenId < 0) {
    return new NextResponse("Invalid token ID", { status: 400 });
  }

  const chain = request.nextUrl.searchParams.get("chain") === "base" ? "base" : "abstract";
  const cfg = getChainConfig(chain);

  try {
    // Verify token exists and get its type
    const tokenType = await cfg.client.readContract({
      address: cfg.etchAddress,
      abi: ETCH_ABI,
      functionName: "tokenType",
      args: [BigInt(tokenId)],
    });

    const svg = generateEtchSvg(tokenId, Number(tokenType));

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Token not found", { status: 404 });
  }
}

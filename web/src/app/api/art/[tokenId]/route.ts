import { NextRequest, NextResponse } from "next/server";
import { publicClient, ETCH_ADDRESS, ETCH_ABI } from "@/lib/contract";
import { generateEtchSvg } from "@/lib/art-svg";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: tokenIdStr } = await params;
  const tokenId = Number(tokenIdStr);

  if (isNaN(tokenId) || tokenId < 0) {
    return new NextResponse("Invalid token ID", { status: 400 });
  }

  try {
    // Verify token exists and get its type
    const tokenType = await publicClient.readContract({
      address: ETCH_ADDRESS,
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

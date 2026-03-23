import { NextRequest, NextResponse } from "next/server";
import { publicClient, ETCH_ADDRESS, ETCH_ABI, TOKEN_TYPE_LABELS } from "@/lib/contract";
import { generateEtchMetadata } from "@/lib/art-svg";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: tokenIdStr } = await params;
  const tokenId = Number(tokenIdStr);

  if (isNaN(tokenId) || tokenId < 0) {
    return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
  }

  try {
    const [uri, tokenType, soulbound, owner] = await Promise.all([
      publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "tokenURI",
        args: [BigInt(tokenId)],
      }),
      publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "tokenType",
        args: [BigInt(tokenId)],
      }),
      publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "isSoulbound",
        args: [BigInt(tokenId)],
      }),
      publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      }),
    ]);

    const type = Number(tokenType);
    const typeName = TOKEN_TYPE_LABELS[type] || "Unknown";

    // Parse original URI for description
    let description = `An onchain ${typeName} etched permanently on Abstract.`;
    try {
      const uriStr = uri as string;
      if (uriStr.startsWith("data:,")) {
        const parsed = JSON.parse(decodeURIComponent(uriStr.slice(6)));
        if (parsed.subject) description = parsed.subject;
      }
    } catch {
      // Use default description
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

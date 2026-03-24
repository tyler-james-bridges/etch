import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  ETCH_ADDRESS,
  ETCH_ABI,
  IDENTITY_REGISTRY_ADDRESS,
  publicClient,
} from "@/lib/contract";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address" },
      { status: 400 }
    );
  }

  try {
    const balance = await publicClient.readContract({
      address: ETCH_ADDRESS,
      abi: ETCH_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });

    const balanceNum = Number(balance);

    if (balanceNum === 0) {
      return NextResponse.json(
        { error: "No ETCH tokens found for this address" },
        { status: 404 }
      );
    }

    // Search from most recent token to find the latest Identity (type 0)
    let identityTokenId: number | null = null;
    let tokenName = "Agent";
    let tokenDescription = "An onchain agent identity.";

    for (let i = balanceNum - 1; i >= 0; i--) {
      const tokenId = await publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [address as `0x${string}`, BigInt(i)],
      });

      const tType = await publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "tokenType",
        args: [tokenId],
      });

      if (Number(tType) === 0) {
        identityTokenId = Number(tokenId);

        // Parse metadata from tokenURI
        const uri = await publicClient.readContract({
          address: ETCH_ADDRESS,
          abi: ETCH_ABI,
          functionName: "tokenURI",
          args: [tokenId],
        });

        try {
          let metadata: { name?: string; description?: string };
          if (typeof uri === "string" && uri.startsWith("data:application/json;base64,")) {
            const base64 = uri.replace("data:application/json;base64,", "");
            metadata = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
          } else if (typeof uri === "string" && uri.startsWith("data:application/json,")) {
            metadata = JSON.parse(decodeURIComponent(uri.replace("data:application/json,", "")));
          } else {
            metadata = {};
          }

          if (metadata.name) tokenName = metadata.name;
          if (metadata.description) tokenDescription = metadata.description;
        } catch {
          // Keep defaults if metadata parsing fails
        }

        break;
      }
    }

    if (identityTokenId === null) {
      return NextResponse.json(
        { error: "No Identity token found for this address" },
        { status: 404 }
      );
    }

    const agentURI = {
      type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
      name: tokenName,
      description: tokenDescription,
      image: `https://etch.ack-onchain.dev/api/art/${identityTokenId}`,
      services: [],
      x402Support: false,
      active: true,
      registrations: [
        {
          agentId: null,
          agentRegistry: `eip155:2741:${IDENTITY_REGISTRY_ADDRESS}`,
        },
      ],
      supportedTrust: ["reputation"],
    };

    return NextResponse.json(agentURI, {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch agent data";
    console.error("Agent URI error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

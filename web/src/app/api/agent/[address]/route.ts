import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  ETCH_ABI,
  ETCH_ADDRESS_ABSTRACT,
  ETCH_ADDRESS_BASE,
  IDENTITY_REGISTRY_ADDRESS_ABSTRACT,
  IDENTITY_REGISTRY_ADDRESS_BASE,
  IDENTITY_REGISTRY_ABI,
  publicClientAbstract,
  publicClientBase,
} from "@/lib/contract";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  const chainParam = request.nextUrl.searchParams.get("chain");
  const targetChain = chainParam === "base" ? "base" : "abstract";
  const cfg = targetChain === "base"
    ? {
        caipChainId: "eip155:8453",
        etchAddress: ETCH_ADDRESS_BASE,
        registryAddress: IDENTITY_REGISTRY_ADDRESS_BASE,
        client: publicClientBase,
      }
    : {
        caipChainId: "eip155:2741",
        etchAddress: ETCH_ADDRESS_ABSTRACT,
        registryAddress: IDENTITY_REGISTRY_ADDRESS_ABSTRACT,
        client: publicClientAbstract,
      };

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Invalid address" },
      { status: 400 }
    );
  }

  if (!cfg.registryAddress || cfg.registryAddress === ("" as `0x${string}`)) {
    return NextResponse.json(
      { error: `Identity registry not configured for ${targetChain}` },
      { status: 500 }
    );
  }

  try {
    const balance = await cfg.client.readContract({
      address: cfg.etchAddress,
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
      const tokenId = await cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [address as `0x${string}`, BigInt(i)],
      });

      const tType = await cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenType",
        args: [tokenId],
      });

      if (Number(tType) === 0) {
        identityTokenId = Number(tokenId);

        // Parse metadata from tokenURI
        const uri = await cfg.client.readContract({
          address: cfg.etchAddress,
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

    let agentId: string | null = null;
    try {
      const onchainAgentId = await cfg.client.readContract({
        address: cfg.registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "agentOf",
        args: [address as `0x${string}`],
      });
      agentId = String(onchainAgentId);
    } catch {
      agentId = null;
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
          agentId,
          agentRegistry: `${cfg.caipChainId}:${cfg.registryAddress}`,
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

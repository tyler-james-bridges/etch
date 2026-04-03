import {
  publicClientAbstract,
  publicClientBase,
  ETCH_ADDRESS_ABSTRACT,
  ETCH_ADDRESS_BASE,
  ETCH_ABI,
  TOKEN_TYPE_LABELS,
} from "@/lib/contract";
import { EtchArt } from "@/components/etch-art";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { PublicClient } from "viem";

export const revalidate = 30;

type ChainConfig = {
  key: "abstract" | "base";
  name: "Abstract" | "Base";
  explorerName: "Abscan" | "Basescan";
  explorerUrl: string;
  etchAddress: `0x${string}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: PublicClient<any, any>;
};

function getChainConfig(chain: string): ChainConfig {
  if (chain === "base") {
    return {
      key: "base",
      name: "Base",
      explorerName: "Basescan",
      explorerUrl: "https://basescan.org",
      etchAddress: ETCH_ADDRESS_BASE,
      client: publicClientBase,
    };
  }

  return {
    key: "abstract",
    name: "Abstract",
    explorerName: "Abscan",
    explorerUrl: "https://abscan.org",
    etchAddress: ETCH_ADDRESS_ABSTRACT,
    client: publicClientAbstract,
  };
}

function parseTokenUri(uri: string): {
  description: string | null;
  format: string;
} {
  if (!uri) return { description: null, format: "none" };

  if (uri.startsWith("data:application/json;base64,")) {
    try {
      const json = JSON.parse(Buffer.from(uri.slice(29), "base64").toString());
      return {
        description: json.description || null,
        format: "onchain (art + metadata)",
      };
    } catch {
      return { description: null, format: "onchain (base64 JSON)" };
    }
  }

  if (uri.startsWith("data:,")) {
    try {
      const json = JSON.parse(decodeURIComponent(uri.slice(6)));
      return {
        description: json.subject || json.description || null,
        format: "onchain (plain JSON)",
      };
    } catch {
      return { description: null, format: "onchain (data URI)" };
    }
  }

  return { description: null, format: "external" };
}

async function tokenExistsOnChain(tokenId: bigint, cfg: ChainConfig): Promise<boolean> {
  try {
    await cfg.client.readContract({
      address: cfg.etchAddress,
      abi: ETCH_ABI,
      functionName: "ownerOf",
      args: [tokenId],
    });
    return true;
  } catch {
    return false;
  }
}

async function resolveChainConfig(tokenId: bigint, chainParam?: string): Promise<ChainConfig> {
  if (chainParam === "base") return getChainConfig("base");
  if (chainParam === "abstract") return getChainConfig("abstract");

  const abstractCfg = getChainConfig("abstract");
  if (await tokenExistsOnChain(tokenId, abstractCfg)) return abstractCfg;

  const baseCfg = getChainConfig("base");
  if (await tokenExistsOnChain(tokenId, baseCfg)) return baseCfg;

  return abstractCfg;
}

async function getTokenData(tokenId: bigint, cfg: ChainConfig) {
  try {
    const [owner, tokenType, soulbound] = await Promise.all([
      cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      }),
      cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenType",
        args: [tokenId],
      }),
      cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "isSoulbound",
        args: [tokenId],
      }),
    ]);

    let uri = "";
    try {
      const uriResult = await cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenURI",
        args: [tokenId],
      });
      uri = String(uriResult);
    } catch {
      // Keep empty URI if RPC chokes on very large tokenURI responses
    }

    return { owner, uri, tokenType: Number(tokenType), soulbound };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ tokenId: string }>;
  searchParams: Promise<{ chain?: string }>;
}): Promise<Metadata> {
  const { tokenId: tokenIdStr } = await params;
  const { chain: chainParam } = await searchParams;
  const tokenId = BigInt(tokenIdStr);
  const cfg = await resolveChainConfig(tokenId, chainParam);

  try {
    const [uri, tokenType, soulbound] = await Promise.all([
      cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenURI",
        args: [tokenId],
      }),
      cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenType",
        args: [tokenId],
      }),
      cfg.client.readContract({
        address: cfg.etchAddress,
        abi: ETCH_ABI,
        functionName: "isSoulbound",
        args: [tokenId],
      }),
    ]);

    const type = Number(tokenType);
    const typeName = TOKEN_TYPE_LABELS[type] || "Unknown";
    const { description } = parseTokenUri(uri as string);
    const title = `ETCH #${tokenIdStr} - ${typeName}${soulbound ? " (Soulbound)" : ""}`;
    const desc = description || `Onchain ${typeName} record on ${cfg.name}.`;
    const artUrl = `https://etch.ack-onchain.dev/api/art/${tokenIdStr}?chain=${cfg.key}`;

    return {
      title,
      description: desc,
      openGraph: {
        title,
        description: desc,
        images: [
          {
            url: artUrl,
            width: 400,
            height: 400,
            type: "image/svg+xml",
            alt: `ETCH #${tokenIdStr} generative art`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: desc,
        images: [artUrl],
      },
    };
  } catch {
    return {
      title: `ETCH #${tokenIdStr}`,
      description: `Permanent onchain record on ${cfg.name}.`,
    };
  }
}

export default async function TokenPage({
  params,
  searchParams,
}: {
  params: Promise<{ tokenId: string }>;
  searchParams: Promise<{ chain?: string }>;
}) {
  const { tokenId: tokenIdStr } = await params;
  const { chain: chainParam } = await searchParams;
  const tokenId = BigInt(tokenIdStr);

  let cfg = await resolveChainConfig(tokenId, chainParam);
  let data = await getTokenData(tokenId, cfg);

  // Safety fallback: if selected/default chain read fails transiently,
  // try the other chain before returning 404.
  if (!data) {
    const altCfg = getChainConfig(cfg.key === "abstract" ? "base" : "abstract");
    const altData = await getTokenData(tokenId, altCfg);
    if (altData) {
      cfg = altCfg;
      data = altData;
    }
  }

  if (!data) {
    notFound();
  }

  const uriStr = data.uri as string;
  const { description, format } = parseTokenUri(uriStr);

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <Link href="/" className="text-sm">
          Back
        </Link>
      </div>

      <h1 className="text-4xl font-bold">ETCH #{tokenIdStr}</h1>

      <div className="flex gap-2">
        <Link
          href={`/etch/${tokenIdStr}?chain=abstract`}
          className={`border-2 border-[var(--border)] px-3 py-1 text-xs uppercase tracking-wider no-underline transition-colors ${
            cfg.key === "abstract"
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "hover:bg-[var(--foreground)] hover:text-[var(--background)]"
          }`}
        >
          Abstract
        </Link>
        <Link
          href={`/etch/${tokenIdStr}?chain=base`}
          className={`border-2 border-[var(--border)] px-3 py-1 text-xs uppercase tracking-wider no-underline transition-colors ${
            cfg.key === "base"
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "hover:bg-[var(--foreground)] hover:text-[var(--background)]"
          }`}
        >
          Base
        </Link>
      </div>

      <EtchArt tokenId={Number(tokenIdStr)} tokenType={data.tokenType} />

      {description && (
        <p className="text-sm break-words [overflow-wrap:anywhere]">{description}</p>
      )}

      <div className="border-2 border-[var(--border)] divide-y-2 divide-black">
        <div className="p-4 flex justify-between">
          <span className="font-bold uppercase text-sm">Type</span>
          <span>{TOKEN_TYPE_LABELS[data.tokenType] ?? "Unknown"}</span>
        </div>
        <div className="p-4 flex justify-between">
          <span className="font-bold uppercase text-sm">Soulbound</span>
          <span>{data.soulbound ? "Yes" : "No"}</span>
        </div>
        <div className="p-4 flex justify-between items-center gap-4">
          <span className="font-bold uppercase text-sm shrink-0">Owner</span>
          <Link href={`/address/${data.owner}`} className="truncate text-sm">
            {data.owner as string}
          </Link>
        </div>
        <div className="p-4 flex justify-between items-center">
          <span className="font-bold uppercase text-sm">Storage</span>
          <span className="text-sm">{format}</span>
        </div>
        <div className="p-4 flex justify-between items-center">
          <span className="font-bold uppercase text-sm">Chain</span>
          <span className="text-sm">{cfg.name}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={`${cfg.explorerUrl}/token/${cfg.etchAddress}?a=${tokenIdStr}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border-2 border-[var(--border)] px-4 py-2 text-sm no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
        >
          View on {cfg.explorerName} ({cfg.name})
        </a>
        <a
          href={`/api/metadata/${tokenIdStr}?chain=${cfg.key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border-2 border-[var(--border)] px-4 py-2 text-sm no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
        >
          Raw Metadata
        </a>
        <a
          href={`/api/art/${tokenIdStr}?chain=${cfg.key}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border-2 border-[var(--border)] px-4 py-2 text-sm no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
        >
          View SVG
        </a>
      </div>
    </div>
  );
}

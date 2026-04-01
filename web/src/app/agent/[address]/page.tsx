import {
  ETCH_ABI,
  ETCH_ADDRESS_ABSTRACT,
  ETCH_ADDRESS_BASE,
  IDENTITY_REGISTRY_ADDRESS_ABSTRACT,
  IDENTITY_REGISTRY_ADDRESS_BASE,
  IDENTITY_REGISTRY_ABI,
  TOKEN_TYPE_LABELS,
  publicClientAbstract,
  publicClientBase,
} from "@/lib/contract";
import { EtchArt } from "@/components/etch-art";
import { CopyButton } from "@/components/CopyButton";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isAddress, type PublicClient } from "viem";
import type { Metadata } from "next";

export const revalidate = 30;

type ChainConfig = {
  name: string;
  chainId: number;
  caipChainId: string;
  etchAddress: `0x${string}`;
  registryAddress: `0x${string}`;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: PublicClient<any, any>;
  explorerUrl: string;
  explorerName: string;
};

function getChainConfig(chain: string): ChainConfig {
  if (chain === "base") {
    return {
      name: "Base",
      chainId: 8453,
      caipChainId: "eip155:8453",
      etchAddress: ETCH_ADDRESS_BASE,
      registryAddress: IDENTITY_REGISTRY_ADDRESS_BASE,
      client: publicClientBase,
      explorerUrl: "https://basescan.org",
      explorerName: "Basescan",
    };
  }
  return {
    name: "Abstract",
    chainId: 2741,
    caipChainId: "eip155:2741",
    etchAddress: ETCH_ADDRESS_ABSTRACT,
    registryAddress: IDENTITY_REGISTRY_ADDRESS_ABSTRACT,
    client: publicClientAbstract,
    explorerUrl: "https://abscan.org",
    explorerName: "Abscan",
  };
}

type AgentData = {
  address: string;
  chain: ChainConfig;
  identityTokenId: number;
  tokenType: number;
  soulbound: boolean;
  name: string;
  description: string;
  agentId: string | null;
  registered: boolean;
  mintTxHash: string | null;
  registerTxHash: string | null;
};

async function getAgentData(
  address: `0x${string}`,
  chainKey: string
): Promise<AgentData | null> {
  const chain = getChainConfig(chainKey);

  if (
    !chain.registryAddress ||
    chain.registryAddress === ("" as `0x${string}`)
  ) {
    return null;
  }

  try {
    const balance = await chain.client.readContract({
      address: chain.etchAddress,
      abi: ETCH_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    const balanceNum = Number(balance);
    if (balanceNum === 0) return null;

    // Find latest Identity token (type 0)
    let identityTokenId: number | null = null;
    let tokenName = "Agent";
    let tokenDescription = "An onchain agent identity.";
    let tokenSoulbound = false;
    let tokenTypeNum = 0;

    for (let i = balanceNum - 1; i >= 0; i--) {
      const tokenId = await chain.client.readContract({
        address: chain.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [address, BigInt(i)],
      });

      const tType = await chain.client.readContract({
        address: chain.etchAddress,
        abi: ETCH_ABI,
        functionName: "tokenType",
        args: [tokenId],
      });

      if (Number(tType) === 0) {
        identityTokenId = Number(tokenId);
        tokenTypeNum = Number(tType);

        const [soulbound, uri] = await Promise.all([
          chain.client.readContract({
            address: chain.etchAddress,
            abi: ETCH_ABI,
            functionName: "isSoulbound",
            args: [tokenId],
          }),
          chain.client.readContract({
            address: chain.etchAddress,
            abi: ETCH_ABI,
            functionName: "tokenURI",
            args: [tokenId],
          }),
        ]);

        tokenSoulbound = soulbound as boolean;

        try {
          let metadata: { name?: string; description?: string };
          if (
            typeof uri === "string" &&
            uri.startsWith("data:application/json;base64,")
          ) {
            metadata = JSON.parse(
              Buffer.from(uri.slice(29), "base64").toString("utf-8")
            );
          } else if (
            typeof uri === "string" &&
            uri.startsWith("data:application/json,")
          ) {
            metadata = JSON.parse(
              decodeURIComponent(uri.replace("data:application/json,", ""))
            );
          } else {
            metadata = {};
          }
          if (metadata.name) tokenName = metadata.name;
          if (metadata.description) tokenDescription = metadata.description;
        } catch {
          // keep defaults
        }

        break;
      }
    }

    if (identityTokenId === null) return null;

    // Resolve agentId
    let agentId: string | null = null;
    let registered = false;

    try {
      const onchainAgentId = await chain.client.readContract({
        address: chain.registryAddress,
        abi: IDENTITY_REGISTRY_ABI,
        functionName: "agentOf",
        args: [address],
      });
      const id = Number(onchainAgentId);
      if (id > 0) {
        agentId = String(id);
        registered = true;
      }
    } catch {
      // agentOf reverted
    }

    // Fallback: Transfer mint events on registry
    if (!agentId) {
      try {
        const logs = await chain.client.getLogs({
          address: chain.registryAddress,
          event: {
            type: "event",
            name: "Transfer",
            inputs: [
              { name: "from", type: "address", indexed: true },
              { name: "to", type: "address", indexed: true },
              { name: "tokenId", type: "uint256", indexed: true },
            ],
          },
          args: {
            from: "0x0000000000000000000000000000000000000000" as `0x${string}`,
            to: address,
          },
          fromBlock: 0n,
          toBlock: "latest",
        });
        if (logs.length > 0) {
          const lastLog = logs[logs.length - 1];
          if (lastLog.args.tokenId != null) {
            agentId = String(lastLog.args.tokenId);
            registered = true;
          }
        }
      } catch {
        // fallback failed
      }
    }

    // Try to find mint tx for the identity token (Transfer from 0x0 on ETCH)
    let mintTxHash: string | null = null;
    try {
      const mintLogs = await chain.client.getLogs({
        address: chain.etchAddress,
        event: {
          type: "event",
          name: "Transfer",
          inputs: [
            { name: "from", type: "address", indexed: true },
            { name: "to", type: "address", indexed: true },
            { name: "tokenId", type: "uint256", indexed: true },
          ],
        },
        args: {
          from: "0x0000000000000000000000000000000000000000" as `0x${string}`,
          tokenId: BigInt(identityTokenId),
        },
        fromBlock: 0n,
        toBlock: "latest",
      });
      if (mintLogs.length > 0) {
        mintTxHash = mintLogs[0].transactionHash;
      }
    } catch {
      // best-effort
    }

    // Try to find register tx (Transfer from 0x0 on registry for agentId)
    let registerTxHash: string | null = null;
    if (agentId) {
      try {
        const regLogs = await chain.client.getLogs({
          address: chain.registryAddress,
          event: {
            type: "event",
            name: "Transfer",
            inputs: [
              { name: "from", type: "address", indexed: true },
              { name: "to", type: "address", indexed: true },
              { name: "tokenId", type: "uint256", indexed: true },
            ],
          },
          args: {
            from: "0x0000000000000000000000000000000000000000" as `0x${string}`,
            tokenId: BigInt(agentId),
          },
          fromBlock: 0n,
          toBlock: "latest",
        });
        if (regLogs.length > 0) {
          registerTxHash = regLogs[0].transactionHash;
        }
      } catch {
        // best-effort
      }
    }

    return {
      address,
      chain,
      identityTokenId,
      tokenType: tokenTypeNum,
      soulbound: tokenSoulbound,
      name: tokenName,
      description: tokenDescription,
      agentId,
      registered,
      mintTxHash,
      registerTxHash,
    };
  } catch {
    return null;
  }
}

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ chain?: string }>;
}): Promise<Metadata> {
  const { address } = await params;
  const { chain: chainParam } = await searchParams;
  const chainKey = chainParam === "base" ? "base" : "abstract";

  if (!isAddress(address)) {
    return { title: "Invalid Address - ETCH" };
  }

  const data = await getAgentData(address as `0x${string}`, chainKey);
  if (!data) {
    return { title: `Agent ${truncateAddress(address)} - ETCH` };
  }

  const title = `${data.name} - ETCH Agent Profile`;
  const desc = data.description;
  const artUrl = `https://etch.ack-onchain.dev/api/art/${data.identityTokenId}`;

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
          alt: `${data.name} agent identity art`,
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
}

export default async function AgentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ address: string }>;
  searchParams: Promise<{ chain?: string }>;
}) {
  const { address } = await params;
  const { chain: chainParam } = await searchParams;
  const chainKey = chainParam === "base" ? "base" : "abstract";

  if (!isAddress(address)) {
    notFound();
  }

  const data = await getAgentData(address as `0x${string}`, chainKey);
  if (!data) {
    notFound();
  }

  const { chain } = data;
  const agentUriUrl = `https://etch.ack-onchain.dev/api/agent/${address}?chain=${chainKey}`;
  const registrationTuple = data.agentId
    ? `(${chain.chainId}, ${chain.registryAddress}, ${data.agentId})`
    : null;
  const explorerTokenUrl = `${chain.explorerUrl}/token/${chain.etchAddress}?a=${data.identityTokenId}`;
  const explorerAddressUrl = `${chain.explorerUrl}/address/${address}`;

  return (
    <div className="space-y-6 max-w-lg mx-auto">
      <div>
        <Link href="/" className="text-sm">
          Back
        </Link>
      </div>

      {/* Agent identity header */}
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 shrink-0 border-2 border-[var(--border)]">
          <EtchArt
            tokenId={data.identityTokenId}
            tokenType={data.tokenType}
          />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{data.name}</h1>
          <p className="text-sm text-[var(--muted)] break-all mt-1">
            {address}
          </p>
          {data.agentId && (
            <span className="inline-block mt-1 border border-current px-2 py-0.5 text-xs uppercase">
              Agent #{data.agentId}
            </span>
          )}
        </div>
      </div>

      {data.description && (
        <p className="text-sm break-words [overflow-wrap:anywhere]">
          {data.description}
        </p>
      )}

      {/* Chain selector */}
      <div className="flex gap-2">
        <Link
          href={`/agent/${address}?chain=abstract`}
          className={`border-2 border-[var(--border)] px-3 py-1 text-xs uppercase tracking-wider no-underline transition-colors ${
            chainKey === "abstract"
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "hover:bg-[var(--foreground)] hover:text-[var(--background)]"
          }`}
        >
          Abstract
        </Link>
        <Link
          href={`/agent/${address}?chain=base`}
          className={`border-2 border-[var(--border)] px-3 py-1 text-xs uppercase tracking-wider no-underline transition-colors ${
            chainKey === "base"
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "hover:bg-[var(--foreground)] hover:text-[var(--background)]"
          }`}
        >
          Base
        </Link>
      </div>

      {/* Trust / Status / Proof */}
      <section>
        <h2 className="text-xs uppercase tracking-widest mb-3 font-bold">
          Trust & Status
        </h2>
        <div className="border-2 border-[var(--border)] divide-y-2 divide-[var(--border)]">
          <div className="p-4 flex justify-between items-center">
            <span className="font-bold uppercase text-sm">Registered</span>
            <span
              className={`text-sm font-bold ${data.registered ? "text-green-600 dark:text-green-400" : "text-[var(--muted)]"}`}
            >
              {data.registered ? "Yes" : "No"}
            </span>
          </div>
          <div className="p-4 flex justify-between items-center">
            <span className="font-bold uppercase text-sm">Type</span>
            <span className="text-sm">
              {TOKEN_TYPE_LABELS[data.tokenType] ?? "Unknown"}
            </span>
          </div>
          <div className="p-4 flex justify-between items-center">
            <span className="font-bold uppercase text-sm">Soulbound</span>
            <span className="text-sm">{data.soulbound ? "Yes" : "No"}</span>
          </div>
          <div className="p-4 flex justify-between items-center">
            <span className="font-bold uppercase text-sm">Chain</span>
            <span className="text-sm">{chain.name}</span>
          </div>
          <div className="p-4 flex justify-between items-center">
            <span className="font-bold uppercase text-sm">Identity Token</span>
            <Link
              href={`/etch/${data.identityTokenId}`}
              className="text-sm"
            >
              #{data.identityTokenId}
            </Link>
          </div>
          {data.mintTxHash && (
            <div className="p-4 flex justify-between items-center gap-4">
              <span className="font-bold uppercase text-sm shrink-0">
                Mint Tx
              </span>
              <a
                href={`${chain.explorerUrl}/tx/${data.mintTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm truncate"
              >
                {truncateAddress(data.mintTxHash)}
              </a>
            </div>
          )}
          {data.registerTxHash && (
            <div className="p-4 flex justify-between items-center gap-4">
              <span className="font-bold uppercase text-sm shrink-0">
                Register Tx
              </span>
              <a
                href={`${chain.explorerUrl}/tx/${data.registerTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm truncate"
              >
                {truncateAddress(data.registerTxHash)}
              </a>
            </div>
          )}
        </div>
      </section>

      {/* Integration panel */}
      <section>
        <h2 className="text-xs uppercase tracking-widest mb-3 font-bold">
          Integration
        </h2>
        <div className="border-2 border-[var(--border)] divide-y-2 divide-[var(--border)]">
          {/* Agent URI */}
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold uppercase text-sm">
                Agent URI Endpoint
              </span>
              <CopyButton text={agentUriUrl} />
            </div>
            <p className="text-xs text-[var(--muted)] break-all font-mono">
              {agentUriUrl}
            </p>
          </div>

          {/* Registration tuple */}
          {registrationTuple && (
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase text-sm">
                  Registration Tuple
                </span>
                <CopyButton text={registrationTuple} />
              </div>
              <p className="text-xs text-[var(--muted)] break-all font-mono">
                {registrationTuple}
              </p>
              <p className="text-xs text-[var(--muted)]">
                (chainId, registryAddress, agentId)
              </p>
            </div>
          )}

          {/* Explorer links */}
          <div className="p-4 space-y-2">
            <span className="font-bold uppercase text-sm block">
              Explorer Links
            </span>
            <div className="flex flex-wrap gap-2">
              <a
                href={explorerTokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-[var(--border)] px-3 py-1.5 text-xs no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
              >
                Token on {chain.explorerName}
              </a>
              <a
                href={explorerAddressUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-[var(--border)] px-3 py-1.5 text-xs no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
              >
                Address on {chain.explorerName}
              </a>
              {data.registered && data.agentId && (
                <a
                  href={`${chain.explorerUrl}/token/${chain.registryAddress}?a=${data.agentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border-2 border-[var(--border)] px-3 py-1.5 text-xs no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
                >
                  Registry on {chain.explorerName}
                </a>
              )}
              <a
                href={agentUriUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-[var(--border)] px-3 py-1.5 text-xs no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
              >
                Raw Agent URI
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Share */}
      <div className="text-center">
        <p className="text-xs text-[var(--muted)]">
          Share this profile:{" "}
          <span className="font-mono">
            etch.ack-onchain.dev/agent/{truncateAddress(address)}
          </span>
        </p>
      </div>
    </div>
  );
}

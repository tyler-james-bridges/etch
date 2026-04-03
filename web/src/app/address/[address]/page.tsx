import {
  publicClientAbstract,
  publicClientBase,
  ETCH_ADDRESS_ABSTRACT,
  ETCH_ADDRESS_BASE,
  ETCH_ABI,
  TOKEN_TYPE_LABELS,
} from "@/lib/contract";
import Link from "next/link";
import type { PublicClient } from "viem";

export const revalidate = 30;

type ChainToken = {
  tokenId: number;
  tokenType: number;
  soulbound: boolean;
  chain: "abstract" | "base";
};

async function getTokensOnChain(
  address: `0x${string}`,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  client: PublicClient<any, any>,
  etchAddress: `0x${string}`,
  chainKey: "abstract" | "base"
): Promise<ChainToken[]> {
  try {
    const balance = await client.readContract({
      address: etchAddress,
      abi: ETCH_ABI,
      functionName: "balanceOf",
      args: [address],
    });

    const count = Number(balance);
    if (count === 0) return [];

    const tokenIds = await Promise.all(
      Array.from({ length: count }, (_, i) =>
        client.readContract({
          address: etchAddress,
          abi: ETCH_ABI,
          functionName: "tokenOfOwnerByIndex",
          args: [address, BigInt(i)],
        })
      )
    );

    const tokenData = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const [tokenType, soulbound] = await Promise.all([
          client.readContract({
            address: etchAddress,
            abi: ETCH_ABI,
            functionName: "tokenType",
            args: [tokenId],
          }),
          client.readContract({
            address: etchAddress,
            abi: ETCH_ABI,
            functionName: "isSoulbound",
            args: [tokenId],
          }),
        ]);
        return {
          tokenId: Number(tokenId),
          tokenType: Number(tokenType),
          soulbound: soulbound as boolean,
          chain: chainKey,
        };
      })
    );

    return tokenData;
  } catch {
    return [];
  }
}

async function getTokensForAddress(address: `0x${string}`) {
  const [abstractTokens, baseTokens] = await Promise.all([
    getTokensOnChain(address, publicClientAbstract, ETCH_ADDRESS_ABSTRACT, "abstract"),
    getTokensOnChain(address, publicClientBase, ETCH_ADDRESS_BASE, "base"),
  ]);
  return [...abstractTokens, ...baseTokens];
}

export default async function AddressPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const tokens = await getTokensForAddress(address as `0x${string}`);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm">
          Back
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold mb-1">Address</h1>
        <p className="text-sm break-all">{address}</p>
        <div className="flex gap-3 mt-1">
          <a
            href={`https://abscan.org/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs"
          >
            View on Abscan
          </a>
          <a
            href={`https://basescan.org/address/${address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs"
          >
            View on Basescan
          </a>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-3 uppercase tracking-wider">
          Tokens ({tokens.length})
        </h2>
        {tokens.length === 0 ? (
          <div className="border-2 border-[var(--border)] p-6 text-center text-sm">
            No ETCH tokens found for this address.
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <Link
                key={`${token.chain}-${token.tokenId}`}
                href={`/etch/${token.tokenId}?chain=${token.chain}`}
                className="block border-2 border-[var(--border)] p-4 no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold">#{token.tokenId}</span>
                  <span className="border border-current px-2 py-0.5 text-xs uppercase">
                    {TOKEN_TYPE_LABELS[token.tokenType] ?? "Unknown"}
                  </span>
                  <span className="border border-current px-2 py-0.5 text-xs uppercase">
                    {token.chain === "base" ? "Base" : "Abstract"}
                  </span>
                  {token.soulbound && (
                    <span className="border border-current px-2 py-0.5 text-xs uppercase bg-[var(--foreground)] text-[var(--background)]">
                      Soulbound
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

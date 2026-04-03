import {
  publicClientAbstract,
  publicClientBase,
  ETCH_ADDRESS_ABSTRACT,
  ETCH_ADDRESS_BASE,
  ETCH_ABI,
  TOKEN_TYPE_LABELS,
} from "@/lib/contract";
import { generateEtchSvg } from "@/lib/art-svg";
import Link from "next/link";

export const revalidate = 30;

type TokenCard = {
  id: number;
  tokenType: number;
  soulbound: boolean;
  chain: "abstract" | "base";
  svg: string;
};

async function getTokens(chain: "abstract" | "base", limit = 30): Promise<TokenCard[]> {
  const client = chain === "base" ? publicClientBase : publicClientAbstract;
  const etchAddress = chain === "base" ? ETCH_ADDRESS_BASE : ETCH_ADDRESS_ABSTRACT;

  try {
    const totalSupply = Number(
      await client.readContract({
        address: etchAddress,
        abi: ETCH_ABI,
        functionName: "totalSupply",
      })
    );

    const count = Math.min(totalSupply, limit);
    const out: TokenCard[] = [];

    for (let i = totalSupply - 1; i >= totalSupply - count && i >= 0; i--) {
      try {
        const tokenId = await client.readContract({
          address: etchAddress,
          abi: ETCH_ABI,
          functionName: "tokenByIndex",
          args: [BigInt(i)],
        });

        const [tokenType, soulbound] = await Promise.all([
          client.readContract({
            address: etchAddress,
            abi: ETCH_ABI,
            functionName: "tokenType",
            args: [tokenId as bigint],
          }),
          client.readContract({
            address: etchAddress,
            abi: ETCH_ABI,
            functionName: "isSoulbound",
            args: [tokenId as bigint],
          }),
        ]);

        const id = Number(tokenId);
        const type = Number(tokenType);
        out.push({
          id,
          tokenType: type,
          soulbound: Boolean(soulbound),
          chain,
          svg: generateEtchSvg(id, type),
        });
      } catch {
        // skip per-token failures
      }
    }

    return out;
  } catch {
    return [];
  }
}

export default async function ExplorePage() {
  const [abstractTokens, baseTokens] = await Promise.all([
    getTokens("abstract", 30),
    getTokens("base", 30),
  ]);

  const tokens = [...abstractTokens, ...baseTokens];

  return (
    <div className="min-h-screen px-4 py-10 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Explore Etches</h1>
        <Link href="/" className="text-sm no-underline hover:underline">
          Back home
        </Link>
      </div>

      <div className="text-sm text-[var(--muted)] mb-4">
        Showing latest {tokens.length} across Abstract + Base
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-0">
        {tokens.map((token) => (
          <Link
            key={`${token.chain}-${token.id}`}
            href={`/etch/${token.id}?chain=${token.chain}`}
            className="border-2 border-[var(--border)] -mt-[2px] -ml-[2px] no-underline hover:bg-[var(--surface)] transition-colors"
          >
            <div
              className="[&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
              dangerouslySetInnerHTML={{ __html: token.svg }}
            />
            <div className="p-3 border-t-2 border-[var(--border)]">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold">#{token.id}</span>
                <span className="text-xs text-[var(--muted)]">
                  {TOKEN_TYPE_LABELS[token.tokenType] || "Unknown"}
                </span>
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted-light)]">
                {token.chain}
              </div>
              {token.soulbound && (
                <span className="text-[10px] uppercase tracking-wider text-[var(--muted-light)]">
                  Soulbound
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

import {
  publicClient,
  ETCH_ADDRESS,
  ETCH_ABI,
  TOKEN_TYPE_LABELS,
} from "@/lib/contract";
import Link from "next/link";

export const revalidate = 30;

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function getTokensForAddress(address: `0x${string}`) {
  const balance = await publicClient.readContract({
    address: ETCH_ADDRESS,
    abi: ETCH_ABI,
    functionName: "balanceOf",
    args: [address],
  });

  const count = Number(balance);
  if (count === 0) return [];

  const tokenIds = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "tokenOfOwnerByIndex",
        args: [address, BigInt(i)],
      })
    )
  );

  const tokenData = await Promise.all(
    tokenIds.map(async (tokenId) => {
      const [tokenType, soulbound] = await Promise.all([
        publicClient.readContract({
          address: ETCH_ADDRESS,
          abi: ETCH_ABI,
          functionName: "tokenType",
          args: [tokenId],
        }),
        publicClient.readContract({
          address: ETCH_ADDRESS,
          abi: ETCH_ABI,
          functionName: "isSoulbound",
          args: [tokenId],
        }),
      ]);
      return {
        tokenId: Number(tokenId),
        tokenType: Number(tokenType),
        soulbound,
      };
    })
  );

  return tokenData;
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
        <a
          href={`https://abscan.org/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs"
        >
          View on Abscan
        </a>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-3 uppercase tracking-wider">
          Tokens ({tokens.length})
        </h2>
        {tokens.length === 0 ? (
          <div className="border-2 border-black p-6 text-center text-sm">
            No ETCH tokens found for this address.
          </div>
        ) : (
          <div className="space-y-2">
            {tokens.map((token) => (
              <Link
                key={token.tokenId}
                href={`/etch/${token.tokenId}`}
                className="block border-2 border-black p-4 no-underline hover:bg-black hover:text-white transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold">#{token.tokenId}</span>
                  <span className="border border-current px-2 py-0.5 text-xs uppercase">
                    {TOKEN_TYPE_LABELS[token.tokenType] ?? "Unknown"}
                  </span>
                  {token.soulbound && (
                    <span className="border border-current px-2 py-0.5 text-xs uppercase bg-black text-white">
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

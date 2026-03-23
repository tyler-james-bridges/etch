import { publicClient, ETCH_ADDRESS, ETCH_ABI, TOKEN_TYPE_LABELS } from "@/lib/contract";
import Link from "next/link";

export const revalidate = 30;

type EtchedLog = {
  args: {
    tokenId: bigint;
    to: `0x${string}`;
    uri: string;
    tokenType: number;
    soulbound: boolean;
  };
  blockNumber: bigint;
  transactionHash: `0x${string}`;
};

async function getStats() {
  const totalSupply = await publicClient.readContract({
    address: ETCH_ADDRESS,
    abi: ETCH_ABI,
    functionName: "totalSupply",
  });
  return { totalSupply: Number(totalSupply) };
}

async function getRecentEtches(): Promise<EtchedLog[]> {
  try {
    const blockNumber = await publicClient.getBlockNumber();
    const fromBlock = blockNumber > 50000n ? blockNumber - 50000n : 0n;

    const logs = await publicClient.getLogs({
      address: ETCH_ADDRESS,
      event: {
        type: "event",
        name: "Etched",
        inputs: [
          { name: "tokenId", type: "uint256", indexed: true },
          { name: "to", type: "address", indexed: true },
          { name: "uri", type: "string", indexed: false },
          { name: "tokenType", type: "uint8", indexed: false },
          { name: "soulbound", type: "bool", indexed: false },
        ],
      },
      fromBlock,
      toBlock: "latest",
    });

    return (logs as unknown as EtchedLog[]).slice(-10).reverse();
  } catch {
    return [];
  }
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default async function Home() {
  const [stats, recentEtches] = await Promise.all([
    getStats(),
    getRecentEtches(),
  ]);

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="text-center py-16">
        <h1 className="text-7xl md:text-9xl font-bold tracking-tighter">
          ETCH
        </h1>
        <p className="mt-4 text-lg">Permanent onchain records on Abstract</p>
      </section>

      {/* Stats */}
      <section className="border-2 border-black p-6">
        <div className="text-sm uppercase tracking-wider mb-2">
          Total Supply
        </div>
        <div className="text-4xl font-bold">{stats.totalSupply}</div>
      </section>

      {/* Recent Etches */}
      <section>
        <h2 className="text-xl font-bold mb-4 uppercase tracking-wider">
          Recent Etches
        </h2>
        {recentEtches.length === 0 ? (
          <div className="border-2 border-black p-6 text-center text-sm">
            No etches found yet.
          </div>
        ) : (
          <div className="space-y-2">
            {recentEtches.map((log) => (
              <Link
                key={log.args.tokenId.toString()}
                href={`/etch/${log.args.tokenId.toString()}`}
                className="block border-2 border-black p-4 no-underline hover:bg-black hover:text-white transition-colors"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-bold">
                      #{log.args.tokenId.toString()}
                    </span>
                    <span className="border border-black px-2 py-0.5 text-xs uppercase">
                      {TOKEN_TYPE_LABELS[log.args.tokenType] ?? "Unknown"}
                    </span>
                    {log.args.soulbound && (
                      <span className="border border-black px-2 py-0.5 text-xs uppercase bg-black text-white">
                        Soulbound
                      </span>
                    )}
                  </div>
                  <span className="text-xs">
                    {truncateAddress(log.args.to)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

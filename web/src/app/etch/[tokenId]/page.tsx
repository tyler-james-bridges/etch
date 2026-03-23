import {
  publicClient,
  ETCH_ADDRESS,
  ETCH_ABI,
  TOKEN_TYPE_LABELS,
} from "@/lib/contract";
import Link from "next/link";
import { notFound } from "next/navigation";

export const revalidate = 30;

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

async function getTokenData(tokenId: bigint) {
  try {
    const [owner, uri, tokenType, soulbound] = await Promise.all([
      publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      }),
      publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "tokenURI",
        args: [tokenId],
      }),
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
    return { owner, uri, tokenType: Number(tokenType), soulbound };
  } catch {
    return null;
  }
}

export default async function TokenPage({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}) {
  const { tokenId: tokenIdStr } = await params;
  const tokenId = BigInt(tokenIdStr);
  const data = await getTokenData(tokenId);

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm">
          Back
        </Link>
      </div>

      <h1 className="text-4xl font-bold">ETCH #{tokenIdStr}</h1>

      <div className="border-2 border-black divide-y-2 divide-black">
        <div className="p-4 flex justify-between">
          <span className="font-bold uppercase text-sm">Type</span>
          <span>{TOKEN_TYPE_LABELS[data.tokenType] ?? "Unknown"}</span>
        </div>
        <div className="p-4 flex justify-between">
          <span className="font-bold uppercase text-sm">Soulbound</span>
          <span>{data.soulbound ? "Yes" : "No"}</span>
        </div>
        <div className="p-4 flex justify-between items-center">
          <span className="font-bold uppercase text-sm">Owner</span>
          <Link href={`/address/${data.owner}`}>
            <span className="md:hidden">{truncateAddress(data.owner)}</span>
            <span className="hidden md:inline">{data.owner}</span>
          </Link>
        </div>
        <div className="p-4 flex justify-between items-center flex-wrap gap-2">
          <span className="font-bold uppercase text-sm">Token URI</span>
          <span className="text-xs break-all max-w-[70%] text-right">
            {data.uri || "None"}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <a
          href={`https://abscan.org/token/${ETCH_ADDRESS}?a=${tokenIdStr}`}
          target="_blank"
          rel="noopener noreferrer"
          className="border-2 border-black px-4 py-2 text-sm no-underline hover:bg-black hover:text-white transition-colors"
        >
          View on Abscan
        </a>
      </div>
    </div>
  );
}

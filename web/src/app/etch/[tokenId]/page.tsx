import {
  publicClient,
  ETCH_ADDRESS,
  ETCH_ABI,
  TOKEN_TYPE_LABELS,
} from "@/lib/contract";
import { EtchArt } from "@/components/etch-art";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tokenId: string }>;
}): Promise<Metadata> {
  const { tokenId: tokenIdStr } = await params;
  const tokenId = BigInt(tokenIdStr);

  try {
    const [uri, tokenType, soulbound] = await Promise.all([
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

    const type = Number(tokenType);
    const typeName = TOKEN_TYPE_LABELS[type] || "Unknown";
    const { description } = parseTokenUri(uri as string);
    const title = `ETCH #${tokenIdStr} - ${typeName}${soulbound ? " (Soulbound)" : ""}`;
    const desc =
      description || `Onchain ${typeName} record on Abstract.`;
    const artUrl = `https://etch.ack-onchain.dev/api/art/${tokenIdStr}`;

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
      description: "Permanent onchain record on Abstract.",
    };
  }
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function parseTokenUri(uri: string): {
  description: string | null;
  format: string;
} {
  if (!uri) return { description: null, format: "none" };

  // data:application/json;base64,... (full metadata with art)
  if (uri.startsWith("data:application/json;base64,")) {
    try {
      const json = JSON.parse(
        Buffer.from(uri.slice(29), "base64").toString()
      );
      return {
        description: json.description || null,
        format: "onchain (art + metadata)",
      };
    } catch {
      return { description: null, format: "onchain (base64 JSON)" };
    }
  }

  // data:,{...} (plain JSON, no art)
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

  const uriStr = data.uri as string;
  const { description, format } = parseTokenUri(uriStr);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm">
          Back
        </Link>
      </div>

      <h1 className="text-4xl font-bold">ETCH #{tokenIdStr}</h1>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-shrink-0 self-center lg:self-start">
          <EtchArt tokenId={Number(tokenIdStr)} tokenType={data.tokenType} />
        </div>

        <div className="flex-grow space-y-4">
          {description && (
            <p className="text-lg break-words [overflow-wrap:anywhere]">{description}</p>
          )}

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
                <span className="md:hidden">
                  {truncateAddress(data.owner as string)}
                </span>
                <span className="hidden md:inline">
                  {data.owner as string}
                </span>
              </Link>
            </div>
            <div className="p-4 flex justify-between items-center">
              <span className="font-bold uppercase text-sm">Storage</span>
              <span className="text-sm">{format}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              href={`https://abscan.org/token/${ETCH_ADDRESS}?a=${tokenIdStr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-black px-4 py-2 text-sm no-underline hover:bg-black hover:text-white transition-colors"
            >
              View on Abscan
            </a>
            <a
              href={`/api/metadata/${tokenIdStr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-black px-4 py-2 text-sm no-underline hover:bg-black hover:text-white transition-colors"
            >
              Raw Metadata
            </a>
            <a
              href={`/api/art/${tokenIdStr}`}
              target="_blank"
              rel="noopener noreferrer"
              className="border-2 border-black px-4 py-2 text-sm no-underline hover:bg-black hover:text-white transition-colors"
            >
              View SVG
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

import {
  publicClient,
  ETCH_ADDRESS,
  ETCH_ABI,
  TOKEN_TYPE_LABELS,
} from "@/lib/contract";
import { CopyButton } from "@/components/CopyButton";
import { EtchArt } from "@/components/etch-art";
import Link from "next/link";

export const revalidate = 30;

const MCP_CONFIG = JSON.stringify(
  {
    mcpServers: {
      etch: {
        command: "npx",
        args: ["-y", "etch-mcp"],
      },
    },
  },
  null,
  2
);

const TOKEN_TYPES = [
  {
    name: "Identity",
    id: 0,
    description: "Onchain identity anchors. Who you are, provably.",
  },
  {
    name: "Attestation",
    id: 1,
    description: "Third-party claims. Verified facts about an address.",
  },
  {
    name: "Credential",
    id: 2,
    description: "Earned qualifications. Proof of skill or completion.",
  },
  {
    name: "Receipt",
    id: 3,
    description: "Transaction records. Immutable proof something happened.",
  },
  {
    name: "Pass",
    id: 4,
    description: "Access tokens. Gated entry to anything onchain.",
  },

];

const FAQ_ITEMS = [
  {
    q: "What is ETCH?",
    a: "An ERC-721 contract on Abstract that lets AI agents mint typed, optionally soulbound tokens. Think of it as a protocol-level primitive for onchain records.",
  },
  {
    q: "What does soulbound mean?",
    a: "A soulbound token cannot be transferred after minting. It is permanently bound to the receiving address. Useful for credentials, identity, and attestations.",
  },
  {
    q: "How do I use it?",
    a: "Agents: add the MCP server to your config (npx etch-mcp). Humans: connect your wallet on the Create page and mint directly. Both get generative art and onchain metadata.",
  },
  {
    q: "What is MCP?",
    a: "Model Context Protocol. An open standard that lets AI models call external tools. ETCH exposes its contract functions as MCP tools so any compatible agent can use them.",
  },
  {
    q: "Does it cost anything?",
    a: "Minting via the web app is free (we cover gas). MCP minting requires a small amount of ETH on Abstract for gas. No protocol fees either way.",
  },
  {
    q: "What is the ERC-8004 agent registration?",
    a: "When you create an Identity token, you can also register as an ERC-8004 agent on Abstract. This gives you a permanent onchain agent identity with a metadata profile, discoverable by other agents and protocols.",
  },
  {
    q: "Why Abstract?",
    a: "Sub-cent gas, native account abstraction, and a chain built for consumer crypto. Agents can mint hundreds of tokens without burning through a wallet.",
  },
];

type TokenInfo = {
  id: number;
  tokenType: number;
  soulbound: boolean;
  owner: string;
};

async function getStats() {
  const totalSupply = await publicClient.readContract({
    address: ETCH_ADDRESS,
    abi: ETCH_ABI,
    functionName: "totalSupply",
  });

  const total = Number(totalSupply);

  // Fetch recent tokens (up to 12, newest first)
  const count = Math.min(total, 12);
  const recentTokens: TokenInfo[] = [];

  for (let i = total - 1; i >= total - count && i >= 0; i--) {
    try {
      const tokenId = await publicClient.readContract({
        address: ETCH_ADDRESS,
        abi: ETCH_ABI,
        functionName: "tokenByIndex",
        args: [BigInt(i)],
      });

      const [tokenType, soulbound, owner] = await Promise.all([
        publicClient.readContract({
          address: ETCH_ADDRESS,
          abi: ETCH_ABI,
          functionName: "tokenType",
          args: [tokenId as bigint],
        }),
        publicClient.readContract({
          address: ETCH_ADDRESS,
          abi: ETCH_ABI,
          functionName: "isSoulbound",
          args: [tokenId as bigint],
        }),
        publicClient.readContract({
          address: ETCH_ADDRESS,
          abi: ETCH_ABI,
          functionName: "ownerOf",
          args: [tokenId as bigint],
        }),
      ]);

      recentTokens.push({
        id: Number(tokenId),
        tokenType: Number(tokenType),
        soulbound: soulbound as boolean,
        owner: owner as string,
      });
    } catch {
      // Skip tokens that fail to load
    }
  }

  return { totalSupply: total, recentTokens };
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="min-h-screen">
      {/* ---- NAV ---- */}
      <nav className="sticky top-0 z-50 bg-white border-b-2 border-black px-4 py-3 flex items-center justify-between">
        <span className="text-xl font-bold tracking-tight">ETCH</span>
        <div className="flex gap-4 text-sm">
          <Link href="/create" className="no-underline hover:underline font-bold">
            Create
          </Link>
          <a href="#setup" className="no-underline hover:underline">
            Setup
          </a>
          <a href="#types" className="no-underline hover:underline">
            Types
          </a>
          <a href="#faq" className="no-underline hover:underline">
            FAQ
          </a>
          <a
            href="https://github.com/tyler-james-bridges/etch"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline hover:underline"
          >
            GitHub
          </a>
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section className="border-b-2 border-black px-4 py-20 md:py-32 max-w-4xl mx-auto">
        <h1 className="text-6xl md:text-8xl font-bold tracking-tighter leading-none">
          ETCH
        </h1>
        <p className="mt-4 text-lg md:text-xl max-w-xl">
          Permanent onchain records with generative art on Abstract.
          For AI agents via MCP. For humans via the web.
          Optionally register as an ERC-8004 agent in one click.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="bg-black text-white px-5 py-2 text-sm font-bold uppercase tracking-wider no-underline hover:bg-gray-800 transition-colors"
          >
            Create
          </Link>
          <a
            href="#setup"
            className="border-2 border-black px-5 py-2 text-sm font-bold uppercase tracking-wider no-underline hover:bg-black hover:text-white transition-colors"
          >
            MCP Setup
          </a>
          <a
            href="https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C"
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-black px-5 py-2 text-sm font-bold uppercase tracking-wider no-underline hover:bg-black hover:text-white transition-colors"
          >
            Contract
          </a>
        </div>
      </section>

      {/* ---- GALLERY ---- */}
      {stats.recentTokens.length > 0 && (
        <section className="border-b-2 border-black px-4 py-12 md:py-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Recent Etches
              </h2>
              <Link
                href="/create"
                className="border-2 border-black px-4 py-1.5 text-xs font-bold uppercase tracking-wider no-underline hover:bg-black hover:text-white transition-colors"
              >
                Create
              </Link>
            </div>
            {stats.recentTokens.length === 1 ? (
              <Link
                href={`/etch/${stats.recentTokens[0].id}`}
                className="border-2 border-black no-underline hover:bg-gray-50 transition-colors block max-w-sm"
              >
                <div className="overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block">
                  <EtchArt
                    tokenId={stats.recentTokens[0].id}
                    tokenType={stats.recentTokens[0].tokenType}
                    size={400}
                  />
                </div>
                <div className="p-4 border-t-2 border-black">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">ETCH #{stats.recentTokens[0].id}</span>
                    <span className="text-sm text-gray-500">
                      {TOKEN_TYPE_LABELS[stats.recentTokens[0].tokenType] || "Unknown"}
                    </span>
                  </div>
                  {stats.recentTokens[0].soulbound && (
                    <span className="text-xs uppercase tracking-wider text-gray-400">
                      Soulbound
                    </span>
                  )}
                </div>
              </Link>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-0">
                {stats.recentTokens.map((token) => (
                  <Link
                    key={token.id}
                    href={`/etch/${token.id}`}
                    className="border-2 border-black -mt-[2px] -ml-[2px] no-underline hover:bg-gray-50 transition-colors group"
                  >
                    <div className="overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block">
                      <EtchArt
                        tokenId={token.id}
                        tokenType={token.tokenType}
                        size={200}
                      />
                    </div>
                    <div className="p-3 border-t-2 border-black">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">#{token.id}</span>
                        <span className="text-xs text-gray-500">
                          {TOKEN_TYPE_LABELS[token.tokenType] || "Unknown"}
                        </span>
                      </div>
                      {token.soulbound && (
                        <span className="text-[10px] uppercase tracking-wider text-gray-400">
                          Soulbound
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- TERMINAL DEMO ---- */}
      <section className="border-b-2 border-black px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs uppercase tracking-widest mb-4">
            How it works
          </h2>
          <div className="border-2 border-black bg-black text-green-400 p-6 overflow-x-auto">
            <pre className="text-sm leading-relaxed whitespace-pre">
              <span className="text-gray-500">{"// You talk to your agent"}</span>
              {"\n"}
              <span className="text-white">{">"}</span>
              {" Etch a soulbound credential for 0xAb5...3fC\n\n"}
              <span className="text-gray-500">{"// Agent calls ETCH via MCP"}</span>
              {"\n"}
              <span className="text-blue-400">etch</span>
              {"({\n"}
              {"  to: \"0xAb5...3fC\",\n"}
              {"  name: \"Audit Verified\",\n"}
              {"  tokenType: \"credential\",\n"}
              {"  soulbound: true\n"}
              {"})\n\n"}
              <span className="text-gray-500">{"// Generative art + metadata minted onchain"}</span>
              {"\n"}
              <span className="text-green-300">{"OK"}</span>
              {" tokenId: 1 | type: credential | soulbound: true\n"}
              <span className="text-green-300">{"OK"}</span>
              {" tx: 0xae1...5cc\n"}
              <span className="text-green-300">{"OK"}</span>
              {" etch.ack-onchain.dev/etch/1"}
            </pre>
          </div>
        </div>
      </section>

      {/* ---- SETUP ---- */}
      <section id="setup" className="border-b-2 border-black px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Setup
          </h2>
          <p className="text-sm mb-6 max-w-xl">
            Add the ETCH MCP server to your agent config. Works with Claude
            Desktop, Cursor, Windsurf, and any MCP-compatible client.
          </p>
          <div className="border-2 border-black">
            <div className="flex items-center justify-between border-b-2 border-black px-4 py-2 bg-gray-100">
              <span className="text-xs uppercase tracking-wider font-bold">
                mcp.json
              </span>
              <CopyButton text={MCP_CONFIG} />
            </div>
            <pre className="p-4 text-sm overflow-x-auto">{MCP_CONFIG}</pre>
          </div>
          <p className="text-xs mt-3 text-gray-600">
            Requires Node.js 18+. The server runs locally and connects to
            Abstract mainnet.
          </p>
        </div>
      </section>

      {/* ---- TOKEN TYPES ---- */}
      <section id="types" className="border-b-2 border-black px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            Token Types
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
            {TOKEN_TYPES.map((t) => (
              <div
                key={t.id}
                className="border-2 border-black p-5 -mt-[2px] -ml-[2px]"
              >
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-bold">{t.name}</span>
                  <span className="text-xs text-gray-500">
                    type {t.id}
                  </span>
                </div>
                <p className="text-sm leading-snug">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- WHY ABSTRACT ---- */}
      <section className="border-b-2 border-black px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            Why Abstract
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
            <div className="border-2 border-black p-5 -mt-[2px] -ml-[2px]">
              <h3 className="font-bold mb-1">Sub-cent gas</h3>
              <p className="text-sm">
                Minting costs fractions of a penny. Agents can operate at scale
                without draining wallets.
              </p>
            </div>
            <div className="border-2 border-black p-5 -mt-[2px] -ml-[2px]">
              <h3 className="font-bold mb-1">Native AA</h3>
              <p className="text-sm">
                Account abstraction is built into the chain. Smart wallets,
                paymasters, and batch transactions out of the box.
              </p>
            </div>
            <div className="border-2 border-black p-5 -mt-[2px] -ml-[2px]">
              <h3 className="font-bold mb-1">Consumer chain</h3>
              <p className="text-sm">
                Abstract is designed for consumer apps. Fast finality, clean
                explorer, growing ecosystem.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---- LIVE STATS ---- */}
      <section className="border-b-2 border-black px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs uppercase tracking-widest mb-4">
            Live from Abstract
          </h2>
          <div className="border-2 border-black p-6 inline-block">
            <div className="text-xs uppercase tracking-wider mb-1">
              Total Supply
            </div>
            <div className="text-5xl md:text-6xl font-bold">
              {stats.totalSupply}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              tokens etched
            </div>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section id="faq" className="border-b-2 border-black px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            FAQ
          </h2>
          <div className="divide-y-2 divide-black border-2 border-black">
            {FAQ_ITEMS.map((item, i) => (
              <div key={i} className="p-5">
                <h3 className="font-bold mb-2">{item.q}</h3>
                <p className="text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- FOOTER ---- */}
      <footer className="px-4 py-8">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="font-bold text-lg">ETCH</span>
            <span className="text-sm ml-2 text-gray-500">
              by{" "}
              <a
                href="https://ack-onchain.dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                ACK Protocol
              </a>
            </span>
          </div>
          <div className="flex gap-4 text-sm">
            <a
              href="https://github.com/tyler-james-bridges/etch"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline hover:underline"
            >
              GitHub
            </a>
            <a
              href="https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline hover:underline"
            >
              Contract
            </a>
            <Link href="/etch/1" className="no-underline hover:underline">
              Explorer
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import {
  publicClientAbstract,
  publicClientBase,
  ETCH_ADDRESS_ABSTRACT,
  ETCH_ADDRESS_BASE,
  ETCH_ABI,
  TOKEN_TYPE_LABELS,
} from "@/lib/contract";
import { CopyButton } from "@/components/CopyButton";
import { generateEtchSvg } from "@/lib/art-svg";
import { EtchWordmark } from "@/components/EtchWordmark";
import { ThemeToggle } from "@/components/ThemeToggle";
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
    a: "An ERC-721 contract on Abstract and Base that lets AI agents mint typed, optionally soulbound tokens. Think of it as a protocol-level primitive for onchain records.",
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
    a: "Minting via the web app is free (we cover gas). MCP minting requires a small amount of ETH on Abstract or Base for gas. No protocol fees either way.",
  },
  {
    q: "What is the ERC-8004 agent registration?",
    a: "When you create an Identity token, you can also register as an ERC-8004 agent. This gives you a permanent onchain agent identity with a metadata profile, discoverable by other agents and protocols.",
  },
  {
    q: "Which chains are supported?",
    a: "ETCH is deployed on Abstract and Base. Both offer sub-cent gas and fast finality. Choose your chain when minting.",
  },
];

type TokenInfo = {
  id: number;
  tokenType: number;
  soulbound: boolean;
  owner: string;
  svg: string;
};

async function getStats() {
  const [abstractSupply, baseSupply] = await Promise.all([
    publicClientAbstract.readContract({
      address: ETCH_ADDRESS_ABSTRACT,
      abi: ETCH_ABI,
      functionName: "totalSupply",
    }),
    publicClientBase.readContract({
      address: ETCH_ADDRESS_BASE,
      abi: ETCH_ABI,
      functionName: "totalSupply",
    }).catch(() => 0n),
  ]);

  const abstractTotal = Number(abstractSupply);
  const baseTotal = Number(baseSupply);
  const combinedTotal = abstractTotal + baseTotal;

  // Fetch recent tokens from Abstract (up to 8, newest first)
  const count = Math.min(abstractTotal, 8);
  const recentTokens: TokenInfo[] = [];

  for (let i = abstractTotal - 1; i >= abstractTotal - count && i >= 0; i--) {
    try {
      const tokenId = await publicClientAbstract.readContract({
        address: ETCH_ADDRESS_ABSTRACT,
        abi: ETCH_ABI,
        functionName: "tokenByIndex",
        args: [BigInt(i)],
      });

      const [tokenType, soulbound, owner] = await Promise.all([
        publicClientAbstract.readContract({
          address: ETCH_ADDRESS_ABSTRACT,
          abi: ETCH_ABI,
          functionName: "tokenType",
          args: [tokenId as bigint],
        }),
        publicClientAbstract.readContract({
          address: ETCH_ADDRESS_ABSTRACT,
          abi: ETCH_ABI,
          functionName: "isSoulbound",
          args: [tokenId as bigint],
        }),
        publicClientAbstract.readContract({
          address: ETCH_ADDRESS_ABSTRACT,
          abi: ETCH_ABI,
          functionName: "ownerOf",
          args: [tokenId as bigint],
        }),
      ]);

      const id = Number(tokenId);
      const type = Number(tokenType);
      recentTokens.push({
        id,
        tokenType: type,
        soulbound: soulbound as boolean,
        owner: owner as string,
        svg: generateEtchSvg(id, type),
      });
    } catch {
      // Skip tokens that fail to load
    }
  }

  return {
    totalSupply: combinedTotal,
    abstractSupply: abstractTotal,
    baseSupply: baseTotal,
    recentTokens,
    hasMore: abstractTotal > count,
  };
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="min-h-screen">
      {/* ---- NAV ---- */}
      <nav className="sticky top-0 z-50 bg-[var(--background)] border-b-2 border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <EtchWordmark size="sm" />
        <div className="flex items-center gap-4 text-sm">
          <Link href="/create" className="no-underline hover:underline font-bold">
            Create
          </Link>
          <a href="#setup" className="hidden sm:inline no-underline hover:underline">
            Setup
          </a>
          <a href="#types" className="hidden sm:inline no-underline hover:underline">
            Types
          </a>
          <a href="#faq" className="hidden sm:inline no-underline hover:underline">
            FAQ
          </a>
          <a
            href="https://github.com/tyler-james-bridges/etch"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline no-underline hover:underline"
          >
            GitHub
          </a>
          <ThemeToggle />
        </div>
      </nav>

      {/* ---- HERO ---- */}
      <section className="border-b-2 border-[var(--border)] px-4 py-20 md:py-32 max-w-4xl mx-auto">
        <div>
          <EtchWordmark size="lg" />
        </div>
        <p className="mt-4 text-lg md:text-xl max-w-xl">
          Permanent onchain records with generative art on Abstract and Base.
          For AI agents via MCP. For humans via the web.
          Optionally register as an ERC-8004 agent in one click.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/create"
            className="bg-[var(--foreground)] text-[var(--background)] px-5 py-2 text-sm font-bold uppercase tracking-wider no-underline hover:opacity-90 transition-colors"
          >
            Create
          </Link>
          <a
            href="#setup"
            className="border-2 border-[var(--border)] px-5 py-2 text-sm font-bold uppercase tracking-wider no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
          >
            MCP Setup
          </a>
          <a
            href="https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C"
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-[var(--border)] px-5 py-2 text-sm font-bold uppercase tracking-wider no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
          >
            Abstract Contract
          </a>
          <a
            href="https://basescan.org/address/0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459"
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-[var(--border)] px-5 py-2 text-sm font-bold uppercase tracking-wider no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
          >
            Base Contract
          </a>
        </div>
      </section>

      {/* ---- GALLERY ---- */}
      {stats.recentTokens.length > 0 && (
        <section className="border-b-2 border-[var(--border)] px-4 py-12 md:py-16">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                Recent Etches
              </h2>
              <Link
                href="/create"
                className="border-2 border-[var(--border)] px-4 py-1.5 text-xs font-bold uppercase tracking-wider no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
              >
                Create
              </Link>
            </div>
            {stats.recentTokens.length === 1 ? (
              <Link
                href={`/etch/${stats.recentTokens[0].id}`}
                className="border-2 border-[var(--border)] no-underline hover:bg-[var(--surface)] transition-colors block max-w-sm mx-auto"
              >
                <div
                  className="[&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
                  dangerouslySetInnerHTML={{ __html: stats.recentTokens[0].svg }}
                />
                <div className="p-4 border-t-2 border-[var(--border)]">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">ETCH #{stats.recentTokens[0].id}</span>
                    <span className="text-sm text-[var(--muted)]">
                      {TOKEN_TYPE_LABELS[stats.recentTokens[0].tokenType] || "Unknown"}
                    </span>
                  </div>
                  {stats.recentTokens[0].soulbound && (
                    <span className="text-xs uppercase tracking-wider text-[var(--muted-light)]">
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
                    className="border-2 border-[var(--border)] -mt-[2px] -ml-[2px] no-underline hover:bg-[var(--surface)] transition-colors group"
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
                      {token.soulbound && (
                        <span className="text-[10px] uppercase tracking-wider text-[var(--muted-light)]">
                          Soulbound
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
            {stats.hasMore && (
              <div className="mt-6 text-center">
                <Link
                  href={`/etch/${stats.recentTokens[stats.recentTokens.length - 1]?.id ?? 0}`}
                  className="border-2 border-[var(--border)] px-6 py-2 text-sm font-bold uppercase tracking-wider no-underline hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
                >
                  View all {stats.totalSupply} etches
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ---- TERMINAL DEMO ---- */}
      <section className="border-b-2 border-[var(--border)] px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs uppercase tracking-widest mb-4">
            How it works
          </h2>
          <div className="border-2 border-[var(--border)] bg-black text-green-400 p-6 overflow-x-auto">
            <pre className="text-sm leading-relaxed whitespace-pre">
              <span className="text-[var(--muted)]">{"// You talk to your agent"}</span>
              {"\n"}
              <span className="text-white">{">"}</span>
              {" Etch a soulbound credential for 0xAb5...3fC\n\n"}
              <span className="text-[var(--muted)]">{"// Agent calls ETCH via MCP"}</span>
              {"\n"}
              <span className="text-blue-400">etch</span>
              {"({\n"}
              {"  to: \"0xAb5...3fC\",\n"}
              {"  name: \"Audit Verified\",\n"}
              {"  tokenType: \"credential\",\n"}
              {"  soulbound: true\n"}
              {"})\n\n"}
              <span className="text-[var(--muted)]">{"// Generative art + metadata minted onchain"}</span>
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
      <section id="setup" className="border-b-2 border-[var(--border)] px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">
            Setup
          </h2>
          <p className="text-sm mb-6 max-w-xl">
            Add the ETCH MCP server to your agent config. Works with Claude
            Desktop, Cursor, Windsurf, and any MCP-compatible client.
          </p>
          <div className="border-2 border-[var(--border)]">
            <div className="flex items-center justify-between border-b-2 border-[var(--border)] px-4 py-2 bg-[var(--surface)]">
              <span className="text-xs uppercase tracking-wider font-bold">
                mcp.json
              </span>
              <CopyButton text={MCP_CONFIG} />
            </div>
            <pre className="p-4 text-sm overflow-x-auto">{MCP_CONFIG}</pre>
          </div>
          <p className="text-xs mt-3 text-[var(--muted)]">
            Requires Node.js 18+. The server runs locally and connects to
            Abstract and Base mainnets.
          </p>
        </div>
      </section>

      {/* ---- TOKEN TYPES ---- */}
      <section id="types" className="border-b-2 border-[var(--border)] px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            Token Types
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0">
            {TOKEN_TYPES.map((t) => (
              <div
                key={t.id}
                className="border-2 border-[var(--border)] p-5 -mt-[2px] -ml-[2px]"
              >
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-bold">{t.name}</span>
                  <span className="text-xs text-[var(--muted)]">
                    type {t.id}
                  </span>
                </div>
                <p className="text-sm leading-snug">{t.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- SUPPORTED CHAINS ---- */}
      <section className="border-b-2 border-[var(--border)] px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            Supported Chains
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            <div className="border-2 border-[var(--border)] p-5 -mt-[2px] -ml-[2px]">
              <h3 className="font-bold mb-1">Abstract</h3>
              <p className="text-sm">
                Sub-cent gas, native account abstraction, and a chain built for
                consumer crypto. ERC-8004 agent registry available.
              </p>
              <a
                href="https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs mt-2 inline-block"
              >
                View on Abscan
              </a>
            </div>
            <div className="border-2 border-[var(--border)] p-5 -mt-[2px] -ml-[2px]">
              <h3 className="font-bold mb-1">Base</h3>
              <p className="text-sm">
                Coinbase&apos;s L2 with massive adoption, low gas, and deep
                liquidity. Same ETCH contract, same generative art.
              </p>
              <a
                href="https://basescan.org/address/0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs mt-2 inline-block"
              >
                View on Basescan
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---- LIVE STATS ---- */}
      <section className="border-b-2 border-[var(--border)] px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs uppercase tracking-widest mb-4">
            Live Stats
          </h2>
          <div className="flex flex-wrap gap-0">
            <div className="border-2 border-[var(--border)] p-6 -ml-[2px] -mt-[2px]">
              <div className="text-xs uppercase tracking-wider mb-1">
                Total Supply
              </div>
              <div className="text-5xl md:text-6xl font-bold">
                {stats.totalSupply}
              </div>
              <div className="text-xs text-[var(--muted)] mt-1">
                tokens etched
              </div>
            </div>
            <div className="border-2 border-[var(--border)] p-6 -ml-[2px] -mt-[2px]">
              <div className="text-xs uppercase tracking-wider mb-1">
                Abstract
              </div>
              <div className="text-3xl md:text-4xl font-bold">
                {stats.abstractSupply}
              </div>
            </div>
            <div className="border-2 border-[var(--border)] p-6 -ml-[2px] -mt-[2px]">
              <div className="text-xs uppercase tracking-wider mb-1">
                Base
              </div>
              <div className="text-3xl md:text-4xl font-bold">
                {stats.baseSupply}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section id="faq" className="border-b-2 border-[var(--border)] px-4 py-12 md:py-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            FAQ
          </h2>
          <div className="divide-y-2 divide-black border-2 border-[var(--border)]">
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
            <span className="text-sm ml-2 text-[var(--muted)]">
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
              Abstract
            </a>
            <a
              href="https://basescan.org/address/0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459"
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline hover:underline"
            >
              Base
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

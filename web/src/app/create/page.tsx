"use client";

import { useState, useMemo, useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { generateEtchSvg } from "@/lib/art-svg";
import Link from "next/link";

const TOKEN_TYPES = [
  { label: "Identity", value: 0 },
  { label: "Attestation", value: 1 },
  { label: "Credential", value: 2 },
  { label: "Receipt", value: 3 },
  { label: "Pass", value: 4 },
] as const;

const SOULBOUND_DEFAULTS: Record<number, boolean> = {
  0: true, // Identity
  1: true, // Attestation
  2: true, // Credential
  3: false, // Receipt
  4: false, // Pass
};

function hashCode(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

type MintState =
  | { status: "idle" }
  | { status: "minting" }
  | { status: "success"; tokenId: number; txHash: string }
  | { status: "error"; message: string };

export default function CreatePage() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tokenType, setTokenType] = useState(0);
  const [soulbound, setSoulbound] = useState(true);
  const [mintState, setMintState] = useState<MintState>({ status: "idle" });

  // Generate preview art from wallet address hash
  const previewSvg = useMemo(() => {
    const seed = address ? hashCode(address) : 12345;
    return generateEtchSvg(seed, tokenType);
  }, [address, tokenType]);

  const handleTokenTypeChange = useCallback((newType: number) => {
    setTokenType(newType);
    setSoulbound(SOULBOUND_DEFAULTS[newType] ?? true);
  }, []);

  const handleMint = useCallback(async () => {
    if (!address || !name.trim()) return;

    setMintState({ status: "minting" });

    try {
      const res = await fetch("/api/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: address,
          name: name.trim(),
          description: description.trim(),
          tokenType,
          soulbound,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMintState({
          status: "error",
          message: data.error || "Mint failed",
        });
        return;
      }

      setMintState({
        status: "success",
        tokenId: data.tokenId,
        txHash: data.txHash,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Network error";
      setMintState({ status: "error", message });
    }
  }, [address, name, description, tokenType, soulbound]);

  return (
    <div className="min-h-screen">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-white border-b-2 border-black px-4 py-3 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold tracking-tight no-underline">
          ETCH
        </Link>
        <div className="flex gap-4 text-sm items-center">
          <Link href="/create" className="no-underline hover:underline font-bold">
            Create
          </Link>
          <a
            href="https://github.com/ack-protocol/etch"
            target="_blank"
            rel="noopener noreferrer"
            className="no-underline hover:underline"
          >
            GitHub
          </a>
          {isConnected ? (
            <button
              onClick={() => disconnect()}
              className="border-2 border-black px-3 py-1 text-xs font-bold hover:bg-black hover:text-white transition-colors"
            >
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="border-2 border-black px-3 py-1 text-xs font-bold hover:bg-black hover:text-white transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <div className="max-w-6xl mx-auto px-4 py-8 md:py-16">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tighter mb-8">
          Create ETCH
        </h1>

        {/* Success state */}
        {mintState.status === "success" && (
          <div className="border-2 border-black p-6 mb-8">
            <div className="text-2xl font-bold mb-2">Minted</div>
            <p className="text-sm mb-4">
              ETCH #{mintState.tokenId} has been etched onchain.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/etch/${mintState.tokenId}`}
                className="bg-black text-white px-5 py-2 text-sm font-bold no-underline hover:bg-gray-800 transition-colors"
              >
                View Token
              </Link>
              <a
                href={`https://abscan.org/tx/${mintState.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="border-2 border-black px-5 py-2 text-sm font-bold no-underline hover:bg-black hover:text-white transition-colors"
              >
                View Transaction
              </a>
              <button
                onClick={() => {
                  setMintState({ status: "idle" });
                  setName("");
                  setDescription("");
                }}
                className="border-2 border-black px-5 py-2 text-sm font-bold hover:bg-black hover:text-white transition-colors"
              >
                Mint Another
              </button>
            </div>
          </div>
        )}

        {/* Form + Preview layout */}
        {mintState.status !== "success" && (
          <div className="flex flex-col md:flex-row gap-8">
            {/* Art Preview - left side */}
            <div className="md:w-1/2">
              <div className="text-xs uppercase tracking-widest mb-3 font-bold">
                Art Preview
              </div>
              <div
                className="border-2 border-black w-full aspect-square"
                dangerouslySetInnerHTML={{ __html: previewSvg }}
              />
              <p className="text-xs text-gray-500 mt-2">
                Final art is generated from the token ID at mint time.
                This preview is based on your wallet address.
              </p>
            </div>

            {/* Form - right side */}
            <div className="md:w-1/2">
              <div className="text-xs uppercase tracking-widest mb-3 font-bold">
                Token Details
              </div>

              {!isConnected && (
                <div className="border-2 border-black p-6 mb-6">
                  <p className="text-sm mb-4">
                    Connect your wallet to provide a recipient address.
                  </p>
                  <button
                    onClick={() => connect({ connector: injected() })}
                    className="bg-black text-white px-6 py-3 font-bold hover:bg-gray-800 transition-colors w-full"
                  >
                    Connect Wallet
                  </button>
                </div>
              )}

              <div className="space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-xs uppercase tracking-widest font-bold mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="My onchain record"
                    className="w-full border-2 border-black px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-0 focus:border-black placeholder:text-gray-400"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs uppercase tracking-widest font-bold mb-1">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="What this record represents"
                    rows={3}
                    className="w-full border-2 border-black px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-0 focus:border-black placeholder:text-gray-400 resize-none"
                  />
                </div>

                {/* Token Type */}
                <div>
                  <label className="block text-xs uppercase tracking-widest font-bold mb-1">
                    Token Type
                  </label>
                  <select
                    value={tokenType}
                    onChange={(e) =>
                      handleTokenTypeChange(Number(e.target.value))
                    }
                    className="w-full border-2 border-black px-3 py-2 text-sm font-mono bg-white focus:outline-none focus:ring-0 focus:border-black appearance-none"
                  >
                    {TOKEN_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Soulbound */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="soulbound"
                    checked={soulbound}
                    onChange={(e) => setSoulbound(e.target.checked)}
                    className="w-5 h-5 border-2 border-black accent-black"
                  />
                  <label htmlFor="soulbound" className="text-sm">
                    <span className="font-bold">Soulbound</span>
                    <span className="text-gray-500 ml-1">
                      -- cannot be transferred after mint
                    </span>
                  </label>
                </div>

                {/* Error */}
                {mintState.status === "error" && (
                  <div className="border-2 border-black bg-white p-3">
                    <p className="text-sm text-red-600 font-bold">
                      {mintState.message}
                    </p>
                  </div>
                )}

                {/* Mint Button */}
                <button
                  onClick={handleMint}
                  disabled={
                    !isConnected ||
                    !name.trim() ||
                    mintState.status === "minting"
                  }
                  className="w-full bg-black text-white px-6 py-3 font-bold text-sm uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed mt-4"
                >
                  {mintState.status === "minting"
                    ? "Minting..."
                    : "Mint ETCH"}
                </button>

                {isConnected && (
                  <p className="text-xs text-gray-500">
                    Minting to {address}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

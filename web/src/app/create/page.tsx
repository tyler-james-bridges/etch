"use client";

import { useState, useMemo, useCallback } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { generateEtchSvg } from "@/lib/art-svg";
import Link from "next/link";

const TOKEN_TYPES = [
  { label: "Identity", value: 0, desc: "Onchain identity record" },
  { label: "Attestation", value: 1, desc: "Verified claim or proof" },
  { label: "Credential", value: 2, desc: "Earned qualification" },
  { label: "Receipt", value: 3, desc: "Transaction or event record" },
  { label: "Pass", value: 4, desc: "Access or membership token" },
] as const;

const SOULBOUND_DEFAULTS: Record<number, boolean> = {
  0: true,
  1: true,
  2: true,
  3: false,
  4: false,
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
        setMintState({ status: "error", message: data.error || "Mint failed" });
        return;
      }

      setMintState({ status: "success", tokenId: data.tokenId, txHash: data.txHash });
    } catch (err: unknown) {
      setMintState({ status: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }, [address, name, description, tokenType, soulbound]);

  const canMint = isConnected && name.trim().length > 0 && mintState.status !== "minting";
  const selectedType = TOKEN_TYPES.find((t) => t.value === tokenType);

  if (mintState.status === "success") {
    return (
      <div className="max-w-md mx-auto text-center py-12">
        <div className="text-4xl mb-4 font-bold">*</div>
        <h2 className="text-2xl font-bold mb-2">Etched</h2>
        <p className="text-sm mb-6">
          ETCH #{mintState.tokenId} is permanently onchain.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href={`/etch/${mintState.tokenId}`}
            className="bg-black text-white px-6 py-3 font-bold no-underline hover:bg-gray-800 transition-colors text-center"
          >
            View Token
          </Link>
          <a
            href={`https://abscan.org/tx/${mintState.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="border-2 border-black px-6 py-3 font-bold no-underline hover:bg-black hover:text-white transition-colors text-center"
          >
            View Transaction
          </a>
          <button
            onClick={() => {
              setMintState({ status: "idle" });
              setName("");
              setDescription("");
            }}
            className="border-2 border-black px-6 py-3 font-bold hover:bg-black hover:text-white transition-colors"
          >
            Mint Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Create ETCH</h1>
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
            className="bg-black text-white px-4 py-2 text-sm font-bold hover:bg-gray-800 transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* Art preview centered */}
      <div className="flex justify-center">
        <div
          className="border-2 border-black w-[320px] h-[320px] overflow-hidden [&>svg]:w-full [&>svg]:h-full [&>svg]:block"
          dangerouslySetInnerHTML={{ __html: previewSvg }}
        />
      </div>
      <p className="text-xs text-gray-400 text-center">
        Preview based on your wallet. Final art is unique to the token ID.
      </p>

      {/* Form in a bordered container */}
      <div className="border-2 border-black p-5 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-widest font-bold mb-1">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My onchain record"
            className="w-full border-2 border-black px-3 py-2 text-sm font-mono bg-white focus:outline-none placeholder:text-gray-400"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest font-bold mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What this record represents"
            rows={2}
            className="w-full border-2 border-black px-3 py-2 text-sm font-mono bg-white focus:outline-none placeholder:text-gray-400 resize-none"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest font-bold mb-2">
            Type
          </label>
          <div className="flex flex-wrap gap-2">
            {TOKEN_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => handleTokenTypeChange(t.value)}
                className={`border-2 px-3 py-1.5 text-xs font-bold transition-colors ${
                  tokenType === t.value
                    ? "border-black bg-black text-white"
                    : "border-black hover:bg-gray-100"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {selectedType && (
            <p className="text-xs text-gray-400 mt-1">{selectedType.desc}</p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="soulbound"
            checked={soulbound}
            onChange={(e) => setSoulbound(e.target.checked)}
            className="w-4 h-4 border-2 border-black accent-black"
          />
          <label htmlFor="soulbound" className="text-sm">
            <span className="font-bold">Soulbound</span>
            <span className="text-gray-400 ml-1">
              {" "}cannot be transferred
            </span>
          </label>
        </div>
      </div>

      {mintState.status === "error" && (
        <p className="text-sm text-red-600 font-bold">{mintState.message}</p>
      )}

      <button
        onClick={handleMint}
        disabled={!canMint}
        className="w-full bg-black text-white px-6 py-3 font-bold text-sm uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
      >
        {mintState.status === "minting" ? "Minting..." : "Mint ETCH"}
      </button>

      <p className="text-xs text-gray-400 text-center">
        {isConnected
          ? `Minting to ${address}. Zero gas.`
          : "Connect wallet to mint. Zero gas, we cover it."}
      </p>
    </div>
  );
}

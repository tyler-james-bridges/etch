"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useWriteContract,
  useWaitForTransactionReceipt,
  useSwitchChain,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { abstract, base } from "wagmi/chains";
import { generateEtchSvg } from "@/lib/art-svg";
import {
  ETCH_ADDRESS_ABSTRACT,
  ETCH_ADDRESS_BASE,
  IDENTITY_REGISTRY_ADDRESS_ABSTRACT,
  IDENTITY_REGISTRY_ADDRESS_BASE,
  IDENTITY_REGISTRY_ABI,
} from "@/lib/contract";
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

const REGISTER_8004_DEFAULTS: Record<number, boolean> = {
  0: true,
  1: false,
  2: false,
  3: false,
  4: false,
};

const ETCH_ADDRESS_BY_CHAIN = {
  abstract: ETCH_ADDRESS_ABSTRACT,
  base: ETCH_ADDRESS_BASE,
} as const;

const REGISTRY_ADDRESS_BY_CHAIN = {
  abstract: IDENTITY_REGISTRY_ADDRESS_ABSTRACT,
  base: IDENTITY_REGISTRY_ADDRESS_BASE,
} as const;

const EXPLORER_BY_CHAIN = {
  abstract: "https://abscan.org",
  base: "https://basescan.org",
} as const;

const OPENSEA_CHAIN_BY_CHAIN = {
  abstract: "abstract",
  base: "base",
} as const;

function hashCode(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 1;
}

type CreateStep =
  | "idle"
  | "minting"
  | "mint-done"
  | "switching-chain"
  | "sign-register"
  | "confirming-register"
  | "success"
  | "error";

interface CreateResult {
  tokenId: number;
  mintTxHash: string;
  chain: "abstract" | "base";
  registerTxHash?: string;
  agentId?: string;
}

export default function CreatePage() {
  const { address, isConnected, chainId } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tokenType, setTokenType] = useState(0);
  const [soulbound, setSoulbound] = useState(true);
  const [mintChain, setMintChain] = useState<"abstract" | "base">("abstract");
  const [register8004, setRegister8004] = useState(true);

  const registryConfigured = useMemo(() => {
    const registry = REGISTRY_ADDRESS_BY_CHAIN[mintChain];
    return typeof registry === "string" && registry.length === 42 && registry.startsWith("0x");
  }, [mintChain]);
  const [step, setStep] = useState<CreateStep>("idle");
  const [result, setResult] = useState<CreateResult | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const {
    writeContract,
    data: registerTxHash,
    reset: resetWriteContract,
  } = useWriteContract();

  const { data: registerReceipt } = useWaitForTransactionReceipt({
    hash: registerTxHash,
  });

  const previewSvg = useMemo(() => {
    const seed = address ? hashCode(address) : 12345;
    return generateEtchSvg(seed, tokenType);
  }, [address, tokenType]);

  const handleTokenTypeChange = useCallback((newType: number) => {
    setTokenType(newType);
    setSoulbound(SOULBOUND_DEFAULTS[newType] ?? true);
    const shouldRegister = REGISTER_8004_DEFAULTS[newType] ?? false;
    setRegister8004(registryConfigured ? shouldRegister : false);
  }, [registryConfigured]);

  // Handle register tx confirmation
  const handleRegisterConfirmed = useCallback(
    (receipt: NonNullable<typeof registerReceipt>, currentResult: CreateResult) => {
      // Try to extract agentId from logs
      let agentId: string | undefined;
      try {
        // The register function returns agentId - check logs for it
        // Look for a Transfer or similar event that contains the agentId
        for (const log of receipt.logs) {
          const expectedRegistry = REGISTRY_ADDRESS_BY_CHAIN[currentResult.chain];
          if (log.address.toLowerCase() === expectedRegistry.toLowerCase()) {
            // ERC-721 Transfer: topic[3] is tokenId when indexed
            if (log.topics.length > 3) {
              agentId = BigInt(log.topics[3] as string).toString();
              break;
            }
          }
        }
      } catch {
        // agentId extraction is best-effort
      }

      setResult({
        ...currentResult,
        registerTxHash: receipt.transactionHash,
        agentId,
      });
      setStep("success");
    },
    []
  );

  // Watch for register receipt changes
  useMemo(() => {
    if (registerReceipt && step === "confirming-register" && result) {
      handleRegisterConfirmed(registerReceipt, result);
    }
  }, [registerReceipt, step, result, handleRegisterConfirmed]);

  const handleCreate = useCallback(async () => {
    if (!address || !name.trim()) return;

    setStep("minting");
    setErrorMessage("");
    resetWriteContract();

    try {
      // Step 1: Mint ETCH token via server
      const res = await fetch("/api/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: address,
          name: name.trim(),
          description: description.trim(),
          tokenType,
          soulbound,
          chain: mintChain,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setStep("error");
        setErrorMessage(data.error || "Mint failed");
        return;
      }

      const mintResult: CreateResult = {
        tokenId: data.tokenId,
        mintTxHash: data.txHash,
        chain: (data.chain || mintChain) as "abstract" | "base",
      };
      setResult(mintResult);

      // If not registering 8004, we are done
      if (!register8004) {
        setResult(mintResult);
        setStep("success");
        return;
      }

      setStep("mint-done");

      const targetRegisterChainId = mintChain === "base" ? base.id : abstract.id;
      const registryAddress = REGISTRY_ADDRESS_BY_CHAIN[mintChain];

      if (!registryConfigured) {
        setStep("error");
        setErrorMessage(`ERC-8004 registry is not configured for ${mintChain}.`);
        return;
      }

      // Step 2: Check chain and switch if needed
      if (chainId !== targetRegisterChainId) {
        setStep("switching-chain");
        try {
          switchChain({ chainId: targetRegisterChainId });
        } catch {
          setStep("error");
          setErrorMessage(`Failed to switch to ${mintChain} chain. Please switch manually and try again.`);
          return;
        }
      }

      // Step 3: Prompt user to sign register() tx
      setStep("sign-register");
      const agentURI = `https://etch.ack-onchain.dev/api/agent/${address}?chain=${mintChain}`;

      writeContract(
        {
          address: registryAddress,
          abi: IDENTITY_REGISTRY_ABI,
          functionName: "register",
          args: [agentURI],
          chainId: targetRegisterChainId,
        },
        {
          onSuccess: () => {
            setStep("confirming-register");
          },
          onError: (err) => {
            // User rejected or tx failed - still show success for the mint
            setResult(mintResult);
            setStep("success");
            console.error("Register tx error:", err.message);
          },
        }
      );
    } catch (err: unknown) {
      setStep("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Something went wrong"
      );
    }
  }, [
    address,
    name,
    description,
    tokenType,
    soulbound,
    register8004,
    chainId,
    switchChain,
    writeContract,
    resetWriteContract,
  ]);

  const canCreate =
    isConnected && name.trim().length > 0 && step === "idle";
  const selectedType = TOKEN_TYPES.find((t) => t.value === tokenType);
  const isProcessing =
    step !== "idle" && step !== "success" && step !== "error";

  // Success state
  if (step === "success" && result) {
    const has8004 = !!result.registerTxHash;
    const explorerBase = EXPLORER_BY_CHAIN[result.chain];
    const etchAddress = ETCH_ADDRESS_BY_CHAIN[result.chain];
    const registryAddress = REGISTRY_ADDRESS_BY_CHAIN[result.chain];
    const openseaChain = OPENSEA_CHAIN_BY_CHAIN[result.chain];
    return (
      <div className="max-w-xl mx-auto py-12 space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-4 font-bold">*</div>
          <h2 className="text-2xl font-bold mb-2">
            {has8004 ? "Your agent is live" : "Etched"}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            ETCH #{result.tokenId}
            {has8004 ? " + ERC-8004 Agent" : ""} is permanently onchain.
          </p>
        </div>

        <div className="border-2 border-[var(--border)] p-5 space-y-3">
          <p className="text-xs uppercase tracking-widest font-bold">
            ETCH Token
          </p>
          <div className="space-y-2 text-sm">
            <a
              href={`https://etch.ack-onchain.dev/etch/${result.tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block underline break-all"
            >
              etch.ack-onchain.dev/etch/{result.tokenId}
            </a>
            <a
              href={`${explorerBase}/token/${etchAddress}?a=${result.tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block underline break-all"
            >
              Explorer Token ({result.chain})
            </a>
            <a
              href={`${explorerBase}/tx/${result.mintTxHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block underline break-all"
            >
              Explorer Tx (mint)
            </a>
            <a
              href={`https://opensea.io/item/${openseaChain}/${etchAddress}/${result.tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block underline break-all"
            >
              OpenSea
            </a>
          </div>
        </div>

        {has8004 && (
          <div className="border-2 border-[var(--border)] p-5 space-y-3">
            <p className="text-xs uppercase tracking-widest font-bold">
              ERC-8004 Agent
            </p>
            <div className="space-y-2 text-sm">
              <a
                href={`https://etch.ack-onchain.dev/api/agent/${address}?chain=${result.chain}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block underline break-all"
              >
                Agent Profile (JSON)
              </a>
              {result.agentId && (
                <a
                  href={`https://8004scan.com/agent/${result.agentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block underline break-all"
                >
                  8004scan Profile
                </a>
              )}
              <a
                href={`${explorerBase}/tx/${result.registerTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block underline break-all"
              >
                Abscan Tx (register)
              </a>
              <a
                href={`${explorerBase}/address/${registryAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block underline break-all"
              >
                Registry on Abscan
              </a>
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setStep("idle");
            setResult(null);
            setName("");
            setDescription("");
            resetWriteContract();
          }}
          className="w-full border-2 border-[var(--border)] px-6 py-3 font-bold hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
        >
          Create Another
        </button>
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
            className="border-2 border-[var(--border)] px-3 py-1 text-xs font-bold hover:bg-[var(--foreground)] hover:text-[var(--background)] transition-colors"
          >
            {address?.slice(0, 6)}...{address?.slice(-4)}
          </button>
        ) : (
          <button
            onClick={() => connect({ connector: injected() })}
            className="bg-[var(--foreground)] text-[var(--background)] px-4 py-2 text-sm font-bold hover:opacity-90 transition-colors"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {/* Art preview */}
      <div
        className="border-2 border-[var(--border)] w-full max-w-xl mx-auto overflow-hidden [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
        dangerouslySetInnerHTML={{ __html: previewSvg }}
      />
      <p className="text-xs text-[var(--muted-light)] text-center">
        Preview based on your wallet. Final art is unique to the token ID.
      </p>

      {/* Form */}
      <div className="border-2 border-[var(--border)] p-5 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-widest font-bold mb-1">
            Name *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My onchain record"
            disabled={isProcessing}
            className="w-full border-2 border-[var(--border)] px-3 py-2 text-sm font-mono bg-[var(--background)] focus:outline-none placeholder:text-[var(--muted-light)] disabled:bg-[var(--surface)]"
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
            disabled={isProcessing}
            className="w-full border-2 border-[var(--border)] px-3 py-2 text-sm font-mono bg-[var(--background)] focus:outline-none placeholder:text-[var(--muted-light)] resize-none disabled:bg-[var(--surface)]"
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
                disabled={isProcessing}
                className={`border-2 px-3 py-1.5 text-xs font-bold transition-colors ${
                  tokenType === t.value
                    ? "border-[var(--border)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] hover:bg-[var(--surface)]"
                } disabled:opacity-50`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {selectedType && (
            <p className="text-xs text-[var(--muted-light)] mt-1">{selectedType.desc}</p>
          )}
        </div>

        <div>
          <label className="block text-xs uppercase tracking-widest font-bold mb-2">
            Chain
          </label>
          <div className="flex flex-wrap gap-2">
            {([
              ["abstract", "Abstract"],
              ["base", "Base"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                onClick={() => {
                  setMintChain(value);
                  const hasRegistry =
                    value === "abstract"
                      ? !!IDENTITY_REGISTRY_ADDRESS_ABSTRACT
                      : !!IDENTITY_REGISTRY_ADDRESS_BASE;
                  const shouldRegister = REGISTER_8004_DEFAULTS[tokenType] ?? false;
                  setRegister8004(hasRegistry ? shouldRegister : false);
                }}
                disabled={isProcessing}
                className={`border-2 px-3 py-1.5 text-xs font-bold transition-colors ${
                  mintChain === value
                    ? "border-[var(--border)] bg-[var(--foreground)] text-[var(--background)]"
                    : "border-[var(--border)] hover:bg-[var(--surface)]"
                } disabled:opacity-50`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="soulbound"
            checked={soulbound}
            onChange={(e) => setSoulbound(e.target.checked)}
            disabled={isProcessing}
            className="w-4 h-4 border-2 border-[var(--border)] accent-black"
          />
          <label htmlFor="soulbound" className="text-sm">
            <span className="font-bold">Soulbound</span>
            <span className="text-[var(--muted-light)] ml-1">
              {" "}
              cannot be transferred
            </span>
          </label>
        </div>

        <div className="border-t-2 border-[var(--border)] pt-4 mt-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="register8004"
              checked={register8004}
              onChange={(e) => setRegister8004(e.target.checked)}
              disabled={isProcessing || !registryConfigured}
              className="w-4 h-4 border-2 border-[var(--border)] accent-black"
            />
            <label htmlFor="register8004" className="text-sm">
              <span className="font-bold">Register as ERC-8004 Agent</span>
            </label>
          </div>
          {!registryConfigured ? (
            <p className="text-xs text-[var(--muted-light)] mt-2 ml-7">
              ERC-8004 registration is not configured for {mintChain} yet.
            </p>
          ) : register8004 ? (
            <p className="text-xs text-[var(--muted-light)] mt-2 ml-7">
              Creates an onchain agent identity on the ERC-8004 registry for {mintChain}. Your
              wallet becomes a registered agent.
            </p>
          ) : null}
        </div>
      </div>

      {/* Step indicator */}
      {isProcessing && (
        <div className="border-2 border-[var(--border)] p-4 text-sm font-mono">
          {step === "minting" && (
            <p>
              [1/{register8004 ? "3" : "1"}] Minting ETCH token...
            </p>
          )}
          {step === "mint-done" && <p>[1/3] ETCH minted. Preparing registration...</p>}
          {step === "switching-chain" && (
            <p>[2/3] Switching to {mintChain} chain...</p>
          )}
          {step === "sign-register" && (
            <p>[2/3] Sign to register your agent...</p>
          )}
          {step === "confirming-register" && (
            <p>[3/3] Confirming registration...</p>
          )}
        </div>
      )}

      {step === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-red-600 font-bold">{errorMessage}</p>
          <button
            onClick={() => {
              setStep("idle");
              setErrorMessage("");
              resetWriteContract();
            }}
            className="text-sm underline"
          >
            Try again
          </button>
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={!canCreate}
        className="w-full bg-[var(--foreground)] text-[var(--background)] px-6 py-3 font-bold text-sm uppercase tracking-wider hover:opacity-90 transition-colors disabled:bg-[var(--muted-light)] disabled:cursor-not-allowed"
      >
        {isProcessing
          ? "Creating..."
          : register8004
            ? "Create Agent"
            : "Mint ETCH"}
      </button>

      <p className="text-xs text-[var(--muted-light)] text-center">
        {isConnected
          ? register8004
            ? `Minting on ${mintChain} to ${address}. ETCH minting is free. Registration requires a wallet signature and gas.`
            : `Minting on ${mintChain} to ${address}. ETCH minting is free.`
          : "Connect wallet to mint. Minting is free. Optional agent registration is a wallet tx and requires gas."}
      </p>
    </div>
  );
}

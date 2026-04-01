import { createPublicClient, http, type Abi } from "viem";
import { abstract, base } from "viem/chains";

export const ETCH_ADDRESS_ABSTRACT =
  (process.env.ETCH_ADDRESS_ABSTRACT || "0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C") as `0x${string}`;

export const ETCH_ADDRESS_BASE =
  (process.env.ETCH_ADDRESS_BASE || "0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459") as `0x${string}`;

export const ETCH_ADDRESS = ETCH_ADDRESS_ABSTRACT;

export const ETCH_ABI = [
  {
    type: "function",
    name: "totalSupply",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenByIndex",
    inputs: [{ name: "index", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenURI",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenType",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "isSoulbound",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "ownerOf",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "tokenOfOwnerByIndex",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "etch",
    inputs: [
      { name: "to", type: "address" },
      { name: "uri", type: "string" },
      { name: "_tokenType", type: "uint8" },
      { name: "soulbound", type: "bool" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
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
  {
    type: "function",
    name: "setTokenURI",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const satisfies Abi;

export const IDENTITY_REGISTRY_ADDRESS_ABSTRACT =
  (process.env.IDENTITY_REGISTRY_ADDRESS_ABSTRACT || "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432") as `0x${string}`;

export const IDENTITY_REGISTRY_ADDRESS_BASE =
  (process.env.IDENTITY_REGISTRY_ADDRESS_BASE || "") as `0x${string}`;

export const IDENTITY_REGISTRY_ADDRESS = IDENTITY_REGISTRY_ADDRESS_ABSTRACT;

export const IDENTITY_REGISTRY_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "agentURI", type: "string" }],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    name: "agentOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

export const TOKEN_TYPE_LABELS: Record<number, string> = {
  0: "Identity",
  1: "Attestation",
  2: "Credential",
  3: "Receipt",
  4: "Pass",
};

export const publicClientAbstract = createPublicClient({
  chain: abstract,
  transport: http("https://api.mainnet.abs.xyz"),
});

export const publicClientBase = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

export const publicClient = publicClientAbstract;

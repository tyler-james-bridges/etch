import {
  defineManifest,
  resolveManifest,
  x402UsdcPricing,
  type ToolManifest,
} from '@opensea/tool-sdk';

export const ETCH_TOOL_BASE_URL =
  process.env.NEXT_PUBLIC_ETCH_TOOL_BASE_URL || 'https://etch.ack-onchain.dev';

const TOOL_CREATOR_ADDRESS =
  (
    process.env.ETCH_TOOL_CREATOR_ADDRESS ||
    process.env.NEXT_PUBLIC_ETCH_TOOL_CREATOR_ADDRESS ||
    '0x668aDd9213985E7Fd613Aec87767C892f4b9dF1c'
  ).toLowerCase() as `0x${string}`;

const PAYMENT_RECIPIENT =
  (process.env.ETCH_TOOL_PAYMENT_RECIPIENT ||
    process.env.ETCH_MINTER_ADDRESS ||
    TOOL_CREATOR_ADDRESS).toLowerCase() as `0x${string}`;

export const ETCH_NOTARIZE_METADATA_URI = `${ETCH_TOOL_BASE_URL}/.well-known/ai-tool/etch-notarize.json`;

export const etchNotarizeManifest = defineManifest({
  type: 'https://ercs.ethereum.org/ERCS/erc-8257#tool-manifest-v1',
  name: 'etch-notarize',
  description:
    'x402-paid notarization tool for agents. Hash UTF-8 data, mint an ETCH proof token on Abstract or Base, and return transaction, token, and verification metadata.',
  endpoint: `${ETCH_TOOL_BASE_URL}/api/v1/notarize`,
  inputs: {
    type: 'object',
    required: ['data'],
    properties: {
      data: {
        type: 'string',
        description: 'UTF-8 data to hash and notarize onchain.',
      },
      type: {
        type: 'string',
        enum: ['receipt', 'attestation'],
        description: 'ETCH token type to mint. Defaults to receipt.',
      },
      soulbound: {
        type: 'boolean',
        description: 'Whether the proof token should be non-transferable. Defaults to true.',
      },
      to: {
        type: 'string',
        description: 'Recipient wallet address. Defaults to the ETCH minter address.',
      },
      chain: {
        type: 'string',
        enum: ['abstract', 'base'],
        description: 'Target chain for the proof token. Defaults to abstract.',
      },
    },
  },
  outputs: {
    type: 'object',
    properties: {
      tokenId: { type: 'integer', description: 'Minted ETCH token ID.' },
      txHash: { type: 'string', description: 'Mint transaction hash.' },
      updateTxHash: {
        type: 'string',
        description: 'Metadata update transaction hash, when applicable.',
      },
      dataHash: {
        type: 'string',
        description: 'Keccak256 hash of the notarized data.',
      },
      timestamp: {
        type: 'string',
        description: 'Server timestamp for the notarization response.',
      },
      explorerUrl: {
        type: 'string',
        description: 'Block explorer transaction URL.',
      },
      tokenUrl: { type: 'string', description: 'ETCH token URL.' },
      chain: { type: 'string', enum: ['abstract', 'base'] },
    },
  },
  creatorAddress: TOOL_CREATOR_ADDRESS,
  pricing: x402UsdcPricing({
    amountUsdc: '0.01',
    recipient: PAYMENT_RECIPIENT,
    network: 'base',
  }),
  tags: ['etch', 'notarization', 'proof-of-work', 'x402', 'erc-8004', 'base'],
});

export function getEtchNotarizeManifest(
  env: Record<string, string | undefined> = process.env
): ToolManifest {
  return resolveManifest(etchNotarizeManifest, env);
}

export const manifest = getEtchNotarizeManifest();

import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  toHex,
  parseEventLogs,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { abstract, base } from 'viem/chains';
import { ETCH_ABI } from '@/lib/contract';
import { generateEtchMetadata } from '@/lib/art-svg';

const DEFAULT_ABSTRACT_ETCH = '0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C' as const;
const DEFAULT_BASE_ETCH = '0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459' as const;

const normalizeAddress = (input: string | undefined, fallback: Hex): Hex => {
  const v = (input || fallback).trim();
  return v as Hex;
};

const CHAIN_CONFIG = {
  abstract: {
    chain: abstract,
    rpcUrl: 'https://api.mainnet.abs.xyz',
    etchAddress: normalizeAddress(process.env.ETCH_ADDRESS_ABSTRACT, DEFAULT_ABSTRACT_ETCH),
    explorerTxBase: 'https://abscan.org/tx/',
  },
  base: {
    chain: base,
    rpcUrl: 'https://mainnet.base.org',
    etchAddress: normalizeAddress(process.env.ETCH_ADDRESS_BASE, DEFAULT_BASE_ETCH),
    explorerTxBase: 'https://basescan.org/tx/',
  },
} as const;

/** Map notarization type string to contract tokenType index */
const NOTARIZE_TYPE_MAP: Record<string, number> = {
  receipt: 3,
  attestation: 1,
};

export interface NotarizeInput {
  data: string;
  type?: 'receipt' | 'attestation';
  soulbound?: boolean;
  to?: string;
  chain?: 'abstract' | 'base';
}

export interface NotarizeResult {
  tokenId: number;
  txHash: string;
  updateTxHash: string;
  dataHash: string;
  timestamp: string;
  explorerUrl: string;
  tokenUrl: string;
  chain: 'abstract' | 'base';
}

export function computeDataHash(data: string): Hex {
  return keccak256(toHex(data));
}

export async function mintNotarizedToken(
  input: NotarizeInput,
  recipient: Hex,
  privateKey: Hex
): Promise<NotarizeResult> {
  const targetChain = input.chain || 'abstract';
  const cfg = CHAIN_CONFIG[targetChain];

  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: cfg.chain,
    transport: http(cfg.rpcUrl),
  });

  const tokenType = NOTARIZE_TYPE_MAP[input.type || 'receipt'];
  const soulbound = input.soulbound ?? true;
  const dataHash = computeDataHash(input.data);
  const typeLabel = input.type === 'attestation' ? 'Attestation' : 'Receipt';

  const name = `Notarized ${typeLabel}`;
  const description = `Onchain notarization of data. Verify with dataHash: ${dataHash}`;

  const tempMetadata = {
    name,
    description,
    attributes: [
      { trait_type: 'Type', value: typeLabel },
      { trait_type: 'Soulbound', value: soulbound ? 'Yes' : 'No' },
      { trait_type: 'dataHash', value: dataHash },
    ],
  };

  const tempUri = `data:application/json;base64,${Buffer.from(JSON.stringify(tempMetadata)).toString('base64')}`;

  const hash = await walletClient.writeContract({
    address: cfg.etchAddress,
    abi: ETCH_ABI,
    functionName: 'etch',
    args: [recipient, tempUri, tokenType, soulbound],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  const etchedEvents = parseEventLogs({
    abi: ETCH_ABI,
    eventName: 'Etched',
    logs: receipt.logs,
  });

  if (etchedEvents.length === 0) {
    throw new Error('Mint succeeded but could not parse tokenId from logs');
  }

  const mintedTokenId = Number(etchedEvents[0].args.tokenId);

  let updateHash = hash;

  // Base deployment currently reverts on post-mint setTokenURI for freshly minted token IDs.
  // Keep notarization successful with single-tx mint path while preserving dataHash in temp metadata.
  if (targetChain === 'abstract') {
    const metadataJson = generateEtchMetadata(
      mintedTokenId,
      tokenType,
      name,
      description,
      soulbound
    );

    const metadata = JSON.parse(metadataJson);
    metadata.attributes.push({ trait_type: 'dataHash', value: dataHash });
    const finalMetadataJson = JSON.stringify(metadata);

    const finalUri = `data:application/json;base64,${Buffer.from(finalMetadataJson).toString('base64')}`;

    updateHash = await walletClient.writeContract({
      address: cfg.etchAddress,
      abi: ETCH_ABI,
      functionName: 'setTokenURI',
      args: [BigInt(mintedTokenId), finalUri],
    });

    await publicClient.waitForTransactionReceipt({ hash: updateHash });
  }

  const timestamp = new Date().toISOString();

  return {
    tokenId: mintedTokenId,
    txHash: hash,
    updateTxHash: updateHash,
    dataHash,
    timestamp,
    explorerUrl: `${cfg.explorerTxBase}${hash}`,
    tokenUrl: `https://etch.ack-onchain.dev/etch/${mintedTokenId}`,
    chain: targetChain,
  };
}

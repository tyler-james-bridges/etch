#!/usr/bin/env npx tsx

import {
  ToolRegistryClient,
  computeManifestHash,
  validateManifest,
} from '@opensea/tool-sdk';
import { createWalletClient, getAddress, http, type Chain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, mainnet } from 'viem/chains';
import {
  ETCH_NOTARIZE_METADATA_URI,
  getEtchNotarizeManifest,
} from '../src/lib/tool-manifest';
import { BASE_DATA_SUFFIX } from '../src/lib/builder-code';

type ToolRegistryConfig = ConstructorParameters<typeof ToolRegistryClient>[0];

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const networkArg = args.find((arg) => arg.startsWith('--network='));
const networkName = networkArg?.split('=')[1] || 'base';

const chainByName: Record<string, Chain> = { base, mainnet };
const chain = chainByName[networkName];

if (!chain) {
  console.error('Unsupported network. Use --network=base or --network=mainnet.');
  process.exit(1);
}

const manifest = getEtchNotarizeManifest();
const validation = validateManifest(manifest);
if (!validation.success) {
  console.error('Manifest validation failed:');
  console.error(JSON.stringify(validation.error, null, 2));
  process.exit(1);
}

const manifestHash = computeManifestHash(manifest);

console.log('[ok] Manifest validates against ERC-8257 schema');
console.log(`[ok] Manifest hash: ${manifestHash}`);
console.log('');
console.log('Registration summary:');
console.log(`  Name:         ${manifest.name}`);
console.log(`  Endpoint:     ${manifest.endpoint}`);
console.log(`  Metadata URI: ${ETCH_NOTARIZE_METADATA_URI}`);
console.log(`  Creator:      ${manifest.creatorAddress}`);
console.log(`  Hash:         ${manifestHash}`);
console.log(`  Network:      ${networkName}`);
console.log('  Predicate:    none (open access)');
console.log('');

if (dryRun) {
  console.log('[dry-run] Would register ETCH Notarize with the above parameters.');
  process.exit(0);
}

const privateKey = process.env.PRIVATE_KEY;
if (!privateKey) {
  console.error('PRIVATE_KEY env var required for registration.');
  console.error('Usage: PRIVATE_KEY=0x... npm run register:8257');
  process.exit(1);
}

const account = privateKeyToAccount(privateKey as `0x${string}`);
const creator = getAddress(manifest.creatorAddress as `0x${string}`);

if (getAddress(account.address) !== creator) {
  console.error(
    `Registration wallet ${account.address} does not match manifest creator ${creator}.`
  );
  console.error(
    'Set ETCH_TOOL_CREATOR_ADDRESS to the registering wallet and redeploy the manifest first.'
  );
  process.exit(1);
}

const walletClient = createWalletClient({
  account,
  chain,
  transport: http(process.env.RPC_URL),
  dataSuffix: chain.id === base.id ? BASE_DATA_SUFFIX : undefined,
});

const registry = new ToolRegistryClient({
  chain: chain as ToolRegistryConfig['chain'],
  walletClient: walletClient as ToolRegistryConfig['walletClient'],
});

console.log('Registering ETCH Notarize onchain...');
const result = await registry.registerTool({
  metadataURI: ETCH_NOTARIZE_METADATA_URI,
  manifest,
});

console.log('');
console.log('Registration complete.');
console.log(`  Tool ID: ${result.toolId}`);
console.log(`  Tx hash: ${result.txHash}`);
console.log(
  `  Explorer: https://${networkName === 'base' ? 'basescan.org' : 'etherscan.io'}/tx/${result.txHash}`
);
console.log('');
console.log('Verify with:');
console.log(`  npx @opensea/tool-sdk inspect --tool-id ${result.toolId} --network ${networkName}`);

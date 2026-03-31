#!/usr/bin/env npx tsx
/**
 * x402 E2E Smoke Test — ETCH Notarize on Abstract
 *
 * Attempts the full paid flow:
 *   1. POST /api/v1/notarize without payment → expect 402
 *   2. Parse 402 challenge (headers + body)
 *   3. Sign EVM payment via @x402/fetch wrapper (requires funded wallet)
 *   4. Automatic replay with PAYMENT-SIGNATURE header → expect 200
 *
 * Logs raw HTTP status, headers, and body at every step.
 * Exits 0 on success, 1 on expected blocker, 2 on unexpected error.
 *
 * Env:
 *   ETCH_BASE_URL     — target server (default: https://etch.ack-onchain.dev)
 *   PAYER_PRIVATE_KEY  — hex private key with USDC.e on Abstract
 */

import { createWalletClient, http, publicActions } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { abstract, base } from 'viem/chains';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BASE_URL = process.env.ETCH_BASE_URL || 'https://etch.ack-onchain.dev';
const NOTARIZE_URL = `${BASE_URL}/api/v1/notarize`;

const PAYER_KEY = process.env.PAYER_PRIVATE_KEY;

const TARGET_CHAIN = (process.env.ETCH_CHAIN || 'abstract') as 'abstract' | 'base';
const TARGET_NETWORK = TARGET_CHAIN === 'base' ? 'eip155:8453' : 'eip155:2741';
const TARGET_RPC = TARGET_CHAIN === 'base' ? 'https://mainnet.base.org' : 'https://api.mainnet.abs.xyz';

const REQUEST_BODY = JSON.stringify({
  data: `x402 smoke test ${Date.now()}`,
  type: 'receipt',
  chain: TARGET_CHAIN,
  to: '0x668aDd9213985E7Fd613Aec87767C892f4b9dF1c',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function banner(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('='.repeat(60));
}

function logResponse(label: string, res: Response, body: string) {
  console.log(`\n--- ${label} ---`);
  console.log(`Status: ${res.status} ${res.statusText}`);
  console.log('Headers:');
  res.headers.forEach((v, k) => console.log(`  ${k}: ${v}`));
  console.log(`Body (first 2000 chars):\n${body.slice(0, 2000)}`);
}

// ---------------------------------------------------------------------------
// Step 1 — Unauthenticated request (expect 402)
// ---------------------------------------------------------------------------

banner('Step 1: Initial POST without payment (expect 402)');

let step1Res: Response;
let step1Body: string;

try {
  step1Res = await fetch(NOTARIZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: REQUEST_BODY,
  });
  step1Body = await step1Res.text();
  logResponse('Step 1 Response', step1Res, step1Body);
} catch (err) {
  console.error('Step 1 FAILED — network error:', err);
  process.exit(2);
}

if (step1Res.status !== 402) {
  console.log(`\nBLOCKER: Expected 402, got ${step1Res.status}.`);
  if (step1Res.status === 200) {
    console.log('Route is NOT payment-gated (returned 200 without paying).');
  }
  process.exit(1);
}

console.log('\nStep 1 PASSED — got 402 Payment Required.');

// ---------------------------------------------------------------------------
// Step 2 — Parse 402 challenge
// ---------------------------------------------------------------------------

banner('Step 2: Parse 402 challenge');

const xPaymentHeader =
  step1Res.headers.get('x-payment') ||
  step1Res.headers.get('payment-required') ||
  step1Res.headers.get('X-PAYMENT');

let paymentRequirements: any;

try {
  const parsed = JSON.parse(step1Body);
  if (parsed.accepts) {
    paymentRequirements = parsed;
    console.log('Parsed payment requirements from body.');
  } else if (parsed.paymentRequirements) {
    paymentRequirements = { accepts: parsed.paymentRequirements };
    console.log('Parsed payment requirements from body (legacy key).');
  }
} catch {
  // not JSON body
}

if (!paymentRequirements && xPaymentHeader) {
  try {
    paymentRequirements = JSON.parse(
      Buffer.from(xPaymentHeader, 'base64').toString('utf-8')
    );
    console.log('Parsed payment requirements from X-PAYMENT header.');
  } catch {
    console.log('X-PAYMENT header present but failed to decode:');
    console.log(`  raw: ${xPaymentHeader.slice(0, 500)}`);
  }
}

if (!paymentRequirements) {
  console.log(
    '\nBLOCKER: Could not extract payment requirements from 402 response.'
  );
  console.log(
    'Available headers:',
    [...step1Res.headers.entries()].map(([k]) => k).join(', ')
  );
  process.exit(1);
}

console.log('\nPayment requirements:');
console.log(JSON.stringify(paymentRequirements, null, 2).slice(0, 3000));

const accepts = Array.isArray(paymentRequirements.accepts)
  ? paymentRequirements.accepts
  : Array.isArray(paymentRequirements)
    ? paymentRequirements
    : [paymentRequirements];

const req = accepts[0];
console.log(`\nFirst accept entry:`);
console.log(`  scheme:  ${req?.scheme}`);
console.log(`  network: ${req?.network}`);
console.log(`  payTo:   ${req?.payTo}`);
console.log(
  `  price/maxAmountRequired: ${req?.price || req?.maxAmountRequired}`
);
console.log(`  asset:   ${req?.asset || req?.extra?.asset || 'not specified'}`);

// ---------------------------------------------------------------------------
// Step 3+4 — Sign payment & replay (via @x402/fetch wrapper)
// ---------------------------------------------------------------------------

banner('Step 3+4: Sign payment & replay via @x402/fetch');

if (!PAYER_KEY) {
  console.log('BLOCKER: PAYER_PRIVATE_KEY not set. Cannot sign payment.');
  console.log(
    `Set it to a hex private key that holds USDC on target chain (${TARGET_CHAIN}).`
  );
  console.log('\nDry-run complete — 402 challenge parsed successfully.');
  process.exit(1);
}

try {
  const account = privateKeyToAccount(PAYER_KEY as `0x${string}`);
  console.log(`Payer address: ${account.address}`);

  const walletClient = createWalletClient({
    account,
    chain: TARGET_CHAIN === 'base' ? base : abstract,
    transport: http(TARGET_RPC),
  }).extend(publicActions);

  // Use the exact same pattern as ACK known-good x402 flow
  const { wrapFetchWithPaymentFromConfig } = await import('@x402/fetch');
  const { ExactEvmScheme } = await import('@x402/evm/exact/client');

  const signer = {
    address: account.address,
    signTypedData: (msg: Record<string, unknown>) =>
      walletClient.signTypedData(msg as Parameters<typeof walletClient.signTypedData>[0]),
    readContract: (args: Record<string, unknown>) =>
      walletClient.readContract(args as Parameters<typeof walletClient.readContract>[0]),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheme = new ExactEvmScheme(signer as any);
  const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: TARGET_NETWORK, client: scheme }],
  });

  console.log('x402 client configured (ACK flow). Sending paid request...\n');

  const paidRes = await paidFetch(NOTARIZE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: REQUEST_BODY,
  });

  const paidBody = await paidRes.text();
  logResponse('Paid Response', paidRes, paidBody);

  if (paidRes.status === 200 || paidRes.status === 201) {
    const paymentResponse =
      paidRes.headers.get('payment-response') ||
      paidRes.headers.get('x-payment-response');
    if (paymentResponse) {
      console.log(
        '\nPayment response header:',
        paymentResponse.slice(0, 500)
      );
    }

    banner('E2E SMOKE TEST PASSED');
    process.exit(0);
  } else if (paidRes.status === 402) {
    console.log(
      '\nBLOCKER: Still 402 after payment. Facilitator likely rejected payment proof.'
    );

    const paidHeader =
      paidRes.headers.get('payment-required') ||
      paidRes.headers.get('x-payment') ||
      paidRes.headers.get('X-PAYMENT');

    if (paidHeader) {
      try {
        const decoded = JSON.parse(
          Buffer.from(paidHeader, 'base64').toString('utf-8')
        );
        console.log('\nDecoded paid 402 challenge/error payload:');
        console.log(JSON.stringify(decoded, null, 2).slice(0, 3000));
        console.log(`\nError field: ${decoded?.error || 'n/a'}`);
      } catch {
        console.log('\nCould not decode paid 402 header payload.');
      }
    }

    console.log('Balance is present; likely proof validation mismatch or network/tooling incompatibility.');
  } else {
    console.log(`\nBLOCKER: Expected 200, got ${paidRes.status}.`);
  }
} catch (err: any) {
  console.error('\nBLOCKER: Paid request failed.');
  console.error('Error:', err?.message || err);
  if (err?.stack) {
    console.error(
      'Stack:',
      err.stack.split('\n').slice(0, 8).join('\n')
    );
  }
}

process.exit(1);

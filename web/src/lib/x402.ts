import { withX402, x402ResourceServer } from '@x402/next';
import { HTTPFacilitatorClient } from '@x402/core/server';
import { ExactEvmScheme } from '@x402/evm/exact/server';
import type { Network } from '@x402/core/types';
import { NextRequest, NextResponse } from 'next/server';

export const ABSTRACT_NETWORK: Network = 'eip155:2741';
export const BASE_NETWORK: Network = 'eip155:8453';

export const ABSTRACT_FACILITATOR_URL =
  process.env.X402_FACILITATOR_ABSTRACT || 'https://facilitator.x402.abs.xyz';
export const BASE_FACILITATOR_URL =
  process.env.X402_FACILITATOR_BASE || 'https://facilitator.x402.org';

export const ABSTRACT_USDC = '0x84A71ccD554Cc1b02749b35d22F684CC8ec987e1';
export const BASE_USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
export const USDC_DECIMALS = 6;

const DEFAULT_PAY_TO = (
  process.env.ETCH_MINTER_ADDRESS ||
  '0x668aDd9213985E7Fd613Aec87767C892f4b9dF1c'
).trim();

let _abstractServer: x402ResourceServer | null = null;
let _baseServer: x402ResourceServer | null = null;

function makeScheme() {
  const scheme = new ExactEvmScheme();
  scheme.registerMoneyParser(async (amount: number, network: string) => {
    if (network === ABSTRACT_NETWORK) {
      return {
        amount: Math.round(amount * 1e6).toString(),
        asset: ABSTRACT_USDC,
        extra: {
          name: 'Bridged USDC (Stargate)',
          version: '2',
          decimals: USDC_DECIMALS,
        },
      };
    }

    if (network === BASE_NETWORK) {
      return {
        amount: Math.round(amount * 1e6).toString(),
        asset: BASE_USDC,
        extra: {
          name: 'USD Coin',
          version: '2',
          decimals: USDC_DECIMALS,
        },
      };
    }

    return null;
  });

  return scheme;
}

function getServerForChain(chain: 'abstract' | 'base'): x402ResourceServer {
  if (chain === 'base') {
    if (!_baseServer) {
      _baseServer = new x402ResourceServer(
        new HTTPFacilitatorClient({ url: BASE_FACILITATOR_URL })
      ).register(BASE_NETWORK, makeScheme());
    }
    return _baseServer;
  }

  if (!_abstractServer) {
    _abstractServer = new x402ResourceServer(
      new HTTPFacilitatorClient({ url: ABSTRACT_FACILITATOR_URL })
    ).register(ABSTRACT_NETWORK, makeScheme());
  }
  return _abstractServer;
}

export function withPaymentForChain<T = unknown>(
  chain: 'abstract' | 'base',
  handler: (request: NextRequest) => Promise<NextResponse<T>>,
  price: string,
  description: string,
  payTo?: string,
  extensions?: Record<string, unknown>
) {
  return withX402(
    handler,
    {
      accepts: [
        {
          scheme: 'exact',
          payTo: payTo || DEFAULT_PAY_TO,
          price,
          network: chain === 'base' ? BASE_NETWORK : ABSTRACT_NETWORK,
        },
      ],
      description,
      mimeType: 'application/json',
      ...(extensions ? { extensions } : {}),
    },
    getServerForChain(chain)
  );
}

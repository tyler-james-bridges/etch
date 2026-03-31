import { NextRequest, NextResponse } from 'next/server';
import { withPaymentForChain } from '@/lib/x402';

async function handler(_request: NextRequest) {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() });
}

export async function GET(request: NextRequest) {
  const gated = withPaymentForChain(
    'abstract',
    handler,
    '0.01',
    'ETCH x402 ping paid endpoint for payment-path diagnostics',
    process.env.ETCH_MINTER_ADDRESS
  );

  return gated(request);
}

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    name: 'ETCH Notarization API',
    version: '1.0.0',
    openapi: 'https://etch.ack-onchain.dev/openapi.json',
    paymentProtocols: ['x402'],
    defaultRoute: '/api/v1/notarize',
  });
}

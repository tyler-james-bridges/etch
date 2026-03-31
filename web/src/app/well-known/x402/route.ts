import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 1,
    resources: [
      'POST https://etch.ack-onchain.dev/api/v1/notarize',
      'GET https://etch.ack-onchain.dev/api/v1/notarize/verify',
    ],
    description: 'ETCH Notarization API - onchain notarization on Abstract via ETCH NFTs.',
    instructions:
      'Use POST /api/v1/notarize to create immutable proof-of-existence records. Use GET /api/v1/notarize/verify to validate known hashes. OpenAPI spec at /openapi.json.',
  });
}

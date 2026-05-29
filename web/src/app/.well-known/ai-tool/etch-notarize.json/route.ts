import { NextResponse } from 'next/server';
import { getEtchNotarizeManifest } from '@/lib/tool-manifest';

export async function GET() {
  return NextResponse.json(getEtchNotarizeManifest(), {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}

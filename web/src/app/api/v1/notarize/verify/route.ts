import { NextRequest, NextResponse } from "next/server";

const DATA_HASH_REGEX = /^0x[0-9a-fA-F]{64}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dataHash = searchParams.get("dataHash");

  if (!dataHash || !DATA_HASH_REGEX.test(dataHash)) {
    return NextResponse.json(
      { error: "dataHash is required and must be a 0x-prefixed 32-byte hex string" },
      { status: 400 }
    );
  }

  // TODO: Implement onchain verification by scanning token metadata.
  // Options:
  // 1. Index Etched events and store dataHash -> tokenId mapping in a database.
  // 2. Use a subgraph / indexer to query tokens by dataHash attribute.
  // 3. Scan recent tokens via totalSupply + tokenURI calls (expensive for large sets).
  //
  // For now, return a deterministic not-found response with the validated hash.
  // This endpoint is structured for drop-in replacement once indexing is available.

  return NextResponse.json({
    exists: false,
    dataHash: dataHash.toLowerCase(),
  });
}

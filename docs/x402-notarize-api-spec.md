# ETCH x402 Notarization API Spec

**Date:** 2026-03-30  
**Status:** Draft v1  
**Goal:** Expose ETCH minting as a paid x402 API for agentic notarization.

---

## 1) Endpoint Contract

## POST /api/v1/notarize (paid)

### Request
```json
{
  "data": "string",
  "type": "receipt",
  "soulbound": false
}
```

### Response (200)
```json
{
  "tokenId": "123",
  "txHash": "0x...",
  "dataHash": "0x...",
  "timestamp": "2026-03-30T22:15:00.000Z",
  "explorerUrl": "https://abscan.org/tx/0x...",
  "tokenUrl": "https://etch.ack-onchain.dev/token/123"
}
```

### Response (402)
- `WWW-Authenticate` x402 challenge
- payment requirements (asset/network/amount/payTo)

### Price
- Fixed: `$0.01` (USDC)

---

## 2) Verification Endpoint

## GET /api/v1/notarize/verify?dataHash=0x...

### Response
```json
{
  "exists": true,
  "tokenId": "123",
  "txHash": "0x...",
  "timestamp": "..."
}
```

This route is free and lets agents validate notarization without paying.

---

## 3) Implementation Notes

1. Compute `dataHash = keccak256(utf8(data))`
2. Mint ETCH token with metadata including `dataHash`, `type`, `createdAt`
3. Return tx proof and token references
4. Add `Payment-Receipt` header on successful paid calls

---

## 4) OpenAPI Requirements

Expose `/openapi.json` with:
- `x-payment-info` for `POST /api/v1/notarize`
- `responses.402`
- `info.x-guidance` for agents (when to notarize, expected output)

---

## 5) Test Matrix

- unpaid request returns valid `402`
- invalid credential returns `402`
- valid payment returns `200` with txHash + tokenId
- verify endpoint resolves minted token by `dataHash`
- discovery check passes

---

## 6) Definition of Done

- Endpoint live with x402 challenge/verify behavior
- discovery validation passes
- x402scan listing submitted
- at least one paid production notarization receipt captured

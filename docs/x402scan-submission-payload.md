# ETCH x402scan Submission Payload (Draft)

## Service
- **Name:** ETCH Notarization API
- **Base URL:** https://etch.ack-onchain.dev
- **OpenAPI:** https://etch.ack-onchain.dev/openapi.json
- **Well-known:** https://etch.ack-onchain.dev/.well-known/x402
- **Protocol:** x402

## Paid Endpoint
- `POST /api/v1/notarize`
- Price: `$0.01`
- Network: `eip155:2741` (Abstract)
- Asset: `0x84A71ccD554Cc1b02749b35d22F684CC8ec987e1` (USDC)

## Free Endpoint
- `GET /api/v1/notarize/verify?dataHash=0x...`

## Description
Onchain notarization API for agent outputs and receipts. Hashes arbitrary UTF-8 input and mints an ETCH proof token on Abstract with the `dataHash` embedded in token metadata.

## Example Request (Paid)
```bash
curl -X POST https://etch.ack-onchain.dev/api/v1/notarize \
  -H 'content-type: application/json' \
  -d '{"data":"example payload","type":"receipt","soulbound":true}'
```

## Example 402 Challenge (Unpaid)
```http
HTTP/1.1 402 Payment Required
payment-required: <base64 challenge>
```

## Example Success Shape
```json
{
  "tokenId": 123,
  "txHash": "0x...",
  "updateTxHash": "0x...",
  "dataHash": "0x...",
  "timestamp": "2026-03-30T22:00:00.000Z",
  "explorerUrl": "https://abscan.org/tx/0x...",
  "tokenUrl": "https://etch.ack-onchain.dev/etch/123"
}
```

## Discovery Validation (local smoke)
```bash
npx -y @agentcash/discovery@latest discover "http://localhost:3004"
```

Output confirms:
- API discovered from `/openapi.json`
- `POST /api/v1/notarize` recognized as paid x402 route at `$0.010000`
- `GET /api/v1/notarize/verify` recognized as free route

## Notes before production listing
1. Run paid end-to-end call against deployed URL (402 -> signed payment -> 200)
2. Capture first paid receipt + tx hash for public proof
3. Re-run discovery check against production origin

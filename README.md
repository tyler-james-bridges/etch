# ETCH

Onchain identity primitives for Abstract. Mint soulbound and transferable tokens representing identities, attestations, credentials, receipts, and passes.

## Structure

- `contracts/` — Solidity smart contracts (Foundry)
- `server/` — Rust MCP server for AI agent integration
- `web/` — Next.js frontend

## Contracts

### EtchFactory

ERC-721 factory that mints typed tokens with optional soulbound enforcement.

**Token Types:**
| Type | Value | Description |
|------|-------|-------------|
| Identity | 0 | Digital identity token |
| Attestation | 1 | Verified attestation |
| Credential | 2 | Credential/certification |
| Receipt | 3 | Transaction receipt |
| Pass | 4 | Access pass |

**Key Features:**
- Soulbound token support (non-transferable)
- Abstract paymaster compatible (`0x5407B5040dec3D339A9247f3654E59EEccbb6391`)
- Pausable minting (owner only)
- Auto-incrementing token IDs

## Development

```bash
cd contracts
forge build
forge test
```

## License

MIT

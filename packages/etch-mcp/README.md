# etch-mcp

MCP server for [ETCH](https://etch.ack-onchain.dev) -- permanent, typed, onchain records on Abstract.

Gives your AI agent three tools to create, query, and verify onchain records. Tokens are ERC-721 with generative art, optional soulbound enforcement, and five typed categories.

## Quick Start

Add to your MCP client config (Claude Desktop, Cursor, Windsurf, OpenClaw, etc.):

```json
{
  "mcpServers": {
    "etch": {
      "command": "npx",
      "args": ["-y", "etch-mcp"],
      "env": {
        "ETCH_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

`ETCH_PRIVATE_KEY` is required for minting. Read-only tools (`etch_check`, `etch_resolve`) work without it.

## Tools

### `etch` -- Create an onchain record

Mints a permanent ERC-721 token with generative art on Abstract.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string | yes | Recipient address (0x...) |
| `name` | string | yes | Name for the record |
| `description` | string | no | What this record represents |
| `tokenType` | string | yes | `identity`, `attestation`, `credential`, `receipt`, or `pass` |
| `soulbound` | boolean | no | Non-transferable. Defaults: true for identity/attestation/credential, false for receipt/pass |

Returns: `txHash`, `tokenId`, `blockNumber`, view URL, art URL, OpenSea URL.

### `etch_check` -- Query records

Look up token details by ID or check an address's balance.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | either | Get token balance for this address |
| `tokenId` | string | either | Get details for a specific token |

Provide one or the other. Token lookup returns: URI, type, soulbound status, owner.

### `etch_resolve` -- Resolve ERC-8004 identity

Look up an agent's identity from the ERC-8004 registry on Abstract.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | yes | Agent address to resolve |

Returns: registration status, token ID, metadata URI.

## Token Types

| Type | ID | Default Soulbound | Use Case |
|------|----|--------------------|----------|
| Identity | 0 | yes | Onchain identity anchors |
| Attestation | 1 | yes | Verified claims and proofs |
| Credential | 2 | yes | Earned qualifications |
| Receipt | 3 | no | Transaction records |
| Pass | 4 | no | Access and membership tokens |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ETCH_PRIVATE_KEY` | For minting | -- | Private key for signing mint transactions |
| `ETCH_RPC_URL` | No | `https://api.mainnet.abs.xyz` | Abstract RPC endpoint |

## Contract

- **Chain:** Abstract (chain ID 2741)
- **Contract:** [`0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C`](https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C)
- **Standard:** ERC-721 with ERC721Enumerable
- **Source:** Verified on Abscan

## Links

- **Website:** [etch.ack-onchain.dev](https://etch.ack-onchain.dev)
- **GitHub:** [tyler-james-bridges/etch](https://github.com/tyler-james-bridges/etch)
- **OpenSea:** [ETCH on Abstract](https://opensea.io/collection/etch)
- **Built by:** [ACK Protocol](https://ack-onchain.dev)

## License

MIT

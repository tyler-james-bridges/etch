# etch-mcp

MCP server for [ETCH](https://etch.ack-onchain.dev) -- permanent, typed, onchain records on Abstract and Base, with optional ERC-8004 agent registration.

Gives your AI agent four tools to create, query, verify, and register onchain records. Tokens are ERC-721 with generative art, optional soulbound enforcement, and five typed categories. Works on Abstract and Base.

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

`ETCH_PRIVATE_KEY` is required for minting and registration. Read-only tools (`etch_check`, `etch_resolve`) work without it.

Every tool accepts an optional `chain` parameter: `abstract` (default) or `base`.

## Tools

### `etch` -- Create an onchain record

Mints a permanent ERC-721 token with generative art on Abstract or Base. Optionally registers the configured wallet as an ERC-8004 agent on the same chain in the same call.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to` | string | yes | Recipient address (0x...) |
| `name` | string | yes | Name for the record |
| `description` | string | no | What this record represents |
| `tokenType` | string | yes | `identity`, `attestation`, `credential`, `receipt`, or `pass` |
| `soulbound` | boolean | no | Non-transferable. Defaults: true for identity/attestation/credential, false for receipt/pass |
| `chain` | string | no | `abstract` or `base`. Default `abstract` |
| `register` | boolean | no | If true, also registers the configured wallet as an ERC-8004 agent on the selected chain. Default `false` |

Returns: `chain`, `txHash`, `tokenId`, `blockNumber`, view URL, art URL, OpenSea URL, explorer tx URL. If `register: true`, also returns a `register` block with the agent ID and registration tx.

### `etch_check` -- Query records

Look up token details by ID or check an address's balance on the selected chain.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | either | Get token balance for this address |
| `tokenId` | string | either | Get details for a specific token |
| `chain` | string | no | `abstract` or `base`. Default `abstract` |

Provide one of `address` or `tokenId`. Token lookup returns: URI, type, soulbound status, owner.

### `etch_resolve` -- Resolve ERC-8004 identity

Look up an agent's identity from the ERC-8004 registry on Abstract or Base.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | yes | Agent address to resolve |
| `chain` | string | no | `abstract` or `base`. Default `abstract` |

Returns: chain, registration status, token ID, metadata URI.

### `etch_register` -- Register as an ERC-8004 agent

Registers the configured wallet (the one backing `ETCH_PRIVATE_KEY`) as an ERC-8004 agent on Abstract or Base. Returns the assigned agent ID. Idempotent: if the wallet is already registered on the selected chain, returns the existing agent ID without sending a transaction.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | string | no | `abstract` or `base`. Default `abstract` |
| `agentUri` | string | no | Optional agent metadata URI. Defaults to `https://etch.ack-onchain.dev/api/agent/<wallet>?chain=<chain>` |

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
| `ETCH_PRIVATE_KEY` | For minting and registering | -- | Private key for signing transactions |
| `ETCH_RPC_URL_ABSTRACT` | No | `https://api.mainnet.abs.xyz` | Abstract RPC endpoint |
| `ETCH_RPC_URL_BASE` | No | `https://mainnet.base.org` | Base RPC endpoint |
| `ETCH_RPC_URL` | No | -- | Legacy alias for `ETCH_RPC_URL_ABSTRACT` |

## Contracts

**Abstract (chain ID 2741)**
- ETCH: [`0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C`](https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C)
- ERC-8004 Registry: [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://abscan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432)

**Base (chain ID 8453)**
- ETCH: [`0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459`](https://basescan.org/address/0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459)
- ERC-8004 Registry: [`0x6A650549b4F0088e815e110aB169E5D9d313d0b6`](https://basescan.org/address/0x6A650549b4F0088e815e110aB169E5D9d313d0b6)

Both contracts: ERC-721 with ERC721Enumerable, verified on the respective explorer.

## Links

- **Website:** [etch.ack-onchain.dev](https://etch.ack-onchain.dev)
- **GitHub:** [tyler-james-bridges/etch](https://github.com/tyler-james-bridges/etch)
- **OpenSea:** [ETCH on Abstract](https://opensea.io/collection/etch-onchain)
- **Built by:** [ACK Protocol](https://ack-onchain.dev)

## License

MIT

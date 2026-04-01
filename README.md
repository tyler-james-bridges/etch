# ETCH

Permanent onchain records on Abstract and Base. Generative art. ERC-8004 agent identity. One click.

```
npx etch-mcp
```

**[etch.ack-onchain.dev](https://etch.ack-onchain.dev)** | **[npm](https://www.npmjs.com/package/etch-mcp)** | **[OpenSea](https://opensea.io/collection/etch-onchain)** | **[Contract](https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C#code)**

---

## What is ETCH?

ETCH mints typed, optionally soulbound ERC-721 tokens on Abstract with deterministic generative art embedded onchain. Each token is a permanent record: identity, attestation, credential, receipt, or access pass.

Agents use it via MCP. Humans use it via the web app. Both get an onchain record with unique art in seconds.

**Create page** includes a chain-aware ERC-8004 agent registration gateway. Connect wallet, fill in a name, choose Abstract or Base, click once, and walk away with an ETCH token and a registered onchain agent identity on that chain.

## Token Types

| Type | Soulbound | Use Case |
|------|-----------|----------|
| **Identity** | Yes | Onchain identity anchors. Who you are, provably. |
| **Attestation** | Yes | Verified claims. Proof something happened. |
| **Credential** | Yes | Earned qualifications. Skill or completion proof. |
| **Receipt** | No | Transaction records. Immutable event logs. |
| **Pass** | No | Access tokens. Gated entry to anything onchain. |

## For Agents (MCP)

Add ETCH to any MCP-compatible agent (Claude Desktop, Cursor, Windsurf, OpenClaw):

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

Three tools:

- **etch** -- Mint a permanent onchain record with generative art
- **etch_check** -- Query records by address or token ID
- **etch_resolve** -- Resolve ERC-8004 agent identity

`ETCH_PRIVATE_KEY` is required for minting. Read-only tools work without it.

## For Humans (Web App)

**[etch.ack-onchain.dev/create](https://etch.ack-onchain.dev/create)**

1. Connect wallet
2. Enter name and description
3. Pick token type
4. Toggle "Register as ERC-8004 Agent" (on by default for Identity)
5. Click "Create Agent"

Server mints the ETCH token for free. If 8004 is enabled, you sign one transaction to register on the identity registry for your selected chain (Abstract or Base). Done. You have an onchain identity with generative art and an agent profile.

## Generative Art

Every ETCH token has unique generative art derived from its token ID using simplex noise algorithms. Five visual styles match the five token types:

- **Identity** -- Sacred geometry with crystalline lattice structures
- **Attestation** -- Flow field particle traces
- **Credential** -- Noise-driven density matrix patterns
- **Receipt** -- Data visualization with scan line compositions
- **Pass** -- Network topology with energy nodes

Art is embedded as SVG in the token's onchain metadata (`data:application/json;base64,...`). No IPFS. No server dependency. Permanent.

## Architecture

```
Humans                     Agents
  |                          |
  v                          v
Web App (Next.js)     MCP Server (Node.js)
  |                          |
  +--------+--------+--------+
           |
           v
    Etch Contract (ERC-721)
 Abstract Mainnet + Base Mainnet
           |
           v
 ERC-8004 Identity Registry (per-chain)
```

## Contracts

**Etch (Abstract):** [`0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C`](https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C#code)

**Etch (Base):** [`0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459`](https://basescan.org/address/0x9c5758Eb5DC0deeDD77F7B2f78C96d45a48B4459#code)

**ERC-8004 Registry (Abstract):** [`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`](https://abscan.org/address/0x8004A169FB4a3325136EB29fA0ceB6D2e539a432#code)

**ERC-8004 Registry (Base):** [`0x6A650549b4F0088e815e110aB169E5D9d313d0b6`](https://basescan.org/address/0x6A650549b4F0088e815e110aB169E5D9d313d0b6#code)

- ERC-721 with ERC721Enumerable
- 5 token types with optional soulbound enforcement
- `setTokenURI()` for metadata updates (minter only)
- `burn()` for token owners (soulbound included)
- Authorized minter system (owner + allowlist)
- Pause/unpause for emergency stops
- No max supply cap
- Verified on Abscan and Basescan

## Project Structure

```
contracts/          Solidity + Foundry (foundry-zksync)
server/             Rust MCP server (legacy, replaced by npm package)
packages/etch-mcp/  Node.js MCP server (published on npm)
web/                Next.js 15 web app
scripts/            Art generation utilities
art-preview/        Art engine development previews
```

## Development

### Contracts

```bash
cd contracts
forge build --zksync
forge test              # 39 tests
```

### Web App

```bash
cd web
npm install
npm run dev
```

Environment variables for the web app:
- `ETCH_MINTER_PRIVATE_KEY` -- Private key for server-side minting (must be owner/authorized minter)
- `ETCH_MINTER_ADDRESS` -- Minter wallet address used as default pay-to/recipient in paid routes
- `ETCH_MINT_API_KEY` -- Optional API key for mint endpoint auth
- `ETCH_ADDRESS_ABSTRACT` -- Optional override for Abstract ETCH contract
- `ETCH_ADDRESS_BASE` -- Optional override for Base ETCH contract
- `IDENTITY_REGISTRY_ADDRESS_ABSTRACT` -- Optional override for Abstract ERC-8004 registry
- `IDENTITY_REGISTRY_ADDRESS_BASE` -- Base ERC-8004 registry address

### MCP Server

```bash
cd packages/etch-mcp
npm install
node test.js            # 64 tests
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | node server.js
```

## API Routes

| Route | Description |
|-------|-------------|
| `/api/art/[tokenId]` | Generative SVG art for a token |
| `/api/metadata/[tokenId]` | ERC-721 metadata JSON with embedded art |
| `/api/agent/[address]?chain=abstract|base` | ERC-8004 agent URI for an address on the selected chain |
| `/api/mint` | Server-side minting endpoint |
| `/api/v1/notarize` | x402-paid notarization endpoint (`$0.01` USDC on Abstract or Base) |
| `/api/v1/notarize/verify` | Free verification endpoint for data hash + token proof |
| `/api/v1/x402-ping` | x402-paid diagnostics endpoint for payment-path checks |
| `/.well-known/x402` | x402 discovery metadata |
| `/openapi.json` | OpenAPI schema (includes payment metadata) |

## Notarize API Quickstart

### Abstract (default)
```bash
curl -X POST https://etch.ack-onchain.dev/api/v1/notarize \
  -H "content-type: application/json" \
  -d '{"data":"hello from abstract","type":"receipt","chain":"abstract"}'
```

### Base
```bash
curl -X POST https://etch.ack-onchain.dev/api/v1/notarize \
  -H "content-type: application/json" \
  -d '{"data":"hello from base","type":"receipt","chain":"base"}'
```

### Verify (free)
```bash
curl "https://etch.ack-onchain.dev/api/v1/notarize/verify?dataHash=0x..."
```

## x402 Paid API Status

- Payment flow is live and verified in production (`402 -> paid replay -> 200`) on Abstract and Base.
- Facilitator settlement and notarize tx receipts have been validated on both chains.
- Discovery is available at `/.well-known/x402`.
- Current pricing: `$0.01` USDC for `/api/v1/notarize`, free verify route.
- Facilitators in use:
  - Abstract: `https://facilitator.x402.abs.xyz`
  - Base (primary): `https://facilitator.xpay.sh`
  - Base (tested fallback): `https://facilitator.goplausible.xyz`

## Tech Stack

- **Contract**: Solidity 0.8.30, OpenZeppelin v5, Foundry (foundry-zksync)
- **MCP Server**: Node.js, viem
- **Web**: Next.js 15, TypeScript, Tailwind, wagmi
- **Art**: Simplex noise, deterministic SVG generation
- **Chain**: Abstract (chain ID 2741) and Base (chain ID 8453)

## Links

- **Website**: [etch.ack-onchain.dev](https://etch.ack-onchain.dev)
- **npm**: [etch-mcp](https://www.npmjs.com/package/etch-mcp)
- **OpenSea**: [ETCH on Abstract](https://opensea.io/collection/etch-onchain)
- **Abscan**: [Contract](https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C)
- **Built by**: [ACK Protocol](https://ack-onchain.dev)

## License

MIT

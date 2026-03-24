# ETCH

Permanent onchain records on Abstract. Generative art. ERC-8004 agent identity. One click.

```
npx etch-mcp
```

**[etch.ack-onchain.dev](https://etch.ack-onchain.dev)** | **[npm](https://www.npmjs.com/package/etch-mcp)** | **[OpenSea](https://opensea.io/collection/etch-189154762)** | **[Contract](https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C#code)**

---

## What is ETCH?

ETCH mints typed, optionally soulbound ERC-721 tokens on Abstract with deterministic generative art embedded onchain. Each token is a permanent record: identity, attestation, credential, receipt, or access pass.

Agents use it via MCP. Humans use it via the web app. Both get an onchain record with unique art in seconds.

**Create page** includes an ERC-8004 agent registration gateway. Connect wallet, fill in a name, click once, and walk away with an ETCH token and a registered onchain agent identity.

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

Server mints the ETCH token for free. If 8004 is enabled, you sign one transaction to register on the identity registry (sub-cent gas on Abstract). Done. You have an onchain identity with generative art and an agent profile.

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
    Abstract Mainnet
           |
           v
    ERC-8004 Identity Registry
```

## Contract

**Etch** on Abstract mainnet: [`0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C`](https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C#code)

- ERC-721 with ERC721Enumerable
- 5 token types with optional soulbound enforcement
- `setTokenURI()` for metadata updates (minter only)
- `burn()` for token owners (soulbound included)
- Authorized minter system (owner + allowlist)
- Pause/unpause for emergency stops
- No max supply cap
- Verified on Abscan

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
- `ETCH_MINTER_PRIVATE_KEY` -- Private key for server-side minting
- `ETCH_MINT_API_KEY` -- Optional API key for mint endpoint auth

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
| `/api/agent/[address]` | ERC-8004 agent URI for an address |
| `/api/mint` | Server-side minting endpoint |

## Tech Stack

- **Contract**: Solidity 0.8.30, OpenZeppelin v5, Foundry (foundry-zksync)
- **MCP Server**: Node.js, viem
- **Web**: Next.js 15, TypeScript, Tailwind, wagmi
- **Art**: Simplex noise, deterministic SVG generation
- **Chain**: Abstract (ZK rollup on Ethereum, chain ID 2741)

## Links

- **Website**: [etch.ack-onchain.dev](https://etch.ack-onchain.dev)
- **npm**: [etch-mcp](https://www.npmjs.com/package/etch-mcp)
- **OpenSea**: [ETCH on Abstract](https://opensea.io/collection/etch-189154762)
- **Abscan**: [Contract](https://abscan.org/address/0x1C6B7c00B4eCBFc01e3E8f46C2B9Bda4831E6e2C)
- **Built by**: [ACK Protocol](https://ack-onchain.dev)

## License

MIT

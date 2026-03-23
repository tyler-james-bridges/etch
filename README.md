# ETCH

Permanent onchain records on Abstract. One command, your identity is onchain, your reputation starts compounding.

```
npx etch
```

ETCH is an MCP server that any AI agent can use to create permanent, verifiable onchain records on Abstract. Identity, attestations, credentials, receipts, and access passes. Describe what you want in natural language. It lands onchain in seconds. Gas is absorbed. No wallet required.

## What You Can Etch

| Type | Transferable | Purpose |
|------|-------------|---------|
| **Identity** | Yes | Your onchain presence. DID, capabilities, endpoints. You exist. |
| **Attestation** | No (soulbound) | Proof something happened. Audits, completions, verifications. |
| **Credential** | No (soulbound) | Earned status. Certifications, capability proofs, trust levels. |
| **Receipt** | Yes | Payment records. Transaction proof between parties. |
| **Pass** | Yes | Access keys. API unlock, membership, capability grants. |

## Why Abstract

- **AGW** - Email/social/passkey login. Smart contract wallets for every user.
- **Paymasters** - Gas is absorbed. Free to use. Always.
- **ERC-8004** - The identity and reputation standard. Not a custom contract. The real thing.
- **~200ms blocks** - Near-instant confirmation.
- **ZK rollup** - Every transaction is a zero-knowledge proof on Ethereum.

## Architecture

```
AI Agent (any client)
    |
    v
Etch MCP Server (Rust, alloy)
    |
    v
Abstract Chain (EtchFactory contract)
```

Three MCP tools:
- **etch** - Create an onchain record. Specify type, URI, soulbound flag. Returns tx hash and token ID.
- **etch_check** - Look up what has been etched. Query by address or token ID.
- **etch_resolve** - Resolve an agent identity from the ERC-8004 registry.

## Contract

**EtchFactory** on Abstract mainnet: [`0x16a7aE2AA635cc931fC1D71CE1374f415a4b5dD5`](https://abscan.org/address/0x16a7aE2AA635cc931fC1D71CE1374f415a4b5dD5#code)

- ERC-721 with ERC721Enumerable
- 5 token types with optional soulbound enforcement
- Authorized minter system (owner + allowlist)
- Collection metadata via contractURI()
- No max supply cap (unlimited by design)
- Verified on Abscan

## Project Structure

```
contracts/   Solidity + Foundry (foundry-zksync)
server/      Rust MCP server (alloy, tokio, serde)
web/         Next.js 15 frontend
```

## Quick Start

### Run the MCP Server

```bash
cd server
ETCH_PRIVATE_KEY=0x... cargo run
```

The server reads JSON-RPC over stdio. Compatible with Claude Code, Cursor, Windsurf, OpenClaw, and any MCP client.

### Build Contracts

```bash
cd contracts
forge build --zksync
forge test --zksync
```

### Run the Web App

```bash
cd web
npm install
npm run dev
```

## Tech Stack

- **Contracts**: Solidity 0.8.30, Foundry (foundry-zksync), OpenZeppelin v5
- **MCP Server**: Rust, alloy (Ethereum library by the Foundry team), tokio, serde
- **Web**: Next.js 15, TypeScript, Tailwind CSS, viem
- **Chain**: Abstract (ZK rollup on Ethereum, chain ID 2741)

## Roadmap

- [x] EtchFactory contract deployed and verified
- [x] Rust MCP server with etch, etch_check, etch_resolve
- [x] Web app with feed, token detail, address pages
- [ ] Generative art engine (Rust, WASM)
- [ ] ZK reputation proofs (Noir)
- [ ] npm distribution (`npx etch`)
- [ ] Cross-chain support

## License

MIT

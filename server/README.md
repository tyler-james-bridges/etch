# ETCH MCP Server

Rust MCP server for AI agent integration with the EtchFactory contract on Abstract.

## Tools

- **etch** - Create an onchain record (mint a token with type, URI, soulbound flag)
- **etch_check** - Look up tokens by address or token ID
- **etch_resolve** - Resolve agent identity from the ERC-8004 registry

## Run

```bash
ETCH_PRIVATE_KEY=0x... cargo run
```

The server communicates over stdio using JSON-RPC (standard MCP transport). Compatible with any MCP client.

## Test

```bash
cargo test
```

19 tests covering JSON-RPC parsing, tool parameter validation, and MCP protocol handlers.

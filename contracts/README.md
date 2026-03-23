# ETCH Contracts

EtchFactory ERC-721 contract on Abstract mainnet.

**Deployed**: [`0x16a7aE2AA635cc931fC1D71CE1374f415a4b5dD5`](https://abscan.org/address/0x16a7aE2AA635cc931fC1D71CE1374f415a4b5dD5#code)

## Build

```bash
cd contracts
forge build --zksync
```

## Test

```bash
forge test --zksync
```

33 tests covering all token types, soulbound enforcement, access control, enumerable queries, and pause/unpause.

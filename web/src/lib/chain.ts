import { defineChain } from "viem";

export const abstractMainnet = defineChain({
  id: 2741,
  name: "Abstract",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.mainnet.abs.xyz"] },
  },
  blockExplorers: {
    default: {
      name: "Abstract Explorer",
      url: "https://abscan.org",
    },
  },
});

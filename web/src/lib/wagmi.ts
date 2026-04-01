import { createConfig, http } from "wagmi";
import { coinbaseWallet, injected, metaMask, walletConnect } from "wagmi/connectors";
import { abstract, base } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "00000000000000000000000000000000";

export const config = createConfig({
  chains: [abstract, base],
  connectors: [
    metaMask(),
    injected(),
    coinbaseWallet({ appName: "ETCH" }),
    walletConnect({ projectId, showQrModal: true }),
  ],
  transports: {
    [abstract.id]: http("https://api.mainnet.abs.xyz"),
    [base.id]: http("https://mainnet.base.org"),
  },
});

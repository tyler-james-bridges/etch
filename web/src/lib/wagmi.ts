import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { abstract, base } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "00000000000000000000000000000000";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, injectedWallet, coinbaseWallet, rainbowWallet],
    },
    {
      groupName: "Other",
      wallets: [walletConnectWallet],
    },
  ],
  {
    appName: "ETCH",
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [abstract, base],
  transports: {
    [abstract.id]: http("https://api.mainnet.abs.xyz"),
    [base.id]: http("https://mainnet.base.org"),
  },
  ssr: false,
});

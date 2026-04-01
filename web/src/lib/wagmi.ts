import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { abstract, base } from "wagmi/chains";

export const config = createConfig({
  chains: [abstract, base],
  connectors: [injected()],
  transports: {
    [abstract.id]: http("https://api.mainnet.abs.xyz"),
    [base.id]: http("https://mainnet.base.org"),
  },
});

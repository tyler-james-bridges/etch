import { createConfig, http } from "wagmi";
import { abstract, base } from "wagmi/chains";

export const config = createConfig({
  chains: [abstract, base],
  transports: {
    [abstract.id]: http("https://api.mainnet.abs.xyz"),
    [base.id]: http("https://mainnet.base.org"),
  },
});

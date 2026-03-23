import { createConfig, http } from "wagmi";
import { abstract } from "wagmi/chains";

export const config = createConfig({
  chains: [abstract],
  transports: {
    [abstract.id]: http("https://api.mainnet.abs.xyz"),
  },
});

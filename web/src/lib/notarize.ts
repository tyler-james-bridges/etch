import {
  createWalletClient,
  createPublicClient,
  http,
  keccak256,
  toHex,
  parseEventLogs,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { abstract } from "viem/chains";
import { ETCH_ADDRESS, ETCH_ABI } from "@/lib/contract";
import { generateEtchMetadata } from "@/lib/art-svg";

const RPC_URL = "https://api.mainnet.abs.xyz";

/** Map notarization type string to contract tokenType index */
const NOTARIZE_TYPE_MAP: Record<string, number> = {
  receipt: 3,
  attestation: 1,
};

export interface NotarizeInput {
  data: string;
  type?: "receipt" | "attestation";
  soulbound?: boolean;
  to?: string;
}

export interface NotarizeResult {
  tokenId: number;
  txHash: string;
  updateTxHash: string;
  dataHash: string;
  timestamp: string;
  explorerUrl: string;
  tokenUrl: string;
}

export function computeDataHash(data: string): Hex {
  return keccak256(toHex(data));
}

export async function mintNotarizedToken(
  input: NotarizeInput,
  recipient: Hex,
  privateKey: Hex
): Promise<NotarizeResult> {
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    chain: abstract,
    transport: http(RPC_URL),
  });

  const walletClient = createWalletClient({
    account,
    chain: abstract,
    transport: http(RPC_URL),
  });

  const tokenType = NOTARIZE_TYPE_MAP[input.type || "receipt"];
  const soulbound = input.soulbound ?? true;
  const dataHash = computeDataHash(input.data);
  const typeLabel = input.type === "attestation" ? "Attestation" : "Receipt";

  const name = `Notarized ${typeLabel}`;
  const description = `Onchain notarization of data. Verify with dataHash: ${dataHash}`;

  // Step 1: Mint with temp metadata
  const tempMetadata = {
    name,
    description,
    attributes: [
      { trait_type: "Type", value: typeLabel },
      { trait_type: "Soulbound", value: soulbound ? "Yes" : "No" },
      { trait_type: "dataHash", value: dataHash },
    ],
  };

  const tempUri = `data:application/json;base64,${Buffer.from(JSON.stringify(tempMetadata)).toString("base64")}`;

  const hash = await walletClient.writeContract({
    address: ETCH_ADDRESS,
    abi: ETCH_ABI,
    functionName: "etch",
    args: [recipient, tempUri, tokenType, soulbound],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  // Step 2: Parse tokenId from Etched event
  const etchedEvents = parseEventLogs({
    abi: ETCH_ABI,
    eventName: "Etched",
    logs: receipt.logs,
  });

  if (etchedEvents.length === 0) {
    throw new Error("Mint succeeded but could not parse tokenId from logs");
  }

  const mintedTokenId = Number(etchedEvents[0].args.tokenId);

  // Step 3: Generate final metadata with art and dataHash attribute
  const metadataJson = generateEtchMetadata(
    mintedTokenId,
    tokenType,
    name,
    description,
    soulbound
  );

  // Inject dataHash attribute into the generated metadata
  const metadata = JSON.parse(metadataJson);
  metadata.attributes.push({ trait_type: "dataHash", value: dataHash });
  const finalMetadataJson = JSON.stringify(metadata);

  const finalUri = `data:application/json;base64,${Buffer.from(finalMetadataJson).toString("base64")}`;

  // Step 4: Update token URI with final art + dataHash
  const updateHash = await walletClient.writeContract({
    address: ETCH_ADDRESS,
    abi: ETCH_ABI,
    functionName: "setTokenURI",
    args: [BigInt(mintedTokenId), finalUri],
  });

  await publicClient.waitForTransactionReceipt({ hash: updateHash });

  const timestamp = new Date().toISOString();

  return {
    tokenId: mintedTokenId,
    txHash: hash,
    updateTxHash: updateHash,
    dataHash,
    timestamp,
    explorerUrl: `https://abscan.org/tx/${hash}`,
    tokenUrl: `https://etch.ack-onchain.dev/etch/${mintedTokenId}`,
  };
}

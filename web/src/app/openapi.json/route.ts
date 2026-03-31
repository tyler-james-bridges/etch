import { NextResponse } from "next/server";

const spec = {
  openapi: "3.1.0",
  info: {
    title: "ETCH Notarization API",
    version: "1.0.0",
    description: "Onchain notarization on Abstract via ETCH NFTs.",
    "x-guidance":
      "Use POST /api/v1/notarize to create immutable proof-of-existence records for agent outputs, receipts, and attestations. Use GET /api/v1/notarize/verify to validate known hashes.",
  },
  servers: [{ url: "https://etch.ack-onchain.dev" }],
  security: [{ x402: [] }],
  paths: {
    "/api/v1/notarize": {
      post: {
        operationId: "notarize",
        summary: "Notarize data onchain",
        description:
          "Computes keccak256 of the provided data, mints an ETCH token with the hash embedded in metadata, and returns proof.",
        "x-payment-info": {
          pricingMode: "fixed",
          price: "0.010000",
          protocols: ["x402"],
        },
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["data"],
                properties: {
                  data: {
                    type: "string",
                    description: "The UTF-8 string data to notarize.",
                  },
                  type: {
                    type: "string",
                    enum: ["receipt", "attestation"],
                    default: "receipt",
                    description: "Token type for the notarization.",
                  },
                  soulbound: {
                    type: "boolean",
                    default: true,
                    description: "Whether the token is non-transferable.",
                  },
                  to: {
                    type: "string",
                    description:
                      "Recipient address (0x...). Defaults to minter address.",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Notarization successful",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tokenId: { type: "integer" },
                    txHash: { type: "string" },
                    updateTxHash: { type: "string" },
                    dataHash: { type: "string" },
                    timestamp: { type: "string", format: "date-time" },
                    explorerUrl: { type: "string", format: "uri" },
                    tokenUrl: { type: "string", format: "uri" },
                  },
                },
              },
            },
          },
          "401": {
            description: "Unauthorized - missing or invalid API key",
          },
          "402": {
            description:
              "Payment required. This endpoint requires x402 micropayment of 0.01 USDC.",
          },
          "429": {
            description: "Rate limit exceeded (3 per hour per recipient)",
          },
        },
      },
    },
    "/api/v1/notarize/verify": {
      get: {
        operationId: "verifyNotarization",
        summary: "Verify a notarization by dataHash",
        description:
          "Check whether a given dataHash has been notarized onchain.",
        security: [],
        parameters: [
          {
            name: "dataHash",
            in: "query",
            required: true,
            schema: { type: "string", pattern: "^0x[0-9a-fA-F]{64}$" },
            description:
              "The keccak256 hash to verify (0x-prefixed, 32 bytes).",
          },
        ],
        responses: {
          "200": {
            description: "Verification result",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    exists: { type: "boolean" },
                    tokenId: { type: "integer" },
                    txHash: { type: "string" },
                    timestamp: { type: "string", format: "date-time" },
                    dataHash: { type: "string" },
                  },
                },
              },
            },
          },
          "400": {
            description: "Invalid dataHash format",
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      x402: {
        type: "http",
        scheme: "bearer",
        description:
          "x402 micropayment protocol. Send a 402 challenge response with USDC payment proof.",
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec);
}

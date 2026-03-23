import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETCH - Permanent onchain records on Abstract",
  description:
    "Typed, optionally soulbound ERC-721 tokens. Mint identity, attestation, credential, receipt, and pass tokens via MCP. Built for AI agents on Abstract.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black font-mono antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

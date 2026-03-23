import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETCH - Permanent onchain records on Abstract",
  description:
    "Typed, optionally soulbound ERC-721 tokens. Identity, Attestation, Credential, Receipt, Pass.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-black font-mono antialiased">
        <header className="border-b-2 border-black px-4 py-3 flex items-center justify-between">
          <a href="/" className="text-xl font-bold tracking-tight no-underline">
            ETCH
          </a>
          <nav className="flex gap-4 text-sm">
            <a href="/" className="no-underline hover:underline">
              Home
            </a>
          </nav>
        </header>
        <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
        <footer className="border-t-2 border-black px-4 py-4 text-xs text-center">
          ETCH by{" "}
          <a
            href="https://ack-onchain.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            ACK Protocol
          </a>{" "}
          on Abstract
        </footer>
      </body>
    </html>
  );
}

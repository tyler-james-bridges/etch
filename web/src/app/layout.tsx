import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "ETCH - Permanent onchain records on Abstract and Base",
  description:
    "Typed, optionally soulbound ERC-721 tokens. Mint identity, attestation, credential, receipt, and pass tokens via MCP. Built for AI agents on Abstract and Base.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('etch-theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-screen bg-[var(--background)] text-[var(--foreground)] font-mono antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

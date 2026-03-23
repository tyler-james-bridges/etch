"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="border-2 border-black px-3 py-1 text-xs font-mono uppercase tracking-wider hover:bg-black hover:text-white transition-colors cursor-pointer"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

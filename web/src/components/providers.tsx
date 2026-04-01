"use client";

import dynamic from "next/dynamic";

const ProvidersInner = dynamic(
  () => import("./providers-inner").then((m) => m.ProvidersInner),
  { ssr: false }
);

export function Providers({ children }: { children: React.ReactNode }) {
  return <ProvidersInner>{children}</ProvidersInner>;
}

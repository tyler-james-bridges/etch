import { ThemeToggle } from "@/components/ThemeToggle";

export default function EtchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b-2 border-[var(--border)] px-4 py-3 flex items-center justify-between">
        <a href="/" className="text-xl font-bold tracking-tight no-underline">
          ETCH
        </a>
        <nav className="flex items-center gap-4 text-sm">
          <a href="/" className="no-underline hover:underline">
            Home
          </a>
          <ThemeToggle />
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-8">{children}</main>
      <footer className="border-t-2 border-[var(--border)] px-4 py-4 text-xs text-center">
        ETCH by{" "}
        <a
          href="https://ack-onchain.dev"
          target="_blank"
          rel="noopener noreferrer"
        >
          ACK Protocol
        </a>{" "}
        on Abstract and Base
      </footer>
    </>
  );
}

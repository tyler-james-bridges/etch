"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("etch-theme", next ? "dark" : "light");
  };

  if (!mounted) return <span className="w-4 inline-block" />;

  return (
    <button
      onClick={toggle}
      className="text-base leading-none hover:opacity-70 transition-opacity no-underline"
      aria-label="Toggle theme"
    >
      {dark ? "\u2600" : "\u263E"}
    </button>
  );
}

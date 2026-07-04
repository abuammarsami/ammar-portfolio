"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Render a stable placeholder until mounted to avoid hydration mismatch.
  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="font-mono text-sm text-muted transition-colors hover:text-q0"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      {isDark ? "|d⟩" : "|l⟩"}
    </button>
  );
}

"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

// Hydration-safe mounted detector (server snapshot = false, client = true)
// without setState-in-effect.
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  // Render a stable placeholder until mounted to avoid hydration mismatch.
  const isDark = mounted ? resolvedTheme === "dark" : true;

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="font-mono text-sm text-muted transition-colors hover:text-q0"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      <span aria-hidden="true">{isDark ? "|d⟩" : "|l⟩"}</span>
    </button>
  );
}

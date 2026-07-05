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

  // theme flip as a measurement collapse (P5): same-document view transition,
  // safe unlike wrapping router.push — the DOM change here is synchronous.
  // data-vt scopes the collapse CSS to theme flips, not route navigations.
  const flip = () => setTheme(isDark ? "light" : "dark");
  const collapse = () => {
    const d = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (d.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.dataset.vt = "measure";
      const vt = d.startViewTransition(flip);
      void vt.finished.finally(() => {
        delete document.documentElement.dataset.vt;
      });
    } else {
      flip();
    }
  };

  return (
    <button
      type="button"
      onClick={collapse}
      className="font-mono text-sm text-muted transition-colors hover:text-q0"
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
    >
      <span aria-hidden="true">{isDark ? "|d⟩" : "|l⟩"}</span>
    </button>
  );
}

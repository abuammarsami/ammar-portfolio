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

  // theme flip as a measurement collapse (P5). next-themes writes data-theme
  // in a passive effect — after startViewTransition snapshots the "new" frame
  // — so the attribute must be flipped synchronously inside the callback for
  // the two snapshots to differ; setTheme then reconciles state (idempotent).
  // data-vt scopes the collapse CSS to theme flips, not route navigations.
  const next = isDark ? "light" : "dark";
  const flip = () => setTheme(next);
  const collapse = () => {
    const d = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (d.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      document.documentElement.dataset.vt = "measure";
      const vt = d.startViewTransition(() => {
        document.documentElement.setAttribute("data-theme", next);
        document.documentElement.style.colorScheme = next;
        flip();
      });
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

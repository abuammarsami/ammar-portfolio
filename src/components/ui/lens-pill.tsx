"use client";

import { useSyncExternalStore } from "react";

import { applyLens, currentLens, DEFAULT_LENS, LENS_EVENT, LENSES } from "@/lib/agent/lens";

const subscribe = (cb: () => void) => {
  window.addEventListener(LENS_EVENT, cb);
  return () => window.removeEventListener(LENS_EVENT, cb);
};

/**
 * Cycles the adaptive lens (plan-0005). Bra notation ⟨lens| beside the theme
 * toggle's ket |d⟩ — the site adapts to who's observing it.
 */
export function LensPill() {
  const lens = useSyncExternalStore(subscribe, currentLens, () => DEFAULT_LENS);
  const next = LENSES[(LENSES.indexOf(lens) + 1) % LENSES.length] ?? DEFAULT_LENS;

  return (
    <button
      type="button"
      onClick={() => applyLens(next)}
      className="hidden font-mono text-sm text-muted transition-colors hover:text-q0 sm:inline"
      aria-label={`Viewing as ${lens} — switch to ${next}`}
      title={`viewing as ${lens} — click for ${next}`}
    >
      <span aria-hidden="true">⟨{lens}|</span>
    </button>
  );
}

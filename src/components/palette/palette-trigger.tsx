"use client";

import { useSyncExternalStore } from "react";

import { PALETTE_EVENT } from "@/lib/agent/autopilot-event";

const never = () => () => {};
const isApple = () => /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);

/**
 * Nav trigger for the command palette: a platform-aware kbd hint on
 * desktop (⌘K / Ctrl K), a search button on small screens where there
 * is no keyboard shortcut to discover.
 */
export function PaletteTrigger() {
  // SSR renders the Mac glyph for everyone; non-Mac swaps the label on
  // hydration (text-only change, no layout shift worth guarding against)
  const mac = useSyncExternalStore(never, isApple, () => true);
  const open = () => window.dispatchEvent(new Event(PALETTE_EVENT));
  return (
    <>
      <button
        type="button"
        onClick={open}
        title="Command palette"
        className="hidden shrink-0 cursor-pointer rounded-sm border rule-hair px-1.5 py-0.5 font-mono text-xs text-muted transition-colors hover:text-ink md:inline-block"
      >
        {mac ? "⌘K" : "Ctrl K"}
        <span className="sr-only"> — open command palette</span>
      </button>
      <button
        type="button"
        onClick={open}
        aria-label="Search and commands"
        className="shrink-0 -m-1.5 p-1.5 text-muted transition-colors hover:text-ink md:hidden"
      >
        <svg width="17" height="17" viewBox="0 0 17 17" aria-hidden="true" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <line x1="11" y1="11" x2="15.5" y2="15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}

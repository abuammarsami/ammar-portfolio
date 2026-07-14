"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { PALETTE_EVENT } from "@/lib/agent/autopilot-event";

// The palette body lives in its own chunk — the eager cost of ⌘K on every
// page is just this opener (per-route budget headroom is thin; plan-0005).
const PaletteUi = dynamic(() => import("./palette-ui").then((m) => m.PaletteUi), { ssr: false });

/** Hand-rolled ⌘K palette — mono, keyboard-first, ~zero dependencies. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onEvent = () => setOpen((o) => !o); // nav trigger (mobile has no shortcut)
    window.addEventListener("keydown", onKey);
    window.addEventListener(PALETTE_EVENT, onEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(PALETTE_EVENT, onEvent);
    };
  }, []);

  if (!open) return null;
  return <PaletteUi onClose={() => setOpen(false)} />;
}

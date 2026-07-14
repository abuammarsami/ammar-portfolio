"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { AUTOPILOT_EVENT, INTERVIEW_EVENT, STAGE_DONE_EVENT } from "@/lib/agent/autopilot-event";

// The palette body lives in its own chunk — the eager cost of ⌘K on every
// page is just this opener (per-route budget headroom is thin; plan-0005).
const PaletteUi = dynamic(() => import("./palette-ui").then((m) => m.PaletteUi), { ssr: false });

/**
 * Hand-rolled ⌘K palette — mono, keyboard-first, ~zero dependencies.
 * Also the binder for the zero-JS global chrome (the nav's palette
 * triggers + the ✦ ask launcher are server HTML — "/" has no headroom
 * for more client modules, so this one island wires them all).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);

    // nav triggers: open the palette, and show the real shortcut off Apple platforms
    const toggle = () => setOpen((o) => !o);
    const triggers = document.querySelectorAll<HTMLButtonElement>("[data-pal]");
    for (const t of triggers) t.addEventListener("click", toggle);
    const key = document.querySelector("[data-pal-key]");
    if (key && !/Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)) key.textContent = "Ctrl K";

    // ✦ ask launcher: starts interview mode; hides while a stage surface is on
    const ask = document.querySelector<HTMLButtonElement>("[data-ask]");
    const openAsk = () => window.dispatchEvent(new Event(INTERVIEW_EVENT));
    const onStage = (e: Event) => ask?.classList.toggle("hidden", e.type !== STAGE_DONE_EVENT);
    ask?.addEventListener("click", openAsk);
    const stageEvs = [AUTOPILOT_EVENT, INTERVIEW_EVENT, STAGE_DONE_EVENT];
    for (const ev of stageEvs) window.addEventListener(ev, onStage);

    return () => {
      window.removeEventListener("keydown", onKey);
      for (const t of triggers) t.removeEventListener("click", toggle);
      ask?.removeEventListener("click", openAsk);
      for (const ev of stageEvs) window.removeEventListener(ev, onStage);
    };
  }, []);

  if (!open) return null;
  return <PaletteUi onClose={() => setOpen(false)} />;
}

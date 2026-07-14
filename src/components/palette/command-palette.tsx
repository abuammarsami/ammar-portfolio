"use client";

import { useEffect, useState, type ComponentType } from "react";

import { INTERVIEW_EVENT } from "@/lib/agent/autopilot-event";

// The palette body lives in its own chunk, hand-lazied on first open — the
// eager cost of ⌘K on every page is just this opener, without even the
// next/dynamic runtime (per-route budget headroom is thin; plan-0005).
type PaletteUiComponent = ComponentType<{ onClose: () => void }>;
let paletteModule: Promise<{ PaletteUi: PaletteUiComponent }> | null = null;
const loadPaletteUi = () => (paletteModule ??= import("./palette-ui"));

/**
 * Hand-rolled ⌘K palette — mono, keyboard-first, ~zero dependencies.
 * Also the binder for the zero-JS global chrome (the nav's palette
 * triggers + the ✦ ask launcher are server HTML — "/" has no headroom
 * for more client modules, so this one island wires them all).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [Ui, setUi] = useState<PaletteUiComponent | null>(null);

  useEffect(() => {
    const toggle = () => {
      void loadPaletteUi().then((m) => setUi(() => m.PaletteUi));
      setOpen((o) => !o);
    };
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);

    // one delegated binder for the zero-JS chrome: nav palette triggers open
    // the palette, the ✦ ask launcher starts interview mode (the lazy stage
    // modules hide/show the launcher themselves)
    const onClick = (e: MouseEvent) => {
      const t = (e.target as Element | null)?.closest?.("[data-pal],[data-ask]");
      if (!t) return;
      if (t.hasAttribute("data-ask")) window.dispatchEvent(new Event(INTERVIEW_EVENT));
      else toggle();
    };
    document.addEventListener("click", onClick);

    // show the real shortcut off Apple platforms (MacIntel / iPhone / iPad / iPod)
    const key = document.querySelector("[data-pal-key]");
    if (key && !/Mac|iP/.test(navigator.platform || navigator.userAgent)) key.textContent = "Ctrl K";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick);
    };
  }, []);

  if (!open || !Ui) return null;
  return <Ui onClose={() => setOpen(false)} />;
}

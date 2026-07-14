"use client";

import { useEffect, useState } from "react";

import { AUTOPILOT_EVENT, INTERVIEW_EVENT, STAGE_DONE_EVENT } from "@/lib/agent/autopilot-event";

/**
 * The one always-available door into interview mode: a quiet mono pill,
 * bottom-right on every page. Desktop has the terminal and ⌘K; on touch
 * this is the only way in. Hides while a stage surface (interview bar,
 * autopilot tour) is on — they own the bottom of the screen.
 */
export function AskLauncher() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const hide = () => setHidden(true);
    const show = () => setHidden(false);
    window.addEventListener(AUTOPILOT_EVENT, hide);
    window.addEventListener(INTERVIEW_EVENT, hide);
    window.addEventListener(STAGE_DONE_EVENT, show);
    return () => {
      window.removeEventListener(AUTOPILOT_EVENT, hide);
      window.removeEventListener(INTERVIEW_EVENT, hide);
      window.removeEventListener(STAGE_DONE_EVENT, show);
    };
  }, []);

  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(INTERVIEW_EVENT))}
      className="fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 rounded-full border rule-hair bg-surface/90 px-3.5 py-2 font-mono text-xs text-muted shadow-lg backdrop-blur transition-colors hover:text-q0 print:hidden"
    >
      <span className="text-q0">✦</span> ask
      <span className="sr-only"> — interview this site by voice or text</span>
    </button>
  );
}

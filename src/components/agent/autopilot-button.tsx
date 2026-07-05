"use client";

import { useEffect } from "react";

import { AUTOPILOT_EVENT } from "@/lib/agent/autopilot-event";

/**
 * Starts the autopilot tour (plan-0005). The tour itself is a lazy module
 * behind the WebmcpProvider's event listener — this button only dispatches.
 * Arriving with #demo (e.g. the homepage link) auto-starts once.
 */
export function AutopilotButton() {
  useEffect(() => {
    if (window.location.hash === "#demo") {
      history.replaceState(null, "", window.location.pathname);
      window.dispatchEvent(new Event(AUTOPILOT_EVENT));
    }
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(AUTOPILOT_EVENT))}
      className="mt-4 rounded-sm border border-q0/60 px-5 py-2.5 font-mono text-sm text-q0 hover:bg-q0/10"
    >
      ▶ watch the agent interview this site
    </button>
  );
}

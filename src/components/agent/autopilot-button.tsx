"use client";

import { useEffect, useState } from "react";

import { AUTOPILOT_EVENT, INTERVIEW_EVENT } from "@/lib/agent/autopilot-event";

/**
 * Starts the autopilot tour (plan-0005). The tour itself is a lazy module
 * behind the WebmcpProvider's event listener — this button only dispatches.
 * Arriving with #demo (e.g. the homepage link) auto-starts once. An optional
 * interest turns it into a personalized, LLM-planned tour (plan-0006).
 */
export function AutopilotButton() {
  const [interest, setInterest] = useState("");

  useEffect(() => {
    if (window.location.hash === "#demo") {
      history.replaceState(null, "", window.location.pathname);
      window.dispatchEvent(new Event(AUTOPILOT_EVENT));
    }
  }, []);

  const start = () => {
    const detail = interest.trim().length >= 4 ? { interest: interest.trim().slice(0, 200) } : undefined;
    window.dispatchEvent(new CustomEvent(AUTOPILOT_EVENT, { detail }));
  };

  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={start}
          className="rounded-sm border border-q0/60 px-5 py-2.5 font-mono text-sm text-q0 hover:bg-q0/10"
        >
          ▶ watch the agent interview this site
        </button>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(INTERVIEW_EVENT))}
          className="rounded-sm border border-q1/60 px-5 py-2.5 font-mono text-sm text-q1 hover:bg-q1/10"
        >
          🎙 or interview it yourself
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2 font-mono text-xs">
        <label htmlFor="tour-interest" className="text-muted">
          or tell it what to show you:
        </label>
        <input
          id="tour-interest"
          value={interest}
          onChange={(e) => setInterest(e.target.value.slice(0, 200))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && interest.trim().length >= 4) start();
          }}
          placeholder="e.g. his backend work"
          className="w-48 border-b border-muted/30 bg-transparent px-1 py-0.5 focus:border-q0 focus:outline-none"
        />
      </div>
    </div>
  );
}

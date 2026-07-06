"use client";

import { useState } from "react";

/** Template-launch waitlist (plan-0006) — the only island on /colophon. */
export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ phase: "idle" | "working" | "done" | "error"; note: string }>({
    phase: "idle",
    note: "",
  });

  const join = async () => {
    setState({ phase: "working", note: "" });
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.status === 204) setState({ phase: "done", note: "" });
      else setState({ phase: "error", note: await res.text() });
    } catch {
      setState({ phase: "error", note: "network hiccup — try again" });
    }
  };

  if (state.phase === "done") {
    return <p className="font-mono text-sm text-q0">on the list ✓ — one launch email, nothing else</p>;
  }

  return (
    <form
      className="flex flex-wrap items-center gap-2 font-mono text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        void join();
      }}
    >
      <label htmlFor="waitlist-email" className="sr-only">
        Email for the template launch
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value.slice(0, 254))}
        placeholder="you@example.com"
        className="w-56 border border-muted/30 bg-surface/50 px-3 py-1.5 focus:border-q0 focus:outline-none"
      />
      <button
        type="submit"
        disabled={state.phase === "working" || !email.includes("@")}
        className="border border-q0/60 px-4 py-1.5 text-q0 hover:bg-q0/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {state.phase === "working" ? "joining…" : "→ notify me at launch"}
      </button>
      {state.note && <span className="text-xs text-muted">{state.note}</span>}
      <span className="w-full text-xs text-muted">stored only until the launch email is sent, then deleted</span>
    </form>
  );
}

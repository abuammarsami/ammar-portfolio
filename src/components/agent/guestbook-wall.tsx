"use client";

import { useEffect, useState } from "react";

import type { GuestbookEvent } from "@/lib/agent/guestbook";

function ago(t: number): string {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return "just now";
  if (s < 5400) return `${Math.round(s / 60)}m ago`;
  if (s < 129600) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/**
 * The "agents were here" wall (ADR-0010). Fetches the cached guestbook feed
 * once on mount; fixed min-height reserves the space (CLS 0).
 */
export function GuestbookWall() {
  const [events, setEvents] = useState<GuestbookEvent[] | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch("/api/guestbook")
      .then((r) => r.json())
      .then((d: { events?: GuestbookEvent[] }) => {
        if (alive) setEvents(Array.isArray(d.events) ? d.events.slice(0, 20) : []);
      })
      .catch(() => {
        if (alive) setEvents([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="mt-4 min-h-40 rounded-sm border rule-hair bg-surface/60 p-4 font-mono text-sm" aria-live="polite">
      {events === null && <p className="text-muted">reading the guestbook …</p>}
      {events?.length === 0 && (
        <p className="text-muted">no agent visits recorded yet — be the first: point your agent at /api/mcp</p>
      )}
      {events && events.length > 0 && (
        <ul className="space-y-1.5">
          {events.map((e, i) => (
            <li key={`${e.t}-${i}`} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-q0">{e.client}</span>
              <span className="text-muted">called</span>
              <span className="text-q1">{e.tool}</span>
              <span className="text-muted">
                via {e.surface} · {ago(e.t)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

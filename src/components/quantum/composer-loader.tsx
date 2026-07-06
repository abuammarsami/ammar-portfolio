"use client";

import dynamic from "next/dynamic";

/**
 * Client boundary for the composer island (plan-0006): ssr:false keeps the
 * whole simulator + composer out of the eager first-load chunk set; the
 * placeholder reserves the island's height so hydration causes zero CLS.
 */
const Composer = dynamic(() => import("./composer").then((m) => m.Composer), {
  ssr: false,
  loading: () => (
    <div className="min-h-[420px] rounded-sm border rule-hair bg-surface p-5 font-mono text-xs text-muted" aria-hidden>
      loading the statevector engine …
    </div>
  ),
});

export function ComposerLoader() {
  return <Composer />;
}

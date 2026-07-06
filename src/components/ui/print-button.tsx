"use client";

/** The one honest cost of a print affordance — window.print needs JS. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print border border-q0/60 px-4 py-1.5 font-mono text-sm text-q0 hover:bg-q0/10"
    >
      ⎙ print / save as PDF
    </button>
  );
}

"use client";

import { useState } from "react";

export function BibtexBlock({ entry }: { entry: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(entry);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="relative my-8 rounded-sm border rule-hair bg-surface">
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 font-mono text-xs text-muted transition-colors hover:text-q0"
        aria-label="Copy BibTeX"
      >
        {copied ? "copied ✓" : "copy"}
      </button>
      <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-muted">
        {entry}
      </pre>
    </div>
  );
}

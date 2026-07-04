/**
 * Preprint-footnote explainer: native <details>, zero JS (ADR-0006 §inline).
 * Pages fetch the html from getExplainers() and pass the entry down.
 */
export function ExplainThis({ html, label = "what am I looking at?" }: { html: string; label?: string }) {
  return (
    <details className="group mt-3 border-l rule-hair pl-3">
      <summary className="cursor-pointer list-none font-mono text-xs text-muted transition-colors hover:text-q0 [&::-webkit-details-marker]:hidden">
        <span className="text-q1">※</span> {label}{" "}
        <span className="group-open:hidden">▸</span>
        <span className="hidden group-open:inline">▾</span>
      </summary>
      <div
        className="mt-2 max-w-xl font-serif text-sm leading-relaxed text-muted [&_a]:text-q0 [&_a]:hover:underline [&_strong]:text-ink"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </details>
  );
}

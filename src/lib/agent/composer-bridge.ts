import type { Op } from "@/components/quantum/circuit";

/**
 * The composer bridge (plan-0006) — same contract as hero-bridge: the
 * /playground composer island is the single owner of its state; agents
 * (WebMCP compose_circuit) publish requests through a CustomEvent and read
 * back a snapshot. Client-safe, no React.
 */

export const COMPOSER_SET_EVENT = "ammar:composer-set-circuit";

export type ComposerSnapshot = {
  mounted: boolean;
  ops: Op[];
};

let snapshot: ComposerSnapshot = { mounted: false, ops: [] };

export function publishComposerSnapshot(next: Partial<ComposerSnapshot>): void {
  snapshot = { ...snapshot, ...next, ops: (next.ops ?? snapshot.ops).map((o) => ({ ...o })) };
}

export function getComposerSnapshot(): ComposerSnapshot {
  return { mounted: snapshot.mounted, ops: snapshot.ops.map((o) => ({ ...o })) };
}

/** Ask a mounted composer to load a circuit. No-op when /playground isn't open. */
export function requestComposerCircuit(ops: Op[]): void {
  if (typeof window === "undefined" || !snapshot.mounted) return;
  window.dispatchEvent(new CustomEvent(COMPOSER_SET_EVENT, { detail: { ops } }));
}

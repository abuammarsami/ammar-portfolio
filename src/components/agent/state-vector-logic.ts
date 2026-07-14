/**
 * Pure amplitude logic for the About state-vector flourish:
 *
 *   |ammar⟩ = 0.71 |backend engineer⟩ + 0.71 |QML researcher⟩
 *
 * Ket 0 is the engineering basis state, ket 1 the research basis state.
 * An unmeasured visitor (no lens ever chosen) sees the equal superposition;
 * choosing a lens is the measurement: the professor lens collapses the state
 * onto ket 1, every other lens (recruiter, engineer) onto ket 0.
 * Dependency-free and unit-tested (colocated *.test.ts), like the quantum sim.
 */

import type { Lens } from "@/lib/agent/lens";

/** Real amplitudes of the two basis states; always normalized (a0² + a1² = 1). */
export type Amplitudes = { a0: number; a1: number };

/** The unmeasured identity: 1/√2 on each ket. */
export const SUPERPOSITION: Amplitudes = { a0: Math.SQRT1_2, a1: Math.SQRT1_2 };

/**
 * Maps the measured lens to target amplitudes. `null` = never measured
 * (no stored lens) → superposition; professor → |research ket⟩; the
 * recruiter-ish lenses (recruiter, engineer) → |engineering ket⟩.
 */
export function amplitudesForLens(lens: Lens | null): Amplitudes {
  if (lens === null) return SUPERPOSITION;
  return lens === "professor" ? { a0: 0, a1: 1 } : { a0: 1, a1: 0 };
}

/** Fixed-width display form: always d.dd (4 chars), so animated digits never shift layout. */
export function formatAmplitude(a: number): string {
  return a.toFixed(2);
}

/** Easing for the collapse animation (rAF interpolation in the component). */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

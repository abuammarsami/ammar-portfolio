import { cnot01, expZ, ry, zeroState } from "./statevector";

/**
 * Quanvolution (from the thesis): a 2×2 image patch drives RY encodings on
 * 2 qubits across 2 layers, entangled by CNOTs; the channel output is ⟨Z₁⟩.
 * Shared by the thesis-page demo and /learn Lesson 6 — one tested implementation.
 */
export function quanvPatch(
  patch: [number, number, number, number],
  offset: number,
): number {
  let s = zeroState();
  s = ry(s, 0, patch[0] * Math.PI + offset);
  s = ry(s, 1, patch[1] * Math.PI + offset);
  s = cnot01(s);
  s = ry(s, 0, patch[2] * Math.PI);
  s = ry(s, 1, patch[3] * Math.PI);
  s = cnot01(s);
  return expZ(s, 1); // −1 … +1
}

/** Fixed filter channels: deterministic rotation offsets (no randomness). */
export const QUANV_FILTERS = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4] as const;

/** Sweep an n×n grid (n even) with the 2×2 quantum filter → one map per channel. */
export function quanvFeatureMaps(grid: number[], n: number): number[][] {
  const out = n / 2;
  return QUANV_FILTERS.map((offset) => {
    const m: number[] = [];
    for (let r = 0; r < out; r++) {
      for (let c = 0; c < out; c++) {
        m.push(
          quanvPatch(
            [
              grid[2 * r * n + 2 * c]!,
              grid[2 * r * n + 2 * c + 1]!,
              grid[(2 * r + 1) * n + 2 * c]!,
              grid[(2 * r + 1) * n + 2 * c + 1]!,
            ],
            offset,
          ),
        );
      }
    }
    return m;
  });
}

/** Deterministic RNG (mulberry32) for measurement-shot demos — replays identically. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

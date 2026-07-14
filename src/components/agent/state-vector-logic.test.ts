import { describe, expect, it } from "vitest";
import { LENSES } from "@/lib/agent/lens";
import { SUPERPOSITION, amplitudesForLens, easeOutCubic, formatAmplitude } from "./state-vector-logic";

describe("amplitudesForLens", () => {
  it("returns the equal superposition when no lens has been measured", () => {
    expect(amplitudesForLens(null)).toEqual(SUPERPOSITION);
    expect(SUPERPOSITION.a0).toBeCloseTo(Math.SQRT1_2, 10);
    expect(SUPERPOSITION.a1).toBeCloseTo(Math.SQRT1_2, 10);
  });

  it("collapses onto the research ket under the professor lens", () => {
    expect(amplitudesForLens("professor")).toEqual({ a0: 0, a1: 1 });
  });

  it("collapses onto the engineering ket under the recruiter-ish lenses", () => {
    expect(amplitudesForLens("recruiter")).toEqual({ a0: 1, a1: 0 });
    expect(amplitudesForLens("engineer")).toEqual({ a0: 1, a1: 0 });
  });

  it("stays normalized for every possible input", () => {
    for (const lens of [null, ...LENSES] as const) {
      const { a0, a1 } = amplitudesForLens(lens);
      expect(a0 * a0 + a1 * a1).toBeCloseTo(1, 10);
    }
  });
});

describe("formatAmplitude", () => {
  it("formats the canonical states to two decimals", () => {
    expect(formatAmplitude(Math.SQRT1_2)).toBe("0.71");
    expect(formatAmplitude(1)).toBe("1.00");
    expect(formatAmplitude(0)).toBe("0.00");
  });

  it("always yields a fixed 4-character slot for in-flight animation values", () => {
    for (const a of [0, 0.05, 0.333, Math.SQRT1_2, 0.999, 1]) {
      expect(formatAmplitude(a)).toHaveLength(4);
    }
  });
});

describe("easeOutCubic", () => {
  it("pins the endpoints and stays monotonic in between", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    let prev = 0;
    for (let t = 0.1; t <= 1.0001; t += 0.1) {
      const v = easeOutCubic(Math.min(t, 1));
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

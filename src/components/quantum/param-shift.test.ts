import { describe, expect, it } from "vitest";

import { descendStep, expZAt, shiftGradient, sweep } from "./param-shift";
import { classify, type Params } from "./statevector";

const P: Params = [0.7, -1.2, 0.4, 2.1];
const X = 0.8;

/** Central finite-difference derivative of ⟨Z⟩ w.r.t. parameter k. */
function finiteDiff(x: number, p: Params, k: number, hstep = 1e-5): number {
  const plus = [...p] as Params;
  const minus = [...p] as Params;
  plus[k] = plus[k]! + hstep;
  minus[k] = minus[k]! - hstep;
  return (classify(x, plus) - classify(x, minus)) / (2 * hstep);
}

describe("shiftGradient", () => {
  it("matches a central finite-difference derivative for every parameter", () => {
    for (let k = 0; k < 4; k++) {
      const { gradient } = shiftGradient(X, P, k);
      expect(gradient).toBeCloseTo(finiteDiff(X, P, k), 5);
    }
  });

  it("returns the two ±π/2 evaluations that define the gradient", () => {
    const r = shiftGradient(X, P, 0);
    expect(r.plus).toBeCloseTo(expZAt(X, P, 0, P[0] + Math.PI / 2), 12);
    expect(r.minus).toBeCloseTo(expZAt(X, P, 0, P[0] - Math.PI / 2), 12);
    expect(r.gradient).toBeCloseTo((r.plus - r.minus) / 2, 12);
    expect(r.center).toBeCloseTo(classify(X, P), 12);
  });
});

describe("sweep", () => {
  it("is 2π-periodic: first and last samples meet", () => {
    const c = sweep(X, P, 1, 48);
    expect(c).toHaveLength(49);
    expect(c[0]!.z).toBeCloseTo(c[c.length - 1]!.z, 12);
    for (const pt of c) expect(pt.z).toBeGreaterThanOrEqual(-1.000001);
  });
});

describe("descendStep", () => {
  it("moves ⟨Z⟩ downhill and converges toward the curve minimum", () => {
    let p = P;
    const start = classify(X, p);
    for (let i = 0; i < 400; i++) p = descendStep(X, p, 0, 0.3);
    const end = classify(X, p);
    expect(end).toBeLessThan(start);
    // near a minimum the parameter-shift gradient vanishes
    expect(Math.abs(shiftGradient(X, p, 0).gradient)).toBeLessThan(1e-3);
  });
});

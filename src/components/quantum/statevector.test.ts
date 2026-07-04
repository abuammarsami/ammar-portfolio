import { describe, expect, it } from "vitest";
import {
  blochVector,
  classify,
  cnot01,
  expZ,
  gradient,
  h,
  loss,
  ry,
  rz,
  trainStep,
  zeroState,
  type Params,
  type Sample,
} from "./statevector";

const close = (a: number, b: number) => expect(a).toBeCloseTo(b, 10);

describe("gate identities", () => {
  it("H|0⟩ = (|0⟩+|1⟩)/√2 on either qubit", () => {
    const s = h(zeroState(), 1);
    close(s[0].re, Math.SQRT1_2);
    close(s[1].re, Math.SQRT1_2);
    close(expZ(s, 1), 0);
    close(expZ(s, 0), 1); // untouched qubit stays |0⟩
  });

  it("RY(π)|0⟩ = |1⟩", () => {
    const s = ry(zeroState(), 0, Math.PI);
    close(s[0].re, 0);
    close(s[2].re, 1); // index 2 = |10⟩
    close(expZ(s, 0), -1);
  });

  it("⟨Z⟩ after RY(θ)|0⟩ equals cos(θ) (analytic check)", () => {
    for (const theta of [0.3, 1.1, 2.5]) {
      close(expZ(ry(zeroState(), 0, theta), 0), Math.cos(theta));
    }
  });

  it("RZ leaves ⟨Z⟩ invariant but rotates the Bloch X into Y", () => {
    let s = h(zeroState(), 0); // Bloch vector along +X
    close(blochVector(s, 0).x, 1);
    s = rz(s, 0, Math.PI / 2);
    const b = blochVector(s, 0);
    close(b.z, 0);
    close(Math.abs(b.y), 1); // rotated into ±Y
  });

  it("H then CNOT produces the Bell state (entanglement)", () => {
    const s = cnot01(h(zeroState(), 0));
    close(s[0].re, Math.SQRT1_2); // |00⟩
    close(s[3].re, Math.SQRT1_2); // |11⟩
    close(s[1].re, 0);
    close(s[2].re, 0);
    // maximally entangled ⇒ each qubit's Bloch vector has length 0
    const b = blochVector(s, 0);
    close(Math.hypot(b.x, b.y, b.z), 0);
  });

  it("norm is preserved through a full circuit", () => {
    const s = classifyState();
    const norm = s.reduce((n, a) => n + a.re * a.re + a.im * a.im, 0);
    close(norm, 1);
  });

  function classifyState() {
    let s = zeroState();
    s = ry(s, 0, 0.7);
    s = ry(s, 1, 1.3);
    s = cnot01(s);
    s = rz(s, 0, 0.4);
    s = h(s, 1);
    return s;
  }
});

describe("parameter-shift training", () => {
  const data: Sample[] = [
    { x: Math.PI / 4, y: 1 },
    { x: -Math.PI / 4, y: -1 },
  ];
  const init: Params = [5.8, 0.3, 4.9, 1.2];

  it("parameter-shift gradient matches finite differences", () => {
    const g = gradient(data, init);
    const eps = 1e-6;
    for (let k = 0; k < 4; k++) {
      const plus = [...init] as Params;
      const minus = [...init] as Params;
      plus[k] = plus[k]! + eps;
      minus[k] = minus[k]! - eps;
      const fd = (loss(data, plus) - loss(data, minus)) / (2 * eps);
      expect(g[k]).toBeCloseTo(fd, 5);
    }
  });

  it("gradient descent converges the classifier", () => {
    let p = init;
    const l0 = loss(data, p);
    for (let i = 0; i < 400; i++) p = trainStep(data, p, 0.35);
    const l1 = loss(data, p);
    expect(l1).toBeLessThan(l0);
    expect(l1).toBeLessThan(0.05);
    // predictions land on the right side for both classes
    expect(classify(data[0]!.x, p)).toBeGreaterThan(0.5);
    expect(classify(data[1]!.x, p)).toBeLessThan(-0.5);
  });
});

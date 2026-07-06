import { describe, expect, it } from "vitest";

import { composeCircuit } from "@/lib/agent/compose-circuit";
import { getComposerSnapshot, publishComposerSnapshot, requestComposerCircuit } from "@/lib/agent/composer-bridge";
import { describeCircuit, MAX_OPS, parseCircuit, runCircuit, serializeCircuit, type Op } from "./circuit";
import { expZZ, probabilities } from "./statevector";

describe("runCircuit", () => {
  it("empty circuit is |00⟩", () => {
    expect(probabilities(runCircuit([]))).toEqual([1, 0, 0, 0]);
  });

  it("h0_cx builds a Bell pair: P(00)=P(11)=1/2, ⟨Z⊗Z⟩=1", () => {
    const state = runCircuit(parseCircuit("h0_cx")!);
    const p = probabilities(state);
    expect(p[0]).toBeCloseTo(0.5, 10);
    expect(p[3]).toBeCloseTo(0.5, 10);
    expect(p[1]).toBeCloseTo(0, 10);
    expect(p[2]).toBeCloseTo(0, 10);
    expect(expZZ(state)).toBeCloseTo(1, 10);
  });

  it("ry0:π flips q0: P(10)=1", () => {
    const p = probabilities(runCircuit([{ gate: "ry", q: 0, theta: Math.PI }]));
    expect(p[2]).toBeCloseTo(1, 10);
  });

  it("ignores ops beyond MAX_OPS", () => {
    const flips: Op[] = Array.from({ length: MAX_OPS + 1 }, () => ({ gate: "ry", q: 0, theta: Math.PI }));
    // MAX_OPS (16, even) flips → back to |00⟩; the 17th is dropped
    expect(probabilities(runCircuit(flips))[0]).toBeCloseTo(1, 10);
  });
});

describe("serialize / parse round trip", () => {
  it("round-trips gates with and without theta", () => {
    const ops = parseCircuit("h0_ry1:0.7854_rz0:-1.5_cx_h1")!;
    expect(parseCircuit(serializeCircuit(ops))).toEqual(ops);
  });

  it("normalizes -0 and clamps |θ| to π", () => {
    expect(serializeCircuit([{ gate: "ry", q: 0, theta: -0.00001 }])).toBe("ry0:0");
    const clamped = parseCircuit(serializeCircuit([{ gate: "rz", q: 1, theta: 9 }]))!;
    expect(clamped[0]!.theta).toBeCloseTo(Math.PI, 3);
  });

  it("rejects junk, oversize, and off-grammar strings (never throws)", () => {
    for (const bad of ["", "x0", "h2", "ry0", "ry0:abc", "h0--cx", "cx:1", "h0-".repeat(30) + "h0", 42, null, "h0;alert(1)"]) {
      expect(parseCircuit(bad)).toBeNull();
    }
  });

  it("parses θ clamping out-of-range values", () => {
    expect(parseCircuit("ry0:99")![0]!.theta).toBeCloseTo(Math.PI, 10);
  });
});

describe("composeCircuit (the shared tool body)", () => {
  it("returns probabilities, bloch vectors, and a share URL for a Bell pair", () => {
    const out = JSON.parse(composeCircuit("h0_cx")) as {
      probabilities: Record<string, number>;
      bloch: { q0: { x: number; y: number; z: number } };
      shareUrl: string;
    };
    expect(out.probabilities["00"]).toBeCloseTo(0.5, 10);
    expect(out.probabilities["11"]).toBeCloseTo(0.5, 10);
    // a maximally entangled qubit has a zero Bloch vector (fully mixed marginal)
    expect(Math.hypot(out.bloch.q0.x, out.bloch.q0.y, out.bloch.q0.z)).toBeCloseTo(0, 10);
    expect(out.shareUrl).toContain("/playground?c=h0_cx");
  });

  it("throws the grammar hint on invalid input", () => {
    expect(() => composeCircuit("teleport-now")).toThrow(/grammar/);
  });
});

describe("describeCircuit", () => {
  it("names steps human-readably", () => {
    expect(describeCircuit(parseCircuit("h0_cx")!)).toBe("H q0 · CNOT(q0→q1)");
    expect(describeCircuit([])).toContain("empty");
  });
});

describe("composer bridge", () => {
  it("snapshots deep-copy and requestComposerCircuit no-ops when unmounted", () => {
    publishComposerSnapshot({ mounted: false, ops: [] });
    expect(() => requestComposerCircuit([{ gate: "h", q: 0 }])).not.toThrow();
    publishComposerSnapshot({ mounted: true, ops: [{ gate: "h", q: 0 }] });
    const snap = getComposerSnapshot();
    snap.ops[0]!.q = 1;
    expect(getComposerSnapshot().ops[0]!.q).toBe(0);
    publishComposerSnapshot({ mounted: false, ops: [] });
  });
});

import { describe, expect, it } from "vitest";

import { collectRepoStats, countDeps, countTestCases, readBuildStats } from "./stats";

describe("countTestCases", () => {
  it("counts it( and test( call sites only", () => {
    expect(countTestCases(`it("a", () => {}); test("b", () => {}); iterate(); attest();`)).toBe(2);
    expect(countTestCases("")).toBe(0);
  });
});

describe("countDeps", () => {
  it("counts runtime and dev dependencies separately", () => {
    expect(countDeps(JSON.stringify({ dependencies: { a: "1", b: "2" }, devDependencies: { c: "3" } }))).toEqual({
      runtimeDeps: 2,
      devDeps: 1,
    });
    expect(countDeps("{}")).toEqual({ runtimeDeps: 0, devDeps: 0 });
  });
});

describe("collectRepoStats (real repo)", () => {
  it("finds this repo's actual shape", () => {
    const s = collectRepoStats();
    expect(s.testFiles).toBeGreaterThanOrEqual(15);
    expect(s.testCases).toBeGreaterThanOrEqual(100);
    expect(s.adrs).toBeGreaterThanOrEqual(11);
    expect(s.contentFiles).toBeGreaterThanOrEqual(20);
    // the honesty claim on /colophon: a small runtime footprint. The markdown
    // pipeline (remark/rehype/shiki + KaTeX for typeset math) genuinely runs at
    // request time in the AI-agent routes, so it counts as runtime — keep it lean.
    expect(s.runtimeDeps).toBeLessThan(30);
  });
});

describe("readBuildStats", () => {
  it("returns null or a well-shaped stats object (never throws)", () => {
    const b = readBuildStats();
    if (b !== null) {
      expect(b.commit).toMatch(/^[0-9a-f]{6,12}$/);
      expect(b.routes.length).toBeGreaterThanOrEqual(8);
      for (const r of b.routes) expect(r.gzBytes).toBeLessThanOrEqual(r.limitBytes);
    }
  });
});

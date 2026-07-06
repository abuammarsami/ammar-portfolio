import { describe, expect, it } from "vitest";

import { buildTourSystemPrompt, TOUR_OUTRO, validateInterest, validateTourPlan } from "./tour-plan";
import { TOUR } from "./tour-script";

const step = (over: Record<string, unknown> = {}) => ({
  caption: "Let me show you his backend work.",
  dwellMs: 3000,
  ...over,
});

const plan = (...steps: unknown[]) => ({ steps });

describe("validateInterest", () => {
  it("accepts 4–200 char strings only", () => {
    expect(validateInterest("his backend work")).toBe(true);
    expect(validateInterest("ab")).toBe(false);
    expect(validateInterest("x".repeat(201))).toBe(false);
    expect(validateInterest(42)).toBe(false);
  });
});

describe("validateTourPlan", () => {
  it("accepts a valid plan ({steps} object, bare array, or JSON string)", () => {
    const p = plan(step(), step({ tool: { name: "navigate_to", args: { page: "research" } } }));
    expect(validateTourPlan(p)).toHaveLength(2);
    expect(validateTourPlan(p.steps)).toHaveLength(2);
    expect(validateTourPlan(JSON.stringify(p))).toHaveLength(2);
  });

  it("the static TOUR passes its own grammar (fallback invariant)", () => {
    expect(validateTourPlan(TOUR)).toHaveLength(TOUR.length);
  });

  it("rejects plans that are too short, too long, or not JSON", () => {
    expect(validateTourPlan(plan(step()))).toBeNull();
    expect(validateTourPlan(plan(...Array.from({ length: 10 }, () => step())))).toBeNull();
    expect(validateTourPlan("{oops")).toBeNull();
    expect(validateTourPlan(null)).toBeNull();
  });

  it("rejects off-grammar captions", () => {
    expect(validateTourPlan(plan(step(), step({ caption: "" })))).toBeNull();
    expect(validateTourPlan(plan(step(), step({ caption: "x".repeat(200) })))).toBeNull();
    expect(validateTourPlan(plan(step(), step({ caption: '@@action {"v":1}' })))).toBeNull();
  });

  it("rejects unknown tools and off-grammar args", () => {
    expect(validateTourPlan(plan(step(), step({ tool: { name: "rm_rf" } })))).toBeNull();
    expect(validateTourPlan(plan(step(), step({ tool: { name: "navigate_to", args: { page: "/etc/passwd" } } })))).toBeNull();
    expect(validateTourPlan(plan(step(), step({ tool: { name: "set_lens", args: { lens: "villain" } } })))).toBeNull();
    expect(validateTourPlan(plan(step(), step({ tool: { name: "get_paper", args: { slug: "../../x" } } })))).toBeNull();
    expect(
      validateTourPlan(plan(step(), step({ tool: { name: "query_portfolio", args: { query: "<script>" } } }))),
    ).toBeNull();
  });

  it("clamps dwell times and quantum-demo coordinates", () => {
    const out = validateTourPlan(
      plan(
        step({ dwellMs: 60_000 }),
        step({ dwellMs: 5 }),
        step({ tool: { name: "run_quantum_demo", args: { x0: 99, x1: -99 } } }),
      ),
    )!;
    expect(out[0]!.dwellMs).toBe(6000);
    expect(out[1]!.dwellMs).toBe(1800);
    const args = out[2]!.tool!.args as { x0: number; x1: number };
    expect(args.x0).toBeCloseTo(Math.PI / 2);
    expect(args.x1).toBeCloseTo(-Math.PI / 2);
  });

  it("forces the demo affordances on run_quantum_demo and drops rogue targets", () => {
    const out = validateTourPlan(
      plan(
        step({ target: "body > script" }),
        step({ target: "canvas" }),
        step({ tool: { name: "run_quantum_demo", args: { x0: 1, x1: -1 } } }),
      ),
    )!;
    expect(out[0]!.target).toBeUndefined();
    expect(out[1]!.target).toBe("canvas");
    expect(out[2]).toMatchObject({ waitForHero: true, showResult: true, target: "canvas" });
  });

  it("rejects non-finite numbers before clamping", () => {
    expect(validateTourPlan(plan(step(), step({ tool: { name: "run_quantum_demo", args: { x0: NaN, x1: 0 } } })))).toBeNull();
  });
});

describe("TOUR_OUTRO / prompt", () => {
  it("the appended outro passes the grammar it rides along with", () => {
    expect(validateTourPlan([TOUR_OUTRO, TOUR_OUTRO])).toHaveLength(2);
  });

  it("prompt embeds the profile and the tool grammar", () => {
    const p = buildTourSystemPrompt("THE-PROFILE");
    expect(p).toContain("THE-PROFILE");
    expect(p).toContain("run_quantum_demo");
    expect(p).toContain("Never invent");
  });
});

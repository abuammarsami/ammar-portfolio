import { describe, expect, it } from "vitest";

import { claimHeroWriter, releaseHeroWriter } from "./hero-bridge";
import { TOUR } from "./tour-script";
import { createWebmcpTools } from "./webmcp-tools";

const REGISTRY = createWebmcpTools({
  navigate: () => {},
  download: () => {},
  fetchText: async () => "",
  mcpCall: async () => "",
  setLens: () => {},
});

describe("tour-script", () => {
  it("only calls tools that exist in the WebMCP registry (drift guard)", () => {
    const names = new Set(REGISTRY.map((t) => t.name));
    for (const step of TOUR) {
      if (step.tool) expect(names.has(step.tool.name), `tour tool ${step.tool.name}`).toBe(true);
    }
  });

  it("passes valid args: pages exist, hero points in range, lens valid", () => {
    for (const step of TOUR) {
      const args = step.tool?.args ?? {};
      if (step.tool?.name === "navigate_to") expect(["home", "learn", "work", "research", "about", "agents", "writing"]).toContain(args.page);
      if (step.tool?.name === "run_quantum_demo") {
        expect(Math.abs(args.x0 as number)).toBeLessThanOrEqual(Math.PI / 2);
        expect(Math.abs(args.x1 as number)).toBeLessThanOrEqual(Math.PI / 2);
      }
      if (step.tool?.name === "set_lens") expect(["recruiter", "professor", "engineer"]).toContain(args.lens);
    }
  });

  it("reads like a demo: narrated, human-paced, opens without acting and closes with the pitch", () => {
    expect(TOUR.length).toBeGreaterThanOrEqual(6);
    for (const step of TOUR) {
      expect(step.caption.length).toBeGreaterThan(20);
      expect(step.dwellMs).toBeGreaterThanOrEqual(1500);
      expect(step.dwellMs).toBeLessThanOrEqual(8000);
    }
    expect(TOUR[0]!.tool).toBeUndefined();
    expect(TOUR.at(-1)!.caption).toContain("/api/mcp");
    // the hero step waits for the canvas after navigation
    const demo = TOUR.find((s) => s.tool?.name === "run_quantum_demo");
    expect(demo?.waitForHero).toBe(true);
  });
});

describe("hero single-writer guard", () => {
  it("grants, blocks competitors, is re-entrant, and releases only for the holder", () => {
    expect(claimHeroWriter("a")).toBe(true);
    expect(claimHeroWriter("a")).toBe(true); // re-entrant
    expect(claimHeroWriter("b")).toBe(false);
    releaseHeroWriter("b"); // not the holder — no effect
    expect(claimHeroWriter("b")).toBe(false);
    releaseHeroWriter("a");
    expect(claimHeroWriter("b")).toBe(true);
    releaseHeroWriter("b");
  });
});

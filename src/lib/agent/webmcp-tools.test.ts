import { describe, expect, it, vi } from "vitest";
import { publishHeroSnapshot } from "./hero-bridge";
import { createWebmcpTools, PAGES, searchCorpusSections, type WebmcpDeps } from "./webmcp-tools";

const CORPUS = `# Md. Abu Ammar

## Projects
KioskVisionAI — AI-powered kiosk monitoring on Azure. /work/kioskvisionai

## Publications
Machine Learning In The Realm Of Quantum — QNN 92% vs classical 96% on MNIST. /research/quantum-machine-learning-thesis

## Skills
.NET, Azure, payments, quantum machine learning
`;

function deps(overrides: Partial<WebmcpDeps> = {}): WebmcpDeps {
  return {
    navigate: vi.fn(),
    download: vi.fn(),
    fetchText: vi.fn(async () => CORPUS),
    mcpCall: vi.fn(async () => ""),
    ...overrides,
  };
}

describe("webmcp tool descriptors", () => {
  const tools = createWebmcpTools(deps());

  it("are valid per the WebMCP contract (name charset, non-empty descriptions, object schemas)", () => {
    expect(tools.length).toBeLessThanOrEqual(8);
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const t of tools) {
      expect(t.name).toMatch(/^[a-zA-Z0-9_.-]{1,128}$/);
      expect(t.description.length).toBeGreaterThan(10);
      expect(t.inputSchema.type).toBe("object");
    }
  });

  it("exposes the full surface: query, resume, paper, navigation, download, demo, contact", () => {
    expect(tools.map((t) => t.name)).toEqual([
      "query_portfolio",
      "get_resume_summary",
      "get_paper",
      "navigate_to",
      "download_resume",
      "run_quantum_demo",
      "contact",
    ]);
  });
});

describe("searchCorpusSections", () => {
  it("returns matching ## sections only", () => {
    const hits = searchCorpusSections(CORPUS, "kiosk");
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("KioskVisionAI");
    expect(searchCorpusSections(CORPUS, "nonexistent-term")).toHaveLength(0);
  });
});

describe("navigate_to", () => {
  it("navigates to whitelisted pages and rejects unknown ones", async () => {
    const d = deps();
    const nav = createWebmcpTools(d).find((t) => t.name === "navigate_to")!;
    const ok = await nav.execute({ page: "research" });
    expect(d.navigate).toHaveBeenCalledWith("/research");
    expect(ok).toContain("/research");
    const bad = await nav.execute({ page: "/etc/passwd" });
    expect(bad).toContain("unknown page");
    expect(d.navigate).toHaveBeenCalledTimes(1);
    expect(Object.values(PAGES).every((p) => p.path.startsWith("/"))).toBe(true);
  });
});

describe("query_portfolio", () => {
  it("returns matching sections and prompts for empty queries", async () => {
    const d = deps();
    const q = createWebmcpTools(d).find((t) => t.name === "query_portfolio")!;
    const res = await q.execute({ query: "quantum" });
    expect(res).toContain("Realm Of Quantum");
    expect(await q.execute({})).toContain("give me a query");
  });
});

describe("run_quantum_demo", () => {
  it("refuses when the hero is not mounted", async () => {
    publishHeroSnapshot({ mounted: false });
    const demo = createWebmcpTools(deps()).find((t) => t.name === "run_quantum_demo")!;
    const res = await demo.execute({ x0: 1 });
    expect(res).toContain("navigate_to");
  });
});

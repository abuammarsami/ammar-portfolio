import { parseCircuit } from "@/components/quantum/circuit";
import { composeCircuit } from "@/lib/agent/compose-circuit";
import { getComposerSnapshot, requestComposerCircuit } from "@/lib/agent/composer-bridge";
import { claimHeroWriter, getHeroSnapshot, releaseHeroWriter, requestHeroData } from "@/lib/agent/hero-bridge";
import { isLens, LENSES, type Lens } from "@/lib/agent/lens";
import { LINKS, SITE_URL } from "@/lib/site";

/**
 * WebMCP tool registry — ADR-0009. Pure and React-free so descriptors and
 * handlers stay unit-testable; the provider component only mounts them.
 * Data tools proxy the MCP layer via /api/mcp (one source of truth);
 * navigate_to / run_quantum_demo add what only a browser tab can offer.
 * WebMCP is an origin-trial API "subject to change" — keep all knowledge
 * of it inside this module and the provider.
 */

export type WebmcpTool = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  annotations?: { readOnlyHint?: boolean };
  execute(input: Record<string, unknown>): Promise<string>;
};

export type WebmcpDeps = {
  navigate(path: string): void;
  download(path: string): void;
  fetchText(url: string): Promise<string>;
  mcpCall(tool: string, args: Record<string, unknown>): Promise<string>;
  setLens(lens: Lens): void;
};

export const PAGES: Record<string, { path: string; blurb: string }> = {
  home: { path: "/", blurb: "hero with the live 2-qubit variational classifier, selected work, research highlights" },
  learn: { path: "/learn", blurb: "6-lesson interactive quantum curriculum" },
  playground: { path: "/playground", blurb: "2-qubit circuit composer — compose_circuit drives it live" },
  work: { path: "/work", blurb: "engineering and research case studies" },
  research: { path: "/research", blurb: "the research library — real papers, distilled" },
  about: { path: "/about", blurb: "narrative, experience timeline, skills" },
  agents: { path: "/agents", blurb: "the machine interface: MCP, WebMCP, feeds, fit report" },
  hire: { path: "/hire", blurb: "paid services: QML tutoring, .NET/Azure consulting, office hours" },
  cv: { path: "/cv", blurb: "typeset curriculum vitae, print-ready, lens-aware" },
  writing: { path: "/writing", blurb: "writing and research index" },
};

/** Split the llms-full.txt corpus into ## sections and return those matching the query. */
export function searchCorpusSections(corpus: string, query: string): string[] {
  const q = query.toLowerCase();
  const sections = corpus.split(/\n(?=##? )/);
  return sections.filter((s) => s.toLowerCase().includes(q));
}

let demoSeq = 0;

export function createWebmcpTools(deps: WebmcpDeps): WebmcpTool[] {
  let corpusCache: string | null = null;
  const corpus = async () => (corpusCache ??= await deps.fetchText("/llms-full.txt"));

  return [
    {
      name: "query_portfolio",
      description:
        "Search Md. Abu Ammar's entire portfolio (projects, experience, skills, papers, lessons). Returns matching sections with site paths.",
      inputSchema: { type: "object", properties: { query: { type: "string", description: "keyword or phrase, e.g. 'payments', 'quantum', 'distillation'" } }, required: ["query"] },
      annotations: { readOnlyHint: true },
      async execute(input) {
        const query = String(input.query ?? "").trim();
        if (!query) return "give me a query — e.g. 'payments', 'quantum', 'Bangla POS'";
        const sections = searchCorpusSections(await corpus(), query).slice(0, 6);
        const pubs = await deps.mcpCall("search_publications", { query }).catch(() => "");
        if (sections.length === 0 && !pubs) return `nothing in the portfolio matches "${query}" — try query_portfolio with a broader term, or get_resume_summary`;
        return [sections.join("\n\n"), pubs ? `\n\nPublications match:\n${pubs}` : ""].join("");
      },
    },
    {
      name: "get_resume_summary",
      description: "The index of Md. Abu Ammar's portfolio: who he is, what's on the site, machine-readable feeds.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      async execute() {
        return deps.fetchText("/llms.txt");
      },
    },
    {
      name: "get_paper",
      description: "One of his real papers/theses, distilled: abstract, plain-words summary, method, honest results, BibTeX.",
      inputSchema: { type: "object", properties: { slug: { type: "string", description: "e.g. quantum-machine-learning-thesis — find slugs via query_portfolio" } }, required: ["slug"] },
      annotations: { readOnlyHint: true },
      async execute(input) {
        return deps.mcpCall("get_paper", { slug: String(input.slug ?? "") });
      },
    },
    {
      name: "navigate_to",
      description: `Navigate this tab to a page of the portfolio. Pages: ${Object.entries(PAGES).map(([k, v]) => `${k} (${v.blurb})`).join("; ")}.`,
      inputSchema: { type: "object", properties: { page: { type: "string", enum: Object.keys(PAGES) } }, required: ["page"] },
      async execute(input) {
        const key = String(input.page ?? "");
        const target = PAGES[key];
        if (!target) return `unknown page "${key}" — valid pages: ${Object.keys(PAGES).join(", ")}`;
        deps.navigate(target.path);
        return `navigated to ${target.path} — ${target.blurb}`;
      },
    },
    {
      name: "download_resume",
      description: "Download Md. Abu Ammar's resume PDF in this tab.",
      inputSchema: { type: "object", properties: {} },
      async execute() {
        deps.download("/resume.pdf");
        return `downloading ${SITE_URL}/resume.pdf`;
      },
    },
    {
      name: "run_quantum_demo",
      description:
        "Retrain the live 2-qubit variational quantum classifier in the homepage hero, on the visitor's screen. Optionally move the two training points (radians, clamped to ±π/2). Returns the training snapshot. The hero must be visible — navigate_to {\"page\":\"home\"} first.",
      inputSchema: {
        type: "object",
        properties: {
          x0: { type: "number", description: "position of the y=+1 point on [-1.5708, 1.5708]" },
          x1: { type: "number", description: "position of the y=−1 point on [-1.5708, 1.5708]" },
        },
      },
      async execute(input) {
        if (!getHeroSnapshot().mounted) {
          return 'the hero classifier is not on screen — call navigate_to {"page":"home"} first, then retry';
        }
        const writer = `demo-${++demoSeq}`;
        if (!claimHeroWriter(writer)) {
          return "another agent is driving the hero right now — retry in a couple of seconds";
        }
        try {
          const x0 = typeof input.x0 === "number" ? input.x0 : undefined;
          const x1 = typeof input.x1 === "number" ? input.x1 : undefined;
          requestHeroData(x0, x1);
          // let the visible retraining run a beat before reporting back
          await new Promise((r) => setTimeout(r, 1500));
        } finally {
          // a throw must not wedge the lock for the rest of the session
          releaseHeroWriter(writer);
        }
        const s = getHeroSnapshot();
        return JSON.stringify(
          {
            note: "you just retrained a real 2-qubit variational classifier (parameter-shift gradient descent) live on the visitor's screen",
            epoch: s.epoch,
            loss: Number(s.loss.toFixed(4)),
            params: s.params.map((p) => Number(p.toFixed(3))),
            data: s.data,
          },
          null,
          2,
        );
      },
    },
    {
      name: "set_lens",
      description:
        "Adapt the whole site's emphasis for your principal: recruiter (default — production systems first), professor (research and theses first), or engineer (architecture and shipping cadence first). Applies instantly and persists for the visit.",
      inputSchema: { type: "object", properties: { lens: { type: "string", enum: [...LENSES] } }, required: ["lens"] },
      async execute(input) {
        const lens = input.lens;
        if (!isLens(lens)) return `unknown lens "${String(lens)}" — valid: ${LENSES.join(", ")}`;
        deps.setLens(lens);
        return `lens set to ${lens} — the hero and page emphasis now speak to a ${lens}`;
      },
    },
    {
      name: "contact",
      description: "How to contact Md. Abu Ammar.",
      inputSchema: { type: "object", properties: {} },
      annotations: { readOnlyHint: true },
      async execute() {
        return JSON.stringify({ email: LINKS.email, github: LINKS.github, linkedin: LINKS.linkedin, site: SITE_URL });
      },
    },
    {
      name: "compose_circuit",
      description:
        "Build and run a 2-qubit quantum circuit on the site's exact statevector simulator. Grammar: gates joined by '_': h0/h1, ry0:θ/ry1:θ, rz0:θ/rz1:θ (radians, |θ|≤π), cx (CNOT q0→q1). Example Bell pair: 'h0_cx'. When /playground is open in this tab, the circuit appears live on the visitor's screen.",
      inputSchema: { type: "object", properties: { circuit: { type: "string", description: "e.g. h0_ry1:0.7854_cx" } }, required: ["circuit"] },
      async execute(input) {
        const ops = parseCircuit(input.circuit);
        if (!ops) return "invalid circuit — grammar: h0, h1, ry0:θ, ry1:θ, rz0:θ, rz1:θ (|θ|≤π), cx, joined by '_'. Example: h0_cx";
        const result = composeCircuit(input.circuit);
        if (getComposerSnapshot().mounted) {
          requestComposerCircuit(ops);
          return `${result}\n(the circuit is now live on the visitor's /playground)`;
        }
        return `${result}\n(call navigate_to {"page":"playground"} to build it on the visitor's screen)`;
      },
    },
  ];
}

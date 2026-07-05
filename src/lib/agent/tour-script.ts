/**
 * The autopilot tour (plan-0005): a deterministic script the site's own agent
 * performs through the SAME WebMCP tool layer external agents use — so the
 * demo is the API, not a mock of it. Pure data; the runner lives in
 * src/components/agent/autopilot-tour.ts.
 */

/** Dispatched on window to start the tour from any surface (⌘K, terminal, buttons). */
export { AUTOPILOT_EVENT } from "./autopilot-event";

export type TourStep = {
  /** Narration shown in the caption bar. */
  caption: string;
  /** CSS selector to point the synthetic cursor at (skipped if absent from the page). */
  target?: string;
  /** WebMCP tool to execute, by registry name. */
  tool?: { name: string; args?: Record<string, unknown> };
  /** Poll the hero bridge until the canvas is mounted before executing (post-navigation). */
  waitForHero?: boolean;
  /** Render a trimmed line of the tool's return value under the caption. */
  showResult?: boolean;
  /** Pause after the action so a human can read along (ms). */
  dwellMs: number;
};

export const TOUR: TourStep[] = [
  {
    caption:
      "Hi — I'm this site's own agent. This portfolio publishes real tools (MCP + WebMCP) that AI agents can call. Watch me interview it.",
    target: "nav",
    dwellMs: 4200,
  },
  {
    caption: 'query_portfolio("quantum") — searching the whole corpus, the same call any agent can make…',
    tool: { name: "query_portfolio", args: { query: "quantum" } },
    dwellMs: 3200,
  },
  {
    caption:
      'get_paper("quantum-machine-learning-thesis") — his QML thesis, honestly reported: quantum 92% vs classical 96% on MNIST.',
    tool: { name: "get_paper", args: { slug: "quantum-machine-learning-thesis" } },
    dwellMs: 3800,
  },
  {
    caption: 'navigate_to("home") — I can drive this tab, too.',
    tool: { name: "navigate_to", args: { page: "home" } },
    dwellMs: 2600,
  },
  {
    caption:
      "run_quantum_demo(x0: +1.2, x1: −1.2) — retraining the live 2-qubit classifier with my own data points. Watch the loss curve reset and fall.",
    target: "canvas",
    tool: { name: "run_quantum_demo", args: { x0: 1.2, x1: -1.2 } },
    waitForHero: true,
    showResult: true,
    dwellMs: 4600,
  },
  {
    caption: 'set_lens("professor") — re-weighting the whole site for a research audience. (I\'ll put it back.)',
    tool: { name: "set_lens", args: { lens: "professor" } },
    dwellMs: 3200,
  },
  {
    caption:
      'navigate_to("agents") — everything I just did, your agent can do: MCP server, WebMCP tools, feeds, an honest fit report. This page documents all of it.',
    tool: { name: "navigate_to", args: { page: "agents" } },
    dwellMs: 4600,
  },
  {
    caption: "End of tour — the portfolio, operating itself. Point your own agent at /api/mcp and interview it properly.",
    dwellMs: 4200,
  },
];

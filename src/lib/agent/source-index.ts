import fs from "node:fs";
import path from "node:path";
import { cache } from "react";

/**
 * "Chat with this codebase" (ADR-0018, plan-0008 §3 item 16). A read-only,
 * curated allowlist over the portfolio's own most interesting source files, so
 * a recruiter's agent — or the "Ask Ammar" chat — can inspect *how* the AI
 * layer and the quantum simulator are actually built, not just read prose about
 * them. The repo is public on GitHub; this exposes the same files through the
 * shared MCP tool layer (mcp-tools.ts) with three hard guarantees:
 *
 *   1. The path never comes from model/visitor input — only a `slug` selects an
 *      entry, and the entry's path is a compile-time constant. No traversal is
 *      possible because no user string is ever joined into a filesystem path.
 *   2. The allowlist is small and hand-picked: no config, no secrets, no `.env`.
 *      Every listed file uses `process.env`, never inlined credentials.
 *   3. Files are read from `process.cwd()` at request time — the same proven
 *      pattern the content loader uses — and traced into the serverless bundle
 *      via `outputFileTracingIncludes` in next.config.ts.
 */

export type SourceEntry = {
  /** Stable identifier the agent passes to get_source. */
  slug: string;
  /** Repo-relative path — a compile-time constant, never user input. */
  path: string;
  /** Language tag for a fenced code block. */
  lang: "ts" | "tsx" | "js";
  /** One line: what this file is. */
  blurb: string;
  /** Why it's worth reading — the interesting engineering decision inside. */
  why: string;
};

/**
 * The curated set: the site's best artifacts. Deliberately self-referential —
 * an agent can read the code of the tool layer that served it the code, and the
 * eval scorer that grades the chat. Ordered roughly crown-jewel first.
 */
export const SOURCE_INDEX: readonly SourceEntry[] = [
  {
    slug: "statevector",
    path: "src/components/quantum/statevector.ts",
    lang: "ts",
    blurb: "The dependency-free 2-qubit statevector simulator — the physics engine behind the hero, /learn, and /playground.",
    why: "Pure TypeScript complex-amplitude math (gates, measurement, Bloch vectors, ⟨Z⟩). Unit-tested, zero dependencies (CLAUDE.md §9); it is the single source of quantum truth every renderer reads from.",
  },
  {
    slug: "param-shift",
    path: "src/components/quantum/param-shift.ts",
    lang: "ts",
    blurb: "The parameter-shift gradient rule, orchestrated over the simulator for the live /learn L5 widget.",
    why: "Computes ∂⟨Z⟩/∂θ = [⟨Z⟩(θ+π/2) − ⟨Z⟩(θ−π/2)] / 2 — the exact quantum gradient, no finite-difference step — and is unit-tested against a central difference to prove it.",
  },
  {
    slug: "chat-loop",
    path: "src/lib/agent/chat-loop.ts",
    lang: "ts",
    blurb: "The hand-rolled agentic chat loop: an OpenAI-style function-calling loop over the MCP tools, hops non-streamed and the final turn streamed.",
    why: "No SDK — a bare fetch loop with dependency injection for testability, budget-aware hop/token caps for the free tier, and an honest 429 cooldown parsed from the provider's real retry-after headers (parseGroqDuration / retryAfterSeconds).",
  },
  {
    slug: "mcp-tools",
    path: "src/lib/agent/mcp-tools.ts",
    lang: "ts",
    blurb: "The shared MCP tool layer — one source of truth for /api/mcp (JSON-RPC), the /agents docs, the A2A card, and this chat.",
    why: "A single typed TOOLS array + callTool switch (ADR-0007/0009) means every agent surface exposes exactly the same capabilities with no drift. This file also defines list_source / get_source — the tools reading this very file.",
  },
  {
    slug: "webmcp-tools",
    path: "src/lib/agent/webmcp-tools.ts",
    lang: "ts",
    blurb: "The pure WebMCP tool definitions (Chrome origin trial) — browser-side agent tools, kept as a unit-tested module the React provider only mounts.",
    why: "Separating the tool grammar (pure, tested) from the mount (a thin provider) is the ADR-0009 rule that keeps agent behavior verifiable without a browser.",
  },
  {
    slug: "chat-actions",
    path: "src/lib/agent/chat-actions.ts",
    lang: "ts",
    blurb: "The @@action stream protocol + scrubber: how the server drives the visitor's browser mid-answer, safely.",
    why: "Only the server emits validated navigation actions; a line-buffering scrubber drops any model- or visitor-authored text starting with '@@', so prompt-injected '@@action' lines can never steer the page — a small, closed-grammar trust boundary.",
  },
  {
    slug: "starter-cache",
    path: "src/lib/agent/starter-cache.ts",
    lang: "ts",
    blurb: "The zero-token hot-path cache: the four most-clicked starter questions answered from curated content, never touching the model.",
    why: "The durable fix for the free-tier rate limit (plan-0008 §4) — deterministic, instant answers for the highest-traffic prompts, with an exact normalized-key match so any near-miss falls through to the live model.",
  },
  {
    slug: "corpus",
    path: "src/lib/agent/corpus.ts",
    lang: "ts",
    blurb: "The single source of agent-readable truth, assembled at build time from the same content/*.md humans read.",
    why: "One compact profile for the chat system prompt and one full corpus for /llms-full.txt and MCP get_resume — so the machine-readable facts can never drift from the site copy.",
  },
  {
    slug: "evals",
    path: "src/lib/agent/evals.ts",
    lang: "ts",
    blurb: "The published eval scorer (ADR-0019): deterministic groundedness / rubric / refusal checks over the chat's answers.",
    why: "Turns 'trust me' into a checkable artifact — every cited path must be a real internal route, every answer must hit its rubric, and refusal cases must actually refuse. Powers the /evals page.",
  },
  {
    slug: "bloch-stage",
    path: "src/components/quantum/three/bloch-stage.tsx",
    lang: "tsx",
    blurb: "The single WebGL Bloch stage for /learn: draggable state arrow, drag-to-orbit, bloom — reading physics only from statevector.ts.",
    why: "Route-scoped three.js (ADR-0006/0017) with a hand-written pointer→(θ,φ) raycast that inverts the z-up↔y-up mapping, gated to desktop so touch scrolling is never hijacked.",
  },
] as const;

const MAX_SOURCE_CHARS = 24_000; // every listed file is well under this; a guard, not a real limit.

/** Catalog metadata only — no file contents. Safe to embed anywhere. */
export function listSource(): { slug: string; path: string; lang: string; blurb: string; why: string }[] {
  return SOURCE_INDEX.map(({ slug, path, lang, blurb, why }) => ({ slug, path, lang, blurb, why }));
}

/** The allowlist entry for a slug, or null. Pure — no filesystem access. */
export function findSourceEntry(slug: string): SourceEntry | null {
  return SOURCE_INDEX.find((e) => e.slug === slug) ?? null;
}

export type SourceFile = SourceEntry & { content: string; truncated: boolean };

/**
 * Read one allowlisted source file from disk. `slug` is the ONLY input; the
 * path is the entry's compile-time constant, so no user string ever reaches
 * the filesystem. Returns null for an unknown slug. Read once per request scope.
 */
export const readSource = cache((slug: string): SourceFile | null => {
  const entry = findSourceEntry(slug);
  if (!entry) return null;
  const abs = path.join(process.cwd(), entry.path);
  const raw = fs.readFileSync(abs, "utf8");
  const truncated = raw.length > MAX_SOURCE_CHARS;
  return { ...entry, content: truncated ? raw.slice(0, MAX_SOURCE_CHARS) + "\n… (truncated)" : raw, truncated };
});

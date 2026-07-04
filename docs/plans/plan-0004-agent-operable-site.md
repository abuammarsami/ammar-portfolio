---
title: "Plan 0004: The agent-operable portfolio — WebMCP + fit report + /agents + A2A card"
type: plan
status: active
owner: Md. Abu Ammar
created: 2026-07-05
last-reviewed: 2026-07-05
tags: [plan, agents, webmcp, a2a, mcp, fit-report]
related:
  - ../architecture/decisions/adr-0009-agent-operable-web-surfaces.md
  - ../architecture/decisions/adr-0007-agent-layer.md
---

# Plan 0004 — The agent-operable portfolio

Goal: the first personal site that **humans read, remote agents call, and
browser agents natively operate** — shipped inside Chrome's WebMCP origin
trial window (Chrome 149–156, opened 2026-05-19), with an honest, cited fit
report as the human-facing demo. Decision record: ADR-0009.

## Verified API ground truth (2026-07-05 — re-verify at implementation)

- Chrome 150+: `document.modelContext`; `navigator.modelContext` deprecated
  (149-era). Feature-detect both; bulk `provideContext({tools})` is the
  149-era fallback for `registerTool`.
- `registerTool({name, description, title?, inputSchema?, annotations?,
  execute}, {signal})` — abort unregisters; `execute` returns a plain string.
- Agent side: `getTools()`, `executeTool(name, jsonString)`, `toolchange`.
- Origin-trial token as `Origin-Trial` HTTP response header (Next metadata
  can't emit `http-equiv` meta) — env-gated in `next.config.ts`.

## Pillars

1. **WebMCP** — pure factory `src/lib/agent/webmcp-tools.ts` (7 tools:
   query_portfolio, get_resume_summary, get_paper, navigate_to,
   download_resume, run_quantum_demo, contact) + null-rendering provider
   `src/components/agent/webmcp-provider.tsx` (lazy import, one
   AbortController) mounted in the root layout. `run_quantum_demo` drives the
   hero via `src/lib/agent/hero-bridge.ts` (CustomEvent in, snapshot out);
   ~15-line wiring in `quantum-circuit-canvas.tsx` mirroring its drag handler.
2. **Fit report** — `src/lib/agent/fit-prompt.ts` (pure validateBrief /
   buildFitSystemPrompt: summary → per-requirement evidence with site-path
   citations → mandatory Honest gaps → verdict, ≤600 words, never invent) +
   `src/app/api/fit/route.ts` (clone of chat's Groq SSE pump; 3/10 min/IP;
   400/429/503/200) + client island `src/components/agent/fit-report.tsx`
   on /agents#fit.
3. **/agents + card** — `content/agents.md` (sections: Tagline · Why
   agent-native · MCP server · WebMCP tools · Feeds · Fit report · Agent card
   · How to interview this site) via new `getAgentsPage()`;
   `src/app/agents/page.tsx` renders prose + tool tables generated from
   `src/lib/agent/mcp-tools.ts` (TOOLS/callTool extracted unchanged from the
   route) and the WebMCP descriptors; OG image;
   `src/app/.well-known/agent-card.json/route.ts` (A2A-1.0 shape, skills from
   TOOLS, honesty caveat in description).
4. **Launch** — writing.md entry, AGENTS.md section, demo script (Claude Code
   + chrome-devtools MCP drives getTools → get_paper → navigate_to →
   run_quantum_demo on screen).

## Phases and gates

| Phase | Scope | Gate |
|---|---|---|
| P0 | ADR-0009, this plan, CLAUDE.md, plans README | lint green, no src changes |
| P1 | mcp-tools extraction, hero-bridge + canvas wiring, tests | full CI; `tools/list` byte-identical; hero visually unchanged |
| P2 | webmcp-tools + tests, provider, layout mount, OT header | CI + budgets (/ ≤200 kB); manual Chrome flag test; zero errors elsewhere |
| P3 | fit-prompt + tests, /api/fit | curl matrix 503/400/429; live report has all 4 sections + citations |
| P4 | agents.md, loader, page, OG, island, card, nav/⌘K/terminal/sitemap/llms.txt/budgets | full CI incl. /agents row; card valid JSON; Lighthouse ≥95; CLS 0 |
| P5 | writing.md, AGENTS.md, end-to-end demo, PR | build green; demo executed once |

Owner action items: register the production origin for the WebMCP origin
trial → set `WEBMCP_ORIGIN_TRIAL_TOKEN` in Vercel; keep `GROQ_API_KEY` set.

## Risks

WebMCP instability (fenced in 2 lazy files; dual detect; string returns) ·
OT expiry at Chrome 156 (env-gated header no-ops) · `/` budget headroom ~6 kB
(lazy import, eager <1 kB) · Groq free-tier (3/10 min, max_tokens 1200) ·
A2A honesty (caveat in card + /agents copy) · claim wording fixed as "among
the first personal sites, in Chrome's WebMCP origin trial".

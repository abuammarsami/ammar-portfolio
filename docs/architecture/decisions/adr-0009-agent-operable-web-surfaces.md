---
title: "ADR-0009: Agent-operable web surfaces — WebMCP, A2A card, fit API"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-05
last-reviewed: 2026-07-05
deciders: [Md. Abu Ammar]
tags: [adr, ai, agents, webmcp, a2a, mcp]
supersedes: null
superseded-by: null
related:
  - adr-0007-agent-layer.md
  - adr-0001-nextjs-static-rendering.md
---

# ADR-0009: Agent-operable web surfaces

**Status:** accepted · **Date:** 2026-07-05

## Context

ADR-0007 gave the site one tool layer and three surfaces (humans via `/api/chat`,
remote agents via `/api/mcp`, crawlers via `/llms.txt` + `/resume.json`). Two
things changed since:

1. **WebMCP** (`document.modelContext`, formerly `navigator.modelContext`)
   entered Chrome 149's public origin trial on 2026-05-19 (runs through
   Chrome 156): web pages can register tools that browser agents discover and
   call natively. Almost no production site ships it; no known personal site
   does. The API is explicitly "subject to change".
2. Recruiters and professors keep asking the same implicit question — "does
   this person fit *my* brief?" — which the grounded chat answers only
   fragment by fragment.

## Decision

Extend the one tool layer to **five surfaces**, adding:

4. **Browser agents (WebMCP)** — the page registers ~7 tools via
   `document.modelContext` (fallback `navigator.modelContext` /
   `provideContext` for Chrome-149-era builds). Data tools proxy the existing
   MCP layer (zero logic duplication); browser-only tools add what a remote
   endpoint can't: `navigate_to` (whitelisted router.push) and
   `run_quantum_demo` (drives the live hero classifier through
   `src/lib/agent/hero-bridge.ts`; physics stays exclusively in
   `statevector.ts`, rule 5 intact). Tool definitions live in the **pure,
   unit-tested module** `src/lib/agent/webmcp-tools.ts`; the React provider
   (`src/components/agent/webmcp-provider.tsx`) only feature-detects and
   mounts them via lazy import (≈0 kB for non-supporting browsers). The
   origin-trial token ships as an env-gated `Origin-Trial` HTTP header in
   `next.config.ts` (`WEBMCP_ORIGIN_TRIAL_TOKEN`); absent token or absent API
   degrades to a hard no-op.
5. **Agent-web discovery (A2A card)** — `/.well-known/agent-card.json`
   (force-static) publishes an A2A-1.0-shaped agent card whose `skills[]` are
   generated from the shared `TOOLS` array. The card's `description` states
   honestly that the interface behind it speaks MCP JSON-RPC, not a full A2A
   `message/send` server.

Plus one new human-facing capability on the same layer: **the fit report** —
`POST /api/fit` takes a pasted job description or research topic (40–4000
chars, audience `recruiter|professor`) and streams a grounded markdown report
(fit summary → requirement-by-requirement evidence with site-path citations →
**mandatory "Honest gaps" section** → verdict). Same Groq corpus-in-context
pattern as `/api/chat`, stricter rate limit (3/10 min/IP), same graceful
offline path.

All of it is documented on a new `/agents` page (force-static, prose from
`content/agents.md`, tool tables generated from the code so docs can't drift).

**Zero new runtime dependencies.** WebMCP is a browser API, the card is JSON,
the fit route is fetch + SSE like chat.

## Options considered

- **Wait for WebMCP to stabilize** — rejected: the origin trial *is* the
  window; the risk is fenced (2 lazy files, dual feature-detect, plain-string
  returns) so instability can never break the static site.
- **Full A2A server** — rejected: A2A's task lifecycle adds server state for
  no visitor value today; the card alone buys discovery, honestly labeled.
- **Fit report as a separate /fit route** — rejected: `/agents` is the natural
  home of "interview my site"; one new route, one client island.

## Consequences

- (+) A verifiable claim: among the first personal sites on the web shipping
  WebMCP browser tools, in Chrome's origin trial — humans read the site,
  remote agents call it, browsers operate it.
- (+) One tool layer now feeds MCP, WebMCP, the agent card, the /agents docs
  page, and both LLM endpoints — the architecture is the portfolio piece.
- (−) WebMCP will change; re-verification is expected work. Isolation keeps
  the blast radius at two files.
- (−) The origin-trial token is per-origin and expires with Chrome 156; the
  owner must register and set `WEBMCP_ORIGIN_TRIAL_TOKEN` (no-op without it).
- (−) `/api/fit` spends more Groq tokens per call than chat; mitigated by the
  3/10-min limiter and `max_tokens` 1200.

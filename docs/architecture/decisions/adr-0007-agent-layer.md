---
title: "ADR-0007: The agent layer — one tool layer, three surfaces"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
deciders: [Md. Abu Ammar]
tags: [adr, ai, agents, mcp]
supersedes: null
superseded-by: null
related:
  - adr-0001-nextjs-static-rendering.md
---

# ADR-0007: The agent layer

**Status:** accepted · **Date:** 2026-07-04

## Context

2026: portfolios "built with AI" are commodity; the differentiator is a site
**legible to and operable by agents**. MCP is a Linux Foundation standard;
recruiters' screening tools parse structured endpoints; llms.txt adoption is
growing (with a known consumption gap we acknowledge openly).

## Decision

**One shared tool layer (`src/lib/agent/`), three surfaces:**

1. **Humans** — "Ask Ammar": grounded chat as a mode of the existing terminal
   footer and ⌘K palette (`ask <question>`). `/api/chat` streams from a
   free-tier OpenAI-compatible endpoint (Groq; `GROQ_API_KEY` env), with the
   entire site corpus in-context — **no RAG/vector DB** (corpus ≈ small; static
   knowledge base > RAG for personal sites). Graceful offline message without
   the key. Light per-instance rate limiting.
2. **Remote agents** — `/api/mcp`: a hand-rolled MCP streamable-HTTP JSON-RPC
   server exposing `get_resume`, `list_projects`, `search_publications`,
   `get_lessons`, `contact`. "My CV is an MCP server."
3. **Crawler/browser agents** — build-time `/llms.txt` (index),
   `/llms-full.txt` (full corpus), `/resume.json` (JSON Resume schema), plus
   the existing JSON-LD. AGENTS.md documents the repo for coding agents.

**Zero new runtime dependencies** — JSON-RPC and SSE proxying are hand-rolled
(~200 lines total), consistent with rules 3/9. The site stays SSG; only
`/api/chat` and `/api/mcp` are dynamic functions.

## Options considered

- Vercel AI SDK + vector DB — capable but adds deps and a service for a corpus
  that fits in one context window.
- Chat widget UI — bolted-on feel; the terminal/⌘K integration is native.
- Skipping llms.txt (low consumption) — kept: near-zero cost, doubles as the
  chat corpus source, honest framing.

## Consequences

- (+) A rare, coherent story: humans, remote agents, and crawlers consume the
  same tool layer; the architecture itself is portfolio material.
- (−) Chat requires the owner to set `GROQ_API_KEY` in Vercel (free tier);
  offline mode degrades gracefully.

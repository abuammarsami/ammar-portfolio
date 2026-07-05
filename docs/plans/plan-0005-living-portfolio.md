---
title: "Plan 0005: The living portfolio — agentic chat, lens, guestbook, autopilot, voice, cinema"
type: plan
status: active
owner: Md. Abu Ammar
created: 2026-07-06
last-reviewed: 2026-07-06
tags: [plan, agents, chat, lens, guestbook, autopilot, voice, view-transitions]
related:
  - ../architecture/decisions/adr-0010-agent-guestbook-storage.md
  - ../architecture/decisions/adr-0009-agent-operable-web-surfaces.md
  - plan-0004-agent-operable-site.md
---

# Plan 0005 — The living portfolio

Goal: the site stops being a page with an agent bolted on and becomes a
**living system** — it can demo itself (autopilot), converse and act (agentic
chat + voice), adapt to who's looking (lens), remember who visited
(guestbook), and move like cinema (View Transitions). Six acts, one PR each,
stacked. Decision record for storage + model migration: ADR-0010.

Forcing function: Groq deprecated `llama-3.3-70b-versatile` (shutdown
2026-08-16) — P0 migrates `/api/chat` and `/api/fit` to `openai/gpt-oss-120b`.

## Phases

- **P0 — Agentic chat + model migration** (PR #5): function-calling loop over
  the MCP tool layer in `chat-loop.ts` (non-streamed hops, streamed final
  turn); `@@action` line protocol in `chat-actions.ts` (server-only emission,
  internal-path whitelist, split-chunk scrubber); the footer terminal
  intercepts actions.
- **P1 — Adaptive lens** (PR #6): `data-lens` on `<html>` (recruiter |
  professor | engineer), variants statically rendered + CSS-toggled, restored
  pre-paint; `set_lens` WebMCP tool, terminal `lens`, ⌘K entries, nav ⟨lens|
  pill. Budget work: palette body, terminal engine, and WebMCP mount moved to
  lazy chunks.
- **P2 — Agent guestbook** (this phase): ADR-0010; `guestbook.ts` (Upstash
  raw REST, env-gated, never throws); writes from mcp/chat/fit + `POST
  /api/beacon` (5/min/IP, allowlist) for WebMCP/autopilot; `GET
  /api/guestbook` (s-maxage=60); wall island on /agents. Privacy: names not
  args, no IPs, coarse UA + timestamps, "unverified" copy.
- **P3 — Autopilot**: deterministic tour through the site's own WebMCP tool
  layer — synthetic WAAPI cursor + caption bar, Escape/scroll cancels, hero
  snapshot/restore, single-writer flag on the bridge; fully lazy island
  (0 eager bytes on `/`).
- **P4 — Voice mode**: SpeechRecognition mic in the terminal → `/api/chat` →
  sentence-buffered speechSynthesis (strips actions/markdown); hidden where
  unsupported.
- **P5 — Cinematic pass**: `experimental.viewTransition` + React
  `<ViewTransition>` isolated in `vt.tsx` (card→detail morphs, route
  cross-fade, reduced-motion kill switch); theme toggle as same-document
  measurement-collapse via `document.startViewTransition`; ⌘K fuzzy search
  over a build-time `public/search-index.json`.

## Gate ritual (every phase)

`npm run build` → `node scripts/check-budgets.mjs` → `npm test` →
`npm run typecheck` → `npm run lint`; Lighthouse on touched routes; CLS 0.
`/` runs ~199.2 kB of its 200 kB budget — new client features must be
lazy-loaded (`next/dynamic` chunks are exempt from the eager budget by
design).

## User action items

- Provision Upstash Redis (Vercel Marketplace, free tier) and set
  `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel (P2).
- Merge each phase PR after its gate report; smoke-test agentic chat on prod
  with the real Groq key after P0 lands.

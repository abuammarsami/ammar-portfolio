---
title: "ADR-0010: Agent guestbook — Upstash Redis over raw REST, no SDK"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-06
last-reviewed: 2026-07-06
deciders: [Md. Abu Ammar]
tags: [adr, ai, agents, storage, privacy, guestbook]
supersedes: null
superseded-by: null
related:
  - adr-0009-agent-operable-web-surfaces.md
  - adr-0007-agent-layer.md
---

# ADR-0010: Agent guestbook — Upstash Redis over raw REST, no SDK

**Status:** accepted · **Date:** 2026-07-06

## Context

The agent surfaces (ADR-0007/0009) are live and being called, but nothing on the
site shows it. A public "agents were here" wall on /agents turns invisible
machine traffic into a human-visible, honest proof point — and it is the site's
first feature that needs persistence: the site is otherwise fully static and the
API routes keep no state beyond ephemeral in-memory rate-limit maps.

Related decision recorded here (ADR-0007 is immutable): the Groq model
`llama-3.3-70b-versatile` used by `/api/chat` and `/api/fit` is deprecated with
shutdown 2026-08-16; both routes migrated to `openai/gpt-oss-120b`
(`reasoning_effort: "low"`) in plan-0005 P0, and `/api/chat` gained a
function-calling loop over the same MCP tool layer.

## Decision

1. **Store**: Upstash Redis (Vercel Marketplace, free tier: 500K commands/month)
   as a single rolling list — `LPUSH` + `LTRIM 0 199` per write, `LRANGE` per
   read. A portfolio's hundreds of writes/day ≈ tens of thousands of
   commands/month: order-of-magnitude headroom.
2. **No SDK**: the Upstash REST API is one authenticated `fetch` to
   `POST <url>/pipeline`. `src/lib/agent/guestbook.ts` wraps it in ~40 lines,
   so rule 3 ("no new runtime dependency without an ADR") holds with zero new
   packages — this ADR documents the *storage decision*, not a dependency.
3. **Env-gated**: without `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
   every guestbook call is a silent no-op. Logging can never break a surface:
   `recordEvent` never throws and is never awaited on a response path.
4. **Write paths**: `/api/mcp` (tools/call), `/api/chat` (`ask`), `/api/fit`
   (`fit_report`) record directly; browser-only events (WebMCP tool
   executions, autopilot runs) go through `POST /api/beacon` — rate-limited
   5/min/IP with a hard allowlist of tool names and client surfaces.
5. **Read path**: `GET /api/guestbook` returns the latest 50 with
   `s-maxage=60, stale-while-revalidate` so the CDN absorbs traffic.

## Privacy posture (hard rules)

- Tool **names only — never arguments** (chat questions and fit briefs are user
  content).
- **No IP addresses** stored anywhere; the rate limiter's in-memory map is
  ephemeral per instance.
- The **User-Agent is reduced server-side** to a coarse family
  (`claude`/`chatgpt`/`gemini`/`browser`/`script`/…) and the raw string
  discarded before storage.
- The wall renders **coarse relative timestamps** ("2h ago") so it reads as a
  guestbook, not visitor tracking.
- Copy on /agents labels entries **unverified** (self-reported clients), not an
  audit log.

## Consequences

- First stateful feature: the user must provision Upstash and set the two env
  vars in Vercel; until then the wall shows an honest empty state.
- A flood can only churn the rolling 200-entry list (LTRIM self-caps storage);
  the beacon allowlist rejects junk tool names.
- If Upstash pricing/terms shift, the store is one tiny module behind two
  functions — swappable without touching any surface.

## Alternatives considered

- **Vercel Edge Config** — read-optimized, writes only via the Vercel REST API
  with slow global propagation; unsuitable as an append log.
- **`@upstash/redis` SDK** — convenience only; a `fetch` wrapper is smaller
  than the SDK's type surface and keeps the zero-dependency ethos.
- **Vercel KV** — no longer offered (replaced by Marketplace stores).
- **No storage (synthesize from logs)** — Vercel log drains are paid and
  retention-limited; not a guestbook.

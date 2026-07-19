---
title: "ADR-0018: Chat with this codebase — read-only source tools over a curated allowlist"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-19
last-reviewed: 2026-07-19
deciders: [Md. Abu Ammar]
tags: [adr, agent, mcp, ai, security]
supersedes: null
superseded-by: null
related:
  - ./adr-0007-agent-layer.md
  - ./adr-0009-agent-operable-web-surfaces.md
  - ../../plans/plan-0008-top-1-percent.md
---

# ADR-0018: Chat with this codebase

**Status:** accepted · **Date:** 2026-07-19

## Context

The portfolio's most credible artifact for an AI-native role is the code itself:
a hand-rolled MCP tool layer, a bare-`fetch` agentic loop, a closed-grammar
`@@action` navigation protocol, a zero-token starter cache, and a
dependency-free quantum simulator. Yet no agent surface exposed *how* any of it
is built — a recruiter's agent (or the "Ask Ammar" chat) could read prose
*about* the engineering but never the engineering (plan-0008 §3 item 16).

The repository is already public on GitHub, so the source is not secret. What
was missing was a first-class, in-band way to read the interesting files
through the same tool layer that answers every other question — and a way to do
it that does not (a) let a model- or visitor-supplied string reach the
filesystem, (b) ship secrets, or (c) break the ADR-0007 "no vector DB / no RAG
index" and CLAUDE.md §5.3 "no new runtime dependency without an ADR" rules.

## Decision

1. **Two read-only tools on the shared `TOOLS` layer** (`mcp-tools.ts`):
   `list_source` (catalog: slug, path, blurb, why) and `get_source` (the real
   current text of one file). Because they live in the one shared layer
   (ADR-0007/0009), they appear automatically on `/api/mcp`, the `/agents` docs
   table, the A2A card, and inside the chat's function-calling loop — no per-
   surface wiring.

2. **A hand-curated allowlist, not the whole tree** (`source-index.ts`). A small
   `SOURCE_INDEX` of the site's best files (the simulator, the agent/MCP
   modules, the eval scorer, the Bloch stage). Each entry's `path` is a
   **compile-time constant**; `get_source` selects an entry by `slug` only, so
   **no user string is ever joined into a filesystem path** — traversal is
   impossible by construction, not by sanitisation.

3. **Files are read at request time from `process.cwd()`**, the same proven
   pattern the content loader uses, and traced into the `/api/chat` and
   `/api/mcp` serverless bundles via `outputFileTracingIncludes` in
   `next.config.ts`. No build-time source snapshot is committed — the tool
   always returns the *current* code, and the diff stays free of duplicated
   source.

4. **Freshness and safety are tested, not assumed.** `source-index.test.ts`
   asserts every allowlisted file exists on disk (so a rename can't dangle a
   slug), that slugs are unique kebab-case, and that no listed file contains an
   inlined-secret-shaped literal (the standing "never expose hardcoded
   credentials" rule, enforced in CI).

5. **No new runtime dependency and no RAG.** This is a literal file read behind
   an allowlist — it adds no index, no embeddings, and no package, so ADR-0007's
   rejection of vector search stands. `get_source` output is capped
   (24 kB/file; every listed file is well under) as a guard.

## Options considered

- **Trace the whole `src/` tree and allow any path.** Rejected: turns the tool
  into an arbitrary-file-read primitive, invites traversal-guard bugs, and would
  surface uninteresting or half-finished files. A curated allowlist is safer and
  a better demo — it *points at* the good parts.
- **Commit a build-time generated source snapshot module** (statically
  imported, so guaranteed bundled). Rejected: duplicates source into git, adds a
  regeneration step, and can go stale; explicit file tracing keeps one source of
  truth and is validated by the existing content-loader pattern.
- **A GitHub-link tool only** (return the repo URL, no contents). Rejected: it
  bounces the agent off-site and proves nothing about the running deployment;
  reading the file the server is actually running is the point.

## Consequences

- (+) The chat can answer "how is your agent loop built?" by returning the real
  `chat-loop.ts` — uniquely credible for an AI-native portfolio, and
  self-referential (an agent can read the code of the tool that served it).
- (+) One shared tool layer means MCP, WebMCP-adjacent docs, and chat all gain
  the capability at once, with the `/agents` tool table updating automatically.
- (+) No new dependency, no RAG index, no secrets, no traversal surface.
- (−) The allowlist is a manual list to maintain; the existence test converts
  drift into a failing build rather than a silent 404.
- (−) `outputFileTracingIncludes` must list the traced globs; kept in sync with
  the allowlist and documented here as the single place that governs it.

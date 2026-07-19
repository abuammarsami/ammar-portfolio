---
title: "ADR-0019: Published eval harness — a deterministically-scored held-out test set for the chat agent"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-19
last-reviewed: 2026-07-19
deciders: [Md. Abu Ammar]
tags: [adr, ai, evals, agent, honesty]
supersedes: null
superseded-by: null
related:
  - ./adr-0007-agent-layer.md
  - ./adr-0011-public-ai-generated-pages.md
  - ./adr-0018-chat-with-codebase.md
  - ../../plans/plan-0008-top-1-percent.md
---

# ADR-0019: Published eval harness

**Status:** accepted · **Date:** 2026-07-19

## Context

The whole ethos of the agent layer is *grounding + refusal + verifiability*, not
an ungrounded "ask me anything" bot (plan-0008 §5 explicitly forbids the latter).
The site already asks the chat to cite internal paths, but nothing held that
promise to account. Meanwhile, running and publishing evals — held-out cases with
rubrics, groundedness, and refusal checks — is the single competency Anthropic's
own engineering writing foregrounds for applied-AI roles (plan-0008 §3 item 17,
"the external research's #1 recommendation").

The constraint is honesty (ADR-0011): a published verdict must be reproducible
and must never be fabricated. An LLM-as-judge alone is neither — it drifts, and
it's not checkable by a visitor. And it must fit the platform rules: no new
runtime dependency (CLAUDE.md §5.3), content from `content/*.md`, static route
within the 200 kB budget.

## Decision

1. **A deterministic scorer is the published verdict** (`src/lib/agent/evals.ts`,
   a pure, unit-tested function). Each answer is graded on three mechanical axes:
   **grounded** (every internal route it cites is a *real* site route — checked
   against the actual route table from `content/`), **rubric** (all required
   phrases present, all forbidden ones absent, expected route cited), and
   **refusal** (for un-groundable questions, the answer actually declines). No
   LLM-as-judge in the published pass/fail, so the same case always scores the
   same — in CI, in a test, and on the page.

2. **The test set lives in `content/evals.md`** as a markdown pipe table
   (`id | category | question | must_include | must_exclude | expect_paths`)
   plus prose (overview, methodology, honesty). Human-editable, one source of
   truth, parsed by `parseEvalCases`. The forbidden-phrase column encodes
   known-wrong claims (e.g. "microservices" for KioskVisionAI, "vector/embedding"
   for the classical mosque search) so a regression in the corpus is caught.

3. **The `/evals` page is static** and grades at build time. The four starter
   questions are scored against the **exact cached answers the site serves**
   (`starter-cache.ts`) — zero model calls, genuinely live results on every
   build. Model-served cases show the **last committed harness run** (with model,
   commit, and date) or, absent one, **pending** — never a fabricated pass
   (ADR-0011).

4. **The harness is opt-in and hard-gated** (`evals.harness.test.ts`, gated on
   `RUN_EVALS` + `GROQ_API_KEY`; `npm run evals`). It runs each case through the
   *real* production pipeline (`buildChatProfile` + the shared `TOOLS` +
   `runAgenticChat`), scores deterministically, and writes
   `content/eval-results.json` with provenance. Plain `npm test` never hits the
   network.

5. **No new dependency; the scorer is self-hosting.** It reuses `isInternalPath`
   from the existing `chat-actions.ts` trust boundary, and it is itself readable
   through ADR-0018's `get_source` (slug `evals`) — the artifact and its judge
   are both open.

## Options considered

- **LLM-as-judge as the published verdict.** Rejected for the headline pass/fail:
  not reproducible, not checkable by a visitor, and drifts with the judge model.
  A deterministic scorer can be re-run by anyone reading the page. (A model judge
  may layer on later as an *advisory* second signal in the harness, never as the
  published number.)
- **Run the full set live at build / in CI.** Rejected: the free-tier TPM ceiling
  (plan-0008 §4) makes a 20-case live sweep flaky and slow inside a build, and it
  would spend the shared key. Build-time grades the deterministic-cacheable cases
  live; the model sweep is an explicit, provenance-stamped opt-in run.
- **Fabricate/hand-write "expected" answers and grade those.** Rejected outright:
  that grades the author, not the agent — a dishonest eval. Only the served
  cached answers (which the agent really returns) are graded without the model.

## Consequences

- (+) "Grounded, citation-checked" stops being a claim and becomes a table a
  reviewer can re-derive — the highest-signal AI artifact for this audience.
- (+) The forbidden-phrase rubric turns corpus regressions (a wrong re-framing of
  a project) into a visible eval failure.
- (+) Deterministic, reproducible, zero new dependency, static page in budget.
- (−) The deterministic scorer is coarser than a human — it checks grounding and
  key claims, not full answer quality. Stated plainly in the page's Honesty
  section; the model-judge layer is a possible future add.
- (−) `content/eval-results.json` is a committed generated artifact; it carries
  provenance and is regenerated by `npm run evals`, never hand-edited.

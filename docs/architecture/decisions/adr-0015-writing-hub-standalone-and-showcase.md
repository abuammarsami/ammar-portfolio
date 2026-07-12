---
title: "ADR-0015: Writing hub — standalone posts alongside series, and the /d3 skill showcase"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-13
last-reviewed: 2026-07-13
deciders: [Md. Abu Ammar]
tags: [adr, content, writing, markdown]
supersedes: adr-0014-deep-dives-section.md
superseded-by: null
related:
  - adr-0013-case-study-layout.md
  - adr-0014-deep-dives-section.md
---

# ADR-0015: Writing hub — standalone posts alongside series, and the /d3 skill showcase

**Status:** accepted · **Date:** 2026-07-13 · **Supersedes:** ADR-0014

## Context

ADR-0014 introduced the `deep-dives` section as a home for **series only** — its
type was `content/deep-dives/<slug>.md` chapters that each *require* a `series`
plus an `order`. Since then the section became the intended home for **all**
long-form writing (a future goal is a standalone newsletter), and two concrete
needs fell outside the series-only shape:

1. A **flagship standalone essay** ("Document-Driven Development (D³)") that
   belongs to no series but should be featured at the top of the index.
2. A **product/showcase page** (`/d3`) for the open-source skill the essay
   describes — a short marketing surface distinct from the long-form essay.

The build-time-highlighting and SVG-inlining decisions in ADR-0014 remain correct
and are re-affirmed here; only the *type/schema* decision changes, so this ADR
restates the full current picture rather than leaving ADR-0014 partially true.

## Decision

1. **Re-affirmed from ADR-0014 (unchanged):** syntax highlighting is build-time
   via Shiki in the shared `markdownToHtml`; local `/figures/*.svg` are inlined at
   build by `rehypeInlineSvg` (now hardened to a flat-filename regex + a
   `public/figures` containment check — no path traversal); all such dependencies
   are build-time only, so the ADR-0006 budgets are unaffected. New chapter/page
   routes are added to the budget gate.
2. **`series` is now optional** on the `deep-dives` frontmatter (`order` defaults
   to `1`; a new `featured` flag applies to standalone pieces only). A chapter with
   no `series` is a **standalone post**: it renders on its own (no series TOC, no
   prev/next), and `standaloneDeepDives()` surfaces it as a "Featured essay" card
   at the top of `/deep-dives`, above the series. All series consumers degrade
   safely for the standalone case (comparator, series lookup, static params,
   JSON-LD `isPartOf`, breadcrumb).
3. **The `/d3` showcase** is a content-driven page (`content/d3.md` rendered via
   `getOptionalHtml`, rule-#4 compliant) presenting the skill: install, the two
   verbs, the capture routing table, and a link to the canonical essay. It reuses
   the essay's `d3-consumption` figure. No new mechanism — it reuses the existing
   optional-HTML loader.
4. **Canonical-source strategy** for the D³ idea across its surfaces: the
   deep-dive essay is the canonical *narrative* (the why/how); `SKILL.md` (in the
   public `abuammarsami/d3` repo) is the canonical *mechanics*; `/d3` and the
   repo README are terse showcases that link to those two and must not re-derive
   them at length.

## Consequences

- The writing section scales to standalone pieces (and a future newsletter)
  without a fake one-chapter series; series becomes optional grouping metadata,
  not the collection's identity.
- The `deep-dives` route/type name now undersells the hub (it holds workflow
  essays + a product link, and the nav already labels it "writing"). A rename to
  `/writing` (with a redirect) and folding the orphaned `content/essays/` bucket
  into one `posts` collection is the recommended **next** refactor — deferred, not
  done here, to keep this change small.
- Three prose surfaces for D³ (essay / showcase / README) still require discipline
  to avoid drift; decision #4 assigns each a single job to contain that.

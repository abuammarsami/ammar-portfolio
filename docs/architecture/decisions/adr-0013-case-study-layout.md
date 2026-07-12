---
title: "ADR-0013: Bespoke narrative layout for flagship case studies"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-12
last-reviewed: 2026-07-12
deciders: [Md. Abu Ammar]
tags: [adr, content, design, case-study]
supersedes: null
superseded-by: null
related:
  - adr-0002-markdown-content-pipeline.md
  - adr-0003-visual-identity.md
  - adr-0012-self-hosted-svg-figures.md
---

# ADR-0013: Bespoke narrative layout for flagship case studies

**Status:** accepted · **Date:** 2026-07-12

## Context

Project pages (`/work/[slug]`) render a deliberately uniform "abstract" template
— Problem / Approach / Impact prose plus static figures (ADR-0012). That's the
right default for a dense, comparable portfolio: every project reads the same way
in a few seconds.

But the strongest systems work deserves a *case study*, not an abstract — a
narrative a non-specialist can follow and a staff engineer respects: the problem
as real incidents, an explicit thesis, a guided walkthrough, the architectural
trade-offs made and why, and the war story. Forcing that into three prose blocks
undersells it; the page reads as "a paragraph and some diagrams."

Constraints that shaped the decision:

- **Prose stays in `content/` (ADR-0002 rule).** No copy hardcoded in components.
- **`/work/[slug]` is not in the per-route JS budget list**, but the site's
  performance posture (Lighthouse ≥ 95, ADR-0006) still applies — so the layout
  must add ~zero client JS.
- Must reuse the existing visual identity and motion language (ADR-0003), not
  invent a parallel one.

## Decision

1. **Opt-in per project via frontmatter `layout: case-study`** (default
   `"default"`). The project file still drives the `/work` card, tags, summary,
   and figures (ADR-0012); the flag only swaps the detail-page renderer.
2. **The narrative lives in `content/case-studies/<slug>.md`**, parsed by
   `getCaseStudy()` into typed sections via the existing `## Heading` splitter —
   `In one minute`, `Stats`, `The problem` + `Incidents` cards, `The big idea` +
   `The wrapper` capability grid, `How it works`, `Follow a job` walkthrough,
   `Architect decisions` cards, `The war story`, `Impact`, `Going deeper`. A
   missing section simply renders nothing; no new required-section build gate.
3. **Structured sub-blocks reuse simple conventions**: `### Card` headings with an
   optional emphasized `*meta*` first line become cards; `- value | label` lines
   become stat numerals; `- name | body` lines become capability rows. No new
   markdown dialect, no MDX (still ADR-0002-compliant).
4. **Rendering is a server component (`CaseStudyView`) with zero added client
   JS.** Interactivity and motion come entirely from the existing system — the
   `Reveal` scroll-observer, `.enter`/`.reveal`/`hero-atmosphere`/`entangled`
   classes, design tokens — plus self-contained, reduced-motion-aware CSS
   animations embedded in each figure's own SVG `<style>` (namespaced so they
   stay live whether inlined in the page or referenced as standalone images).
   Figures are still inlined via `ProjectFigure` (ADR-0012).
5. **The `/work/[slug]` route branches on the flag** and falls back to the default
   template if the case-study file is absent, so the flag can never ship a broken
   page.

## Consequences

- Flagship work reads as a real case study — understandable top-to-bottom by a
  non-specialist, credible to a senior engineer — while every other project keeps
  the fast, uniform abstract.
- The pattern is reusable: any future project adds `layout: case-study` + a
  content file, no component work.
- Two files per case study instead of one, and a richer (but still
  convention-based, no-dialect) content contract to keep in sync.
- Zero new runtime dependencies; no measurable JS added to the route.

---
title: "ADR-0014: Deep Dives section — build-time code highlighting + inlined SVG"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-12
last-reviewed: 2026-07-12
deciders: [Md. Abu Ammar]
tags: [adr, content, writing, markdown, performance]
supersedes: null
superseded-by: adr-0015-writing-hub-standalone-and-showcase.md
related:
  - adr-0002-markdown-content-pipeline.md
  - adr-0006-webgl-route-scoped.md
  - adr-0012-self-hosted-svg-figures.md
  - adr-0013-case-study-layout.md
---

# ADR-0014: Deep Dives section — build-time code highlighting + inlined SVG

**Status:** superseded by [ADR-0015](adr-0015-writing-hub-standalone-and-showcase.md) · **Date:** 2026-07-12

> Superseded on 2026-07-13: the build-time highlighting and SVG-inlining decisions
> below still stand (re-affirmed in ADR-0015); the "series-only" type decision (§3)
> is replaced — `series` is now optional to support standalone posts.

## Context

The portfolio proves I *build* systems (case studies, ADR-0013). It didn't prove
I can *explain* them at length — which for a senior/staff profile is half the
signal. A 7-part engineering series ("Background Jobs From Scratch") existed as
source material; hosting it on-domain (canonical) beats a Medium silo for
long-term authority.

Rendering it *well* needed two things the ADR-0002 markdown pipeline lacked, both
of which had to stay within the site's performance posture (Lighthouse ≥ 95,
per-route JS budgets, no client-side rendering for text — ADR-0006):

1. **Code that reads like code.** Plain `<pre>` undersells technical writing.
2. **Diagrams that render** and adapt to both themes.

## Decision

1. **Syntax highlighting is build-time via Shiki** (`@shikijs/rehype`), added to
   the shared `markdownToHtml` processor. It tokenizes at build into themed HTML
   with **zero client JS**. Dual `vitesse-light` / `vitesse-dark` themes with
   `defaultColor: "light"`; `[data-theme="dark"]` swaps to the `--shiki-dark`
   vars in `globals.css`, matching the site's theme mechanism. `defaultLanguage`
   /`fallbackLanguage: "text"` so an unknown fence can never fail the build.
2. **Local `/figures/*.svg` images in markdown are inlined at build** by a small
   rehype plugin (`rehypeInlineSvg`, `hast-util-from-html` + `unist-util-visit`):
   a paragraph that is just one such image becomes a `<figure>` with the SVG
   inlined and the alt text as `<figcaption>`. Inlining (not `<img>`) is what
   lets the SVG resolve the `--color-*` theme tokens and run its embedded
   animation — the ADR-0012 reasoning, now available inside prose. Only
   repo-authored `/figures/*.svg` are read.
3. **A content-driven `deep-dives` type**: `content/deep-dives/<slug>.md`
   chapters (frontmatter: title, series, order, summary, readingMinutes) and a
   `_<series>.md` metadata file per series. Routes: `/deep-dives` (series
   index/TOC) and `/deep-dives/[slug]` (chapter, with prev/next + series TOC),
   both `force-static` server components — no client JS beyond the shared
   `Reveal` observer. Chapters reuse the ADR-0012/0013 figures.
4. **New dependencies are all build-time** (`shiki`, `@shikijs/rehype`,
   `hast-util-from-html`, `unist-util-visit`) — none ship to the client — so the
   ADR-0006 budgets are unaffected; the new routes are added to the budget gate.

## Consequences

- The portfolio now demonstrates depth **and** communication — the rare pairing.
- Long-form technical writing lives on-domain, canonical, at zero JS cost.
- `markdownToHtml` gained highlighting + SVG inlining for *all* markdown surfaces
  (a latent upgrade for any future page), at the cost of a slightly heavier build
  step (Shiki grammar loading), which is memoized.
- One markdown dialect still (ADR-0002) — no MDX; diagrams are authored SVGs, not
  a runtime diagram library.

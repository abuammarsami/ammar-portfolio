---
title: "ADR-0002: fs + gray-matter + zod + unified content pipeline (no MDX, no CMS)"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
deciders: [Md. Abu Ammar]
tags: [adr, content]
supersedes: null
superseded-by: null
related:
  - ../../reference/content-schema.md
---

# ADR-0002: Typed markdown content pipeline

**Status:** accepted · **Date:** 2026-07-04

## Context

All site copy is pasted by the owner into `content/*.md` from ChatGPT/Claude exports.
Pasted prose must never break the build the way MDX does on a stray `<`. Maintenance
story: edit markdown → done.

## Decision

A ~200-line typed loader in `src/lib/content/`: `fs` read → `gray-matter` frontmatter →
Zod schema validation → section parser (heading/label contracts from the templates) →
unified (`remark-parse → remark-gfm → remark-rehype → rehype-stringify`) to HTML.
Strict in production builds (missing required section = loud failure naming file+section),
lenient in dev. Empty optional files (testimonials, writing) render nothing.

## Options considered

- **MDX** — stray `<` or `{` in pasted content is a build error; interactivity not needed in prose.
- **Contentlayer** — unmaintained; our Zod loader gives the same typed guarantees.
- **Headless CMS** — breaks the markdown-only, zero-service maintenance requirement.

## Consequences

- (+) Content is data with a schema; failures are actionable; zero runtime cost (build-time only).
- (−) We own the loader code (mitigated: unit-tested with Vitest).

---
title: "ADR-0012: Self-hosted SVG figures for project case studies"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-06
last-reviewed: 2026-07-06
deciders: [Md. Abu Ammar]
tags: [adr, content, figures, design]
supersedes: null
superseded-by: null
related:
  - adr-0002-markdown-content-pipeline.md
  - adr-0003-visual-identity.md
---

# ADR-0012: Self-hosted SVG figures for project case studies

**Status:** accepted · **Date:** 2026-07-06

## Context

Project case studies (`content/projects/*.md`) carried a `**Media:**` section
that the loader parsed as a raw string and no page ever rendered — three
projects shipped with literal `_TODO: figure_` markers. A research-paper
identity (ADR-0003) without figures reads as unfinished; screenshots and
raster exports would clash with the typeset aesthetic, break in one of the
two themes, and add asset-pipeline weight.

## Decision

1. **Figures are hand-authored SVGs committed to `public/figures/`**, drawn in
   the house style already established by the OG-image circuit motif: 2px
   muted strokes, `--color-surface` fills, the q0/q1 accent pair, IBM Plex
   Mono labels. Diagrams only — no screenshots, no raster images.
2. **SVGs reference theme tokens** (`var(--color-q0, #5fc9bf)` etc., with
   dark-theme fallbacks) so one file adapts to both themes.
3. **The Media convention is one markdown image per line**:
   `![Fig. N — caption](/figures/name.svg)`. The loader parses it into typed
   `figures: { src, caption }[]` and enforces — strictly in production
   (ADR-0002) — that every src matches `/figures/*.svg` and exists on disk.
4. **Rendering inlines the SVG at build time** (`ProjectFigure`, an RSC that
   `readFileSync`s from `public/`): inline markup is what lets CSS variables
   resolve. This is safe because the loader's allowlist means only
   repo-authored files are ever inlined. Width/height attributes match the
   viewBox so figures scale at intrinsic ratio (CLS 0), and inline SVG is
   HTML weight, not JavaScript — route budgets are unaffected.
5. **Figure numbering lives in the caption text**, authored in the markdown.
   Pages with interactive figures (the thesis's quanvolution demo is its
   Fig. 1) number static figures after them.
6. **Honesty rule for charts**: any figure whose shape is illustrative rather
   than measured must say so in the figure itself (the thesis loss sketch
   labels its curves illustrative and points to the repo notebooks).

## Consequences

- Case studies gain publication-grade figures with zero runtime dependencies
  and zero JS cost; both audiences get the "typeset paper" experience.
- Authoring a figure requires hand-writing SVG — deliberate friction that
  keeps figure quality and style consistent.
- The old free-text `media` field is gone from the `Project` type; the
  template documents the new convention.

---
title: "ADR-0006: Route-scoped WebGL for the /learn experience (supersedes ADR-0004's WebGL ban)"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
deciders: [Md. Abu Ammar]
tags: [adr, webgl, learn, performance]
supersedes: adr-0004-hero-2d-canvas-over-webgl.md
superseded-by: null
related:
  - ../../plans/plan-0002-learn-experience.md
---

# ADR-0006: Route-scoped WebGL for /learn

**Status:** accepted · **Date:** 2026-07-04

## Context

The portfolio gains an educational mission: a `/learn` scrollytelling journey
(qubit → superposition → entanglement → measurement → variational training →
quanvolution) where anyone learns quantum computing/QML interactively, at a
visual showpiece tier. ADR-0004 banned three.js site-wide to protect the JS
budget; that blanket ban blocks the showpiece.

## Decision

1. **Admit `three`, `@react-three/fiber`, `@react-three/drei` (selective imports:
   Line/Billboard/Html/AdaptiveDpr — never `<Text>`), and
   `@react-three/postprocessing` (Bloom, Vignette) as route-scoped dependencies.**
   Their imports are allowed ONLY under `src/app/learn/**` and
   `src/components/quantum/three/**`. Content pages stay WebGL-free.
2. **The homepage hero remains dependency-free 2D canvas** (ADR-0004's hero
   reasoning is reaffirmed) — upgraded cinematically (glow sprites, photon
   pulses) with zero new bytes; it links into `/learn`.
3. **`statevector.ts` is the sole physics source.** Renderers consume engine
   outputs (`blochVector`, `probabilities`, `expZZ`, …); they never reimplement
   gates or math.
4. **Per-route budgets** (CLAUDE.md §5): content routes ≤200 kB gz first-load;
   `/learn` ≤350 kB gz; `/learn`'s LCP element must be server-rendered text.
   Enforced in CI by `scripts/check-budgets.mjs`.
5. **Fallback ladder**, designed up front: reduced-motion OR no-WebGL OR
   chunk-loading → static SVG lesson figures with numeric readouts still
   interactive. One WebGL context for the whole page (single sticky stage);
   `frameloop="demand"`; context-loss handler falls back to SVG.
6. **Merge gate:** Lighthouse ≥95 all categories on `/` AND `/learn`.

## Options considered

- **Raw three.js** — imperative scene management fights React-driven
  scrollytelling state; r3f maps step/progress → scene declaratively.
- **Per-section canvases** — multiple WebGL contexts thrash memory on mobile.
- **Lottie/pre-rendered video** — not computed, not interactive; the point is
  real physics.
- **Staying 2D everywhere** — cheaper, but the user explicitly chose the
  showpiece tier after seeing the 2D result.

## Consequences

- (+) A genuinely differentiating educational experience; the heavy bytes are
  quarantined to the one route whose visitors asked for them.
- (−) ~250 kB gz on `/learn`; mitigated by dynamic ssr:false mount on first
  IO hit, demand frameloop, procedural geometry only (zero binary assets).
- (−) Two rendering paths (3D + SVG fallback) to keep in sync — accepted cost;
  both read the same engine outputs.

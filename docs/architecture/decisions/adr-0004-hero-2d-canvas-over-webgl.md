---
title: "ADR-0004: Hero = hand-written 2D canvas + real statevector sim (no three.js/WebGL)"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
deciders: [Md. Abu Ammar]
tags: [adr, hero, performance]
supersedes: null
superseded-by: null
related:
  - adr-0003-visual-identity.md
---

# ADR-0004: Hero — 2D canvas + real quantum simulator

**Status:** accepted · **Date:** 2026-07-04

## Context

The signature element is a variational quantum classifier that visibly trains: circuit
diagram with ticking parameter angles (parameter-shift gradient descent), live loss curve,
two mini Bloch spheres converging. Budget: Lighthouse ≥95, first-load JS <130 kB.

## Decision

Hand-written 2D `<canvas>` renderer + a dependency-free ~300-line pure-TypeScript 2-qubit
statevector simulator (4 complex amplitudes, RY/RZ/CNOT gates, parameter-shift gradients),
unit-tested against known gate identities. Mounted after hydration via `requestIdleCallback`,
paused off-screen via IntersectionObserver, `prefers-reduced-motion` → static converged frame.

## Options considered

- **three.js / react-three-fiber** — ~160 kB+ gz before the reconciler; kills the JS budget;
  and quantum circuits are inherently *2D notation* — 3D would be less authentic, not more.
- **Lottie / pre-rendered animation** — fake; a *correct* computed circuit is the whole point.
- **Static SVG** — safe but no signature moment (kept as the reduced-motion/placeholder state).

## Consequences

- (+) ~0 dependency bytes; genuinely computed physics = credibility with professor audience.
- (−) We own the math (mitigated: Vitest tests for H|0⟩, CNOT entanglement, RY expectations).

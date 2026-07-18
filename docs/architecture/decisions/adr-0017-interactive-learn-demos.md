---
title: "ADR-0017: Interactive Bloch sphere + parameter-shift widget on /learn"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-19
last-reviewed: 2026-07-19
deciders: [Md. Abu Ammar]
tags: [adr, webgl, learn, quantum, interaction]
supersedes: null
superseded-by: null
related:
  - ./adr-0006-webgl-learn-experience.md
  - ../../plans/plan-0008-top-1-percent.md
---

# ADR-0017: Interactive Bloch sphere + parameter-shift widget on /learn

**Status:** accepted · **Date:** 2026-07-19

## Context

`/learn` (ADR-0006) is a scrollytelling quantum curriculum. Two lessons
under-deliver on the promise of an *interactive* explainer (plan-0008 §3):

- **L1–L3 (Bloch sphere):** the WebGL stage only auto-rotates. Lesson copy
  implied "drag me," but there were no pointer handlers — a real trust gap
  (plan-0008 Tier-1 item 1). The demo says "watch," when the whole pitch is
  "manipulate."
- **L5 (variational training):** `05-variational.md` explains the
  **parameter-shift rule** (`∂⟨Z⟩/∂θ = [⟨Z⟩(θ+π/2) − ⟨Z⟩(θ−π/2)] / 2`) in prose,
  but the stage just reused the homepage hero — the two ±π/2 evaluations and the
  resulting gradient were never shown. The most elegant idea in the curriculum
  was text-only.

ADR-0006 §1 enumerated the allowed drei imports (`Line/Billboard/Html/
AdaptiveDpr`, never `<Text>`); it did not admit interaction controls, so
extending the WebGL contract needs its own decision.

## Decision

1. **Admit `OrbitControls` from `@react-three/drei`** (already a bundled
   dependency — no *new* runtime dep, CLAUDE.md §5.3) into the allowed drei
   surface for `src/components/quantum/three/**`. `<Text>` remains banned;
   labels stay DOM/SVG.
2. **The Bloch state arrow becomes pointer-draggable.** Dragging raycasts the
   pointer onto the unit sphere and converts the hit to `(θ, φ)`, which flows
   **up** to the lesson's own state via an `onDrag` callback — so the arrow and
   the θ/φ sliders are two-way bound. Drag-to-set is enabled only for the
   single-qubit lesson (L1), where `(θ, φ)` is exact; orbit-to-look is enabled
   for every interactive Bloch lesson.
3. **Interaction is a desktop (`pointer: fine`) enhancement.** On touch the
   stage stays display-only so vertical scroll is never hijacked — the sliders
   remain the interaction on mobile. This mirrors how ADR-0006's `effects` flag
   is already gated.
4. **The parameter-shift widget is zero-WebGL.** It is a pure SVG/DOM
   interactive (no three.js, no new context) that plots `⟨Z⟩(θ)`, marks the two
   `θ ± π/2` evaluations, draws the tangent whose slope *is* the parameter-shift
   gradient, and walks θ downhill on demand. It replaces the duplicated hero on
   L5's stage.
5. **`statevector.ts` stays the sole physics source (ADR-0006 §3).** The arrow
   drag consumes `blochVector`; the widget consumes `classify`. The small
   sweep/gradient orchestration lives in a pure, unit-tested
   `param-shift.ts` that only *calls* the engine — it reimplements no gates. The
   parameter-shift gradient is unit-tested against a finite-difference
   derivative.
6. **All ADR-0006 invariants hold unchanged:** the fallback ladder
   (reduced-motion / no-WebGL / chunk-loading → SVG figures with live numeric
   readouts and working sliders), one WebGL context for the page, `/learn`
   ≤ 350 kB gz first-load, and Lighthouse ≥ 95 on `/` and `/learn`. OrbitControls
   adds a few kB, well inside the ~145 kB of headroom (`/learn` measured 204 kB).

## Options considered

- **Hand-rolled pointer-orbit** instead of OrbitControls — avoids touching the
  drei allow-list, but re-implements damping, touch handling, and zoom clamping
  that drei already ships and tests. Rejected: more code, worse feel, for a
  dependency that is already in the bundle.
- **Parameter-shift widget in WebGL** — would share the Bloch stage's context,
  but the concept is a 1-D curve + tangent; SVG renders it crisper, is
  keyboard/SR-legible, and costs zero context. Chosen.
- **Keep the hero on L5 and add the widget below it** — two heavy interactives
  on one sticky panel; taller than the viewport and redundant with the homepage.
  Rejected in favor of replacing the duplicate.

## Consequences

- (+) L1 turns from "watch it spin" into "grab the qubit and place it," closing
  the #1 trust gap; L5 finally *shows* the rule it explains.
- (+) No new dependency; no new WebGL context; fallbacks and budgets unchanged.
- (−) A third interaction path (drag) to keep correct against the sim — mitigated
  by routing every angle through `statevector.ts` and unit-testing the gradient.
- (−) Interaction is desktop-only; mobile keeps sliders (accepted — scroll
  integrity on touch outranks drag-orbit there).

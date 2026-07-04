---
title: "Plan 0002: Educational Quantum/QML Learn Experience"
type: plan
status: active
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
tags: [plan, learn, webgl]
related: [../architecture/decisions/adr-0006-webgl-learn-experience.md]
---

# Plan — World-Class Educational Quantum/QML Experience

## Context

User verdict on the live site: the quantum hero "doesn't look that great" (thin schematic, not cinematic) and the portfolio should **teach** — "anyone can enter my portfolio and learns new things end to end." User chose: **BOTH** inline explainers AND a dedicated `/learn` scrollytelling journey, at the **WebGL/three.js showpiece** tier (supersedes ADR-0004). ChatGPT dossier already merged (Backend & AI Systems Engineer, 120+ kiosks, $MM payments).

Existing assets to reuse: dependency-free tested 2-qubit engine `src/components/quantum/statevector.ts` (ry/rz/h/cnot01/expZ/blochVector/classify/loss/trainStep) — stays the **single physics source**; three.js only renders. Content pipeline `src/lib/content/loader.ts` with `splitHeadingSections` — lessons flow through it. Budgets in CLAUDE.md §5.

## Tech decisions

- **react-three-fiber v9 + drei (selective: Line/Billboard/Html/AdaptiveDpr) + @react-three/postprocessing (Bloom, Vignette)**. No `<Text>` (troika font fetch) — labels via DOM/Html. All procedural geometry, zero binary assets. ≈250 kB gz, only on `/learn`.
- **Route isolation:** three imports allowed ONLY under `src/components/quantum/three/**` + `src/app/learn/**`. Stage mounts via `next/dynamic({ssr:false, loading:<StaticLessonFigure/>})` on first IO hit; `/learn` LCP = server-rendered lesson text. Homepage stays WebGL-free.
- **Budget guard:** `scripts/check-budgets.mjs` in CI — fail if `/learn` >350 kB gz or content routes >200 kB.
- **Engine extensions** (pure TS + tests): `probabilities`, `probZ`, `collapseZ` (project+renormalize), `expZZ` (Bell correlation); extract `quanvPatch`/`quanvFeatureMaps` into `src/components/quantum/qml.ts` shared by thesis demo + Lesson 6. Seeded mulberry32 RNG for measurement shots.

## /learn — one sticky stage, one WebGL context, 6 lessons

```
src/app/learn/page.tsx (RSC, force-static, loads content/learn/*.md)
└─ LearnJourney (client, no three imports)
   ├─ ProgressRail — fixed left rail styled as a qubit wire; 6 gate glyphs (RY·H·CNOT·📏·∂θ·⊞),
   │   active glows q0, click = scroll jump, aria-current
   ├─ StageHost → dynamic(learn-stage, ssr:false) — sticky right 55% desktop / top 45svh mobile
   │   └─ Canvas frameloop="demand" dpr [1,1.75] → SceneRouter crossfades 6 scenes
   │      primitives: BlochSphere3D, StateVectorArrow (glow+trail), WireRail3D, ProbBars3D,
   │      PhotonPulse; Effects (Bloom+Vignette, desktop fine-pointer only)
   └─ 6 × LessonSection (RSC prose) + LessonControls (real DOM sliders/buttons = a11y + mobile)
```

Fallback ladder (all designed up front): reduced-motion OR no-WebGL OR chunk-loading → static SVG figures (`lesson-figure-static.tsx`, style of `circuit-static.tsx`) with numeric readouts still interactive. CLS 0.

**Curriculum** (copy: plain-language, preprint serif, ≤1 Unicode equation/lesson, no KaTeX):
1. **The qubit** — drag 3D Bloch sphere / θ,φ sliders → α,β + P bars (`ry/rz/blochVector/probZ`)
2. **Superposition** — H button swings arrow to equator w/ trail; phase slider spins arrow while P bars don't move (`h/rz/expZ`)
3. **Entanglement** — build Bell state: both arrows shrink to center (purity→0) while ⟨Z⊗Z⟩ meter → +1, joint histogram 00/11 only (`h/cnot01/expZZ/probabilities`)
4. **Measurement** — hammer measure: collapse flash (bloom pulse), arrow snaps to pole, shot tally accretes toward theory bars (`probZ/collapseZ`, seeded RNG)
5. **Training a quantum circuit** — the hero restaged in 3D + parameter-shift callout ∂⟨Z⟩/∂θ=[⟨Z⟩(θ+π/2)−⟨Z⟩(θ−π/2)]/2; same draggable data points; "this exact code runs on the homepage" (`classify/loss/trainStep`)
6. **Quanvolution (the thesis)** — draw 8×8; a 2×2 patch lifts into a floating 3D circuit and lands as 4 glowing feature-map planes; CTA → thesis case study (`qml.ts`)

Ends with **Colophon**: "every number came from a 166-line unit-tested simulator — [source]".

**Content:** `content/learn/01-qubit.md`…`06-quanvolution.md`, frontmatter `title/order/status`, required sections `## Hook / ## Explain / ## Try it / ## Takeaway`, optional `## Deeper`. New `getLessons()` in loader (strict prod failures, tests). `content/explainers.md` (`## key` sections) + `getExplainers()`.

## Hero — cinematic 2D, WebGL-free (protects LCP; reaffirmed in ADR-0006)

Upgrades to `quantum-circuit-canvas.tsx` (~+3 kB, no deps): offscreen radial-gradient glow sprites composited `lighter` (never shadowBlur) under wires/gates/Bloch tips/points; **photon pulse** traveling the wires each epoch; bigger rim-lit Bloch spheres (r≈34) with vector trails; gradient loss stroke q0→q1 + area fill; third drifting radial layer in `.hero-atmosphere`; **new CTA "Learn quantum, from zero →"** (prefetches `/learn` on hover) + `<ExplainThis id="hero-classifier"/>`. Keeps requestIdleCallback mount / IO pause / CircuitStatic reduced-motion path.

## Inline explainers — `<ExplainThis/>`

Native `<details>` styled as preprint footnote (marker ※, mono summary "what am I looking at?", serif body, hairline left rule). Server component fed from `content/explainers.md`. Placements: hero, thesis quanvolution figure, research rows (optional prop on `arxiv-row.tsx`), each lesson's Deeper block.

## Docs/governance (FIRST — rule 3 forbids deps before the ADR)

- `adr-0006-webgl-learn-experience.md` (supersedes adr-0004; adr-0004 frontmatter gets `superseded-by` only). Decision: three/fiber/drei/postprocessing route-scoped to /learn; hero stays 2D; statevector.ts sole physics source; per-route budgets; fallback ladder; Lighthouse ≥95 on `/` AND `/learn` as merge gate.
- CLAUDE.md: §5.2 per-route budget table (content ≤200 kB, /learn ≤350 kB, /learn LCP = server text); §5.5 rewritten (WebGL allowed only in learn scope); §3/§7 rows.
- `docs/plans/plan-0002-learn-experience.md` (repo convention).
- Nav (`learn` before work) + ⌘K (`goto learn`) + terminal goto whitelist + sitemap + `learn/opengraph-image.tsx` (Bloch OG card).

## Phases + verification

- **P0 Docs** → build green (docs only)
- **P1 Engine** (`probabilities/probZ/collapseZ/expZZ`, `qml.ts`, refactor quanvolution-demo) → `npm test` (Bell ⟨ZZ⟩=+1, collapse renorm, quanv regression)
- **P2 Content+loader** (6 lessons, explainers, `getLessons/getExplainers`, tests) → tests; strict build failure check
- **P3 Explainers+wiring** (explain-this, placements, nav/⌘K/terminal/sitemap) → Lighthouse `/` stays 100
- **P4 /learn scaffold no-WebGL** (page, journey, rail, sections, SVG figures, DOM controls) → Lighthouse `/learn` baseline ~100; keyboard walk
- **P5 WebGL stage** (install 4 deps per ADR; primitives, 6 scenes, crossfades, effects, fallbacks, budget script + CI) → budget ≤350 kB; Lighthouse `/`+`/learn` ≥95; perf trace scrolling all scenes (no long task >200 ms, 60 fps desktop); reduced-motion emulation → SVG, zero WebGL; heap stable after 3 full scrolls
- **P6 Hero cinematic** → Lighthouse `/` LCP <1 s, CLS 0; frame trace 60 fps; reduced-motion serves CircuitStatic
- **P7 Polish/matrix** (copy, mobile 45svh band, light-theme 3D materials read CSS vars, print hides stage) → full gates ×4 pages, a11y pass, both themes AA; commit per phase, push, verify Vercel prod

Order: P0 → P1 → P2 → (P3 ∥ P6) → P4 → P5 → P7.

## Critical files

- `src/components/quantum/statevector.ts` (+tests) — physics source, gains 4 fns
- `src/lib/content/loader.ts` — `getLessons`/`getExplainers` on existing patterns
- `src/components/hero/quantum-circuit-canvas.tsx` — cinematic pass
- `src/app/learn/**` + `src/components/learn/**` + `src/components/quantum/three/**` — new
- `CLAUDE.md`, `adr-0006`, `adr-0004` (frontmatter), `.github/workflows/ci.yml` (budget check), `package.json` (4 deps)

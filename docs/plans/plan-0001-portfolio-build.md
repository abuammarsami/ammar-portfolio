---
title: "Plan 0001: Portfolio Build"
type: plan
status: active
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
tags: [plan, build]
related: [../architecture/overview.md]
---

# Plan — Top-1% Portfolio for Md. Abu Ammar

## Context

Abu Ammar wants a world-class personal portfolio built in `/Users/abuammar/workspace/ammar-portfolio` (currently: CV pdf, 2 photos, `content/` markdown templates + extraction prompt already scaffolded). Requirements from him directly:

1. **Not look AI-generated** — no generic template feel.
2. **UI/UX carries his actual work identity**: machine learning + quantum computing (undergrad thesis: CVQNN/quanvolutional networks on PennyLane/IBMQ; multi-output CNN; Bangla POS + knowledge distillation; .NET Aspire/Azure/payments engineering).
3. **Serve two audiences equally**: recruiters (senior backend/AI roles) AND professors (grad school/research).
4. **Follow his BareeGaree documentation pattern** (verified by exploration): root `CLAUDE.md` agent contract; `docs/` with `architecture/decisions/adr-NNNN-*.md` (immutable), `plans/` (status table), `guides/`, `reference/`; YAML frontmatter (`title,type,status,owner,created,last-reviewed,tags,related`) on every doc; lifecycle `draft→in-review→active→implemented→deprecated`; kebab-case.
5. Dark default + light toggle. Host on Vercel. Best-in-class stack.
6. Content arrives via `content/*.md` (he'll paste from ChatGPT/personal Claude using the already-created `content/EXTRACTION-PROMPT.md`); GitHub (`abuammarsami`, 22 repos — strongest: QML thesis repo, Age/Gender/Race multi-output CNN with real metrics, startup-ensemble, face-recognition CNN) supplies project material.

**One-liner:** A statically-rendered Next.js site with the typographic discipline of a physics preprint, one genuinely-computed quantum interactive as its signature, and markdown-only content maintenance — documented under the BareeGaree pattern.

## Tech Stack (decided)

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | RSC = zero client JS for content pages; built-in OG images/sitemap/metadata; first-class Vercel |
| Rendering | Full static prerender (SSG) on Vercel — **not** `output:'export'` | Pure CDN HTML anyway; keeps `opengraph-image.tsx`, `next/image`, redirects |
| Styling | Tailwind CSS v4 (CSS-first `@theme` tokens in `src/styles/globals.css`) | Tokens as CSS vars → theming is one `data-theme` attr |
| Content | `fs` + `gray-matter` + `zod` + unified (remark-parse→gfm→rehype→stringify). **Not MDX, not Contentlayer** | Pasted content mustn't break builds on a stray `<`; Contentlayer unmaintained. ~200-line typed loader |
| Motion | `motion` via `LazyMotion`+`m` (~6 kB) — scroll reveals only, NOT the hero | |
| Hero | Hand-written 2D Canvas + real 2-qubit statevector simulator in pure TS (~300 lines, dependency-free). **No three.js/R3F** (~160 kB, kills Lighthouse; quantum circuits are inherently 2D notation — a *correct* circuit signals authenticity) | |
| Theme | `next-themes` (dark default, no-FOUC) | |
| Fonts | **STIX Two Text** (serif, headings/prose — the STM-journal typeface), **IBM Plex Sans** (UI), **IBM Plex Mono** (metadata/terminal) — via `next/font`, variable, metric fallbacks. Plex = IBM Quantum's typeface; he ran on IBMQ — biographical pairing | |
| Analytics | Vercel Web Analytics (cookieless) | |

Runtime deps (~11): `next react react-dom motion next-themes gray-matter zod unified remark-parse remark-gfm remark-rehype rehype-stringify`. Rejected: three.js/R3F, Contentlayer, MDX, cmdk, Radix, shadcn/any UI kit.

## Visual Design Language (fusion of his 4 picks — one coherent system)

**Base = research-paper minimalism · Signature = one quantum interactive · Accents = monospace metadata · Neural motifs = real figures only.**

| Motif | Where it appears (and nowhere else) |
|---|---|
| Paper typography | Whole system: STIX headings, §-numbered sections on case-study pages only, "Fig. N" captions, hairline rules, footnote asides |
| Quantum interactive | Hero only + static circuit glyph as site mark/favicon + quanvolution demo on QML case study (stretch) |
| Terminal/mono | Metadata only: dates, `[quant-ph]`-style chips, BibTeX blocks, footer as shell prompt (`ammar@portfolio:~$ contact --email`), ⌘K palette |
| Neural aesthetics | No ambient node-graph backgrounds (the #1 AI-portfolio tell). Appears as *actual labeled figures* — his multi-output CNN drawn inside that case study, hover-highlighting the 3 output heads |

**Palette (dark default):** `--bg #0B0D12` (blue-black), `--surface #12151D`, `--ink #E9E7E0` (warm paper-white), `--muted #8A8F9C`, `--q0 #5FC9BF` (teal, |0⟩), `--q1 #9D8CFF` (violet, |1⟩). **Entangled-pair interaction motif:** the two accents always respond as a correlated pair (hover a card → border goes `--q0`, its paired tag elsewhere goes `--q1`; link underlines animate as two-color superposition, "collapse" on click). Light mode = print-paper (`#FBFAF7` ground).

## Information Architecture

```
/                Hero (circuit trainer + tagline + DUAL CTAs) → Selected Work (3) →
                 Research highlights (2, arXiv-row style) → About excerpt → terminal footer
/work            All case studies (paper-abstract cards)
/work/[slug]     §1 Problem · §2 Approach · §3 Impact · figures · BibTeX cite block
/research        arXiv-style listing (thesis, Bangla POS, CNN, ensemble): mono IDs,
                 [cs.LG]/[quant-ph] chips, expandable abstracts, PDF/GitHub links
/about           Narrative + photo + experience timeline + skills + testimonials
/writing         From writing.md (hidden from nav if empty)
/resume          Redirect → /resume.pdf
```

**Dual audience — NO global mode toggle** (gimmick, doubles maintenance). Instead: dual hero CTAs ("Selected work →" / "Research & publications →" styled as the entangled pair), engineering + research both above second fold, resume 1 click everywhere, JSON-LD `Person` + `ScholarlyArticle`.

## Signature Anti-Generic Elements

1. **MVP — Hero: variational quantum classifier that trains while you watch.** Real 2-qubit statevector sim; circuit diagram (RY/RZ, CNOT) with parameter angles ticking under parameter-shift gradient descent; live loss curve; two mini 2D Bloch spheres converging; mono epoch counter. `prefers-reduced-motion` → static converged frame. This is his thesis, executable.
2. **MVP — Case studies as paper abstracts**: § sections, abstract block, Fig. captions, mono keywords, copyable `@misc{ammar2024kiosk,...}` BibTeX block.
3. **MVP — `/research` as arXiv listing.**
4. **Stretch — ⌘K terminal palette** (hand-rolled ~200 lines): `goto work`, `copy email`, `download cv`, `toggle theme`, `mode recruiter|professor`.
5. **Stretch — interactive quanvolution demo** on QML case study: draw on 8×8 grid, 2×2 quantum filter sweeps, renders 4 feature maps (same sim engine).

## Content Pipeline

- Mapping: `about.md` → hero+about (splits on existing `## Hero tagline` etc. heading contract); `projects/*.md` (excl. `_template.md`) → `/work/[slug]`; `experience.md` → timeline; `skills.md` → skills; `writing.md` + research-tagged projects → `/research`, `/writing`; `testimonials.md` → about; `meta.md` → build constants.
- Loader: `src/lib/content/{schema.ts (Zod), loader.ts (fs→gray-matter→section parser→unified), markdown.ts}`. Extend `projects/_template.md` with optional frontmatter (`title,date,tags,featured,category: engineering|research,links`); document in `docs/reference/content-schema.md`.
- **Empty-content strategy: draft-first, single source of truth.** Phase 1: extract CV PDF + GitHub data into the real `content/*.md` as drafts (`status: draft`). Site builds real pages day one; user later overwrites with his ChatGPT/Claude extraction (prompt already at `content/EXTRACTION-PROMPT.md`) and flips to `active`. Loader: strict in prod build (missing required section = loud failure naming file/section), lenient in dev; empty optional files render nothing.

## Repo Structure (BareeGaree-compliant)

```
ammar-portfolio/
├── CLAUDE.md                       # agent contract: identity, commands, layout,
│                                   # non-negotiables (Lighthouse ≥95, no dep w/o ADR,
│                                   # content only from content/, kebab-case), stack table
├── docs/
│   ├── README.md
│   ├── architecture/
│   │   ├── overview.md
│   │   └── decisions/adr-0001…0005 (see below)
│   ├── plans/ (README.md status table + plan-0001-portfolio-build.md)
│   ├── guides/ (updating-content.md ← the user's day-to-day doc, local-development.md)
│   └── reference/ (content-schema.md, design-tokens.md)
├── content/                        # existing; filled as drafts Phase 1
├── public/                         # resume.pdf (renamed), optimized photos, favicon
├── src/
│   ├── app/                        # layout, page, work/, research/, about/, writing/,
│   │   #                             opengraph-image.tsx, sitemap.ts, robots.ts
│   ├── components/
│   │   ├── hero/ (quantum-circuit-canvas.tsx, use-circuit-trainer.ts)
│   │   ├── quantum/ (statevector.ts — pure TS sim, unit-tested)
│   │   ├── paper/ (section-heading, figure, bibtex-block, arxiv-row)
│   │   ├── palette/ (stretch)
│   │   └── ui/ (nav, footer-terminal, theme-toggle, tag-chip)
│   ├── lib/content/
│   └── styles/globals.css
├── package.json · tsconfig.json · next.config.ts · .github/workflows/ci.yml
```

All docs get YAML frontmatter; ADRs immutable; kebab-case.

**ADRs (Phase 0):** adr-0001 nextjs-static-rendering (vs Astro/export/SvelteKit) · adr-0002 markdown-content-pipeline (vs MDX/Contentlayer/CMS) · adr-0003 visual-identity (STIX/Plex, entangled-pair system) · adr-0004 hero-2d-canvas-over-webgl (vs three.js/Lottie/static SVG) · adr-0005 vercel-hosting.

## Phased Build

- **Phase 0 — Scaffold + governance (½d):** `git init`; Next 15 + TS strict + Tailwind v4; ESLint/Prettier; CLAUDE.md; full docs/ tree + 5 ADRs + plan doc; CI (typecheck/lint/build); move resume+photos → `public/`. ✓ build green, CI green.
- **Phase 1 — Design system + draft content (1d):** `@theme` tokens both modes, font trio, primitives (nav, footer-terminal, tag-chip, paper components), theme toggle; extract CV+GitHub → `content/*.md` drafts. ✓ sample page screenshotted both themes (Chrome DevTools MCP), contrast pass, zero font CLS.
- **Phase 2 — Content pipeline (½–1d):** loader + Zod + renderer + Vitest tests (section parsing, strict-mode failures, slugs); content-schema doc. ✓ tests; corrupt file → actionable build failure.
- **Phase 3 — Pages (1–2d):** all routes; hero as static converged-circuit SVG placeholder (doubles as reduced-motion state); per-route metadata. ✓ walkthrough; responsive 360/768/1280/1920; keyboard nav.
- **Phase 4 — Signature interactives (1–2d):** statevector sim unit-tested against gate identities (H|0⟩, CNOT entanglement, RY expectations); canvas renderer; `requestIdleCallback` mount, IntersectionObserver pause; ⌘K if time. ✓ frames <8 ms (perf trace), no heap growth after 5 min, console clean.
- **Phase 5 — Polish/SEO/a11y (1d):** OG images per route (circuit motif), sitemap/robots/JSON-LD, AVIF photo, focus audit, skip link, canvas `role="img"`+label. ✓ Lighthouse `/`,`/work/[slug]`,`/research`: **Perf ≥95, A11y 100, SEO 100, BP 100**; first-load JS <130 kB.
- **Phase 6 — Deploy (½d):** Vercel + domain + Web Analytics; `/resume`→PDF redirect; prod Lighthouse re-run; Search Console; link check.

## Verification (standing gates)

Every phase: `npm run build` + typecheck + CI green; Chrome DevTools MCP screenshots at 4 breakpoints × 2 themes. Budgets in CLAUDE.md non-negotiables: Lighthouse ≥95 all categories, first-load JS <130 kB, CLS 0, hero ≤1 rAF loop paused off-screen, no new runtime dep without ADR. User's maintenance path: edit markdown → `npm run dev` → done (`docs/guides/updating-content.md`).

## Critical files

- `CLAUDE.md` (create first — everything hangs off it)
- `src/lib/content/loader.ts` (the markdown→page bridge)
- `src/components/quantum/statevector.ts` (the signature's engine)
- `src/styles/globals.css` (entire visual identity as tokens)
- `content/projects/_template.md` (existing contract to honor/extend)

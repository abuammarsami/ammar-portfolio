---
title: "Architecture Overview"
type: architecture
status: active
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
tags: [architecture]
related:
  - decisions/adr-0001-nextjs-static-rendering.md
  - decisions/adr-0002-markdown-content-pipeline.md
---

# Architecture Overview

**One-liner:** Statically prerendered Next.js (App Router, RSC) + typed markdown content
pipeline + one hand-written canvas quantum simulator. No CMS, no UI kit, no WebGL.

## Data flow

```
content/*.md ──(build time)──▶ src/lib/content/loader.ts
                                 ├─ gray-matter (frontmatter)
                                 ├─ zod (schema validation — strict in prod)
                                 ├─ section parser (heading/label contracts)
                                 └─ unified (markdown → HTML)
                                        │
                                        ▼
                              src/app/* RSC pages (force-static)
                                        │
                                        ▼
                              Vercel CDN (pure HTML; ~0 client JS on content pages)
```

Client-side JS islands (only three):
1. `hero/` — quantum circuit trainer (canvas + pure-TS statevector sim, ADR-0004)
2. `ui/theme-toggle` — next-themes
3. scroll reveals via `motion` LazyMotion (~6 kB)

## Route map

| Route | Source | Notes |
|---|---|---|
| `/` | about.md + featured projects + research | hero + dual CTAs |
| `/work`, `/work/[slug]` | content/projects/*.md | paper-abstract case studies |
| `/research` | research-tagged projects + writing.md | arXiv-style listing |
| `/about` | about.md + experience.md + skills.md + testimonials.md | |
| `/writing` | writing.md | hidden from nav when empty |
| `/resume` | redirect → /resume.pdf | next.config.ts |

## Budgets (non-negotiable, see CLAUDE.md §5)

Lighthouse ≥95 all categories · first-load JS <130 kB gz · CLS 0 · hero ≤1 rAF loop, paused off-screen.

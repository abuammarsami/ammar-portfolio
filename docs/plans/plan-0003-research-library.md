---
title: "Plan 0003: Research library — papers, distilled pages, constellation"
type: plan
status: in-progress
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
tags: [plan, research, papers, content]
related:
  - ../architecture/decisions/adr-0008-research-library.md
---

# Plan 0003: Research library

Implements ADR-0008. Source material: 9 PDFs in the untracked `papers/`
folder, extracted cover-to-cover on 2026-07-04.

## Curation decisions (from full-text extraction)

| Paper | Library entry | PDF hosted | Why |
|---|---|---|---|
| CSE499 QML thesis (Machine Learning In The Realm Of Quantum, Summer 2022, sup. Dr. Mahdy Rahman Chowdhury) | yes — flagship | yes | Accepted thesis; honest QNN/CVQNN vs classical numbers |
| CSE498 Bangla POS directed research (Summer 2022, sup. Dr. Nabeel Mohammed) | yes | yes | Accepted directed-research book; frame method, don't overclaim the unreported distillation gain |
| CSE498R IEEE-format POS paper | no (same work as above) | no | Unfilled "y%" placeholder in abstract |
| CSE445 "for NSUJSR" | no | no | Two papers spliced together; startup work already a project page |
| Network anomaly detection + KD (CICIDS2017) | yes | no ("on request") | Solid teacher results + honest negative distillation result, but p.1–2 contain pasted text from an unrelated PMIPv6 paper |
| CSE583 blood cell detection (RetinaNet on BCCD) | yes | no ("on request") | Real numbers (mAP 0.876 @0.5) but the conclusion contradicts its own comparison table |
| CSE583 assignments 1–2 | no | no | Routine coursework; one supporting sentence on the blood-cell entry |
| "IEEE_Conference_Template" (multicore survey) | no | no | Originality unverified — do not publish under his name until reviewed |

## Phases

- **P0 docs** — ADR-0008, this plan, CLAUDE.md layout row. ✅
- **P1 content** — `content/papers/*.md` (4 entries), PDFs → `public/papers/`,
  `papers/` gitignored.
- **P2 loader** — `paperFrontmatterSchema`, `getPapers()/getPaper()`, tests.
- **P3 pages** — `/research` library + `/research/[slug]` distilled pages,
  BibTeX block reuse, JSON-LD, OG metadata, sitemap.
- **P4 constellation** — 2D-canvas knowledge graph on `/research` (nodes:
  papers/projects/lessons; edges from `related`), static fallback.
- **P5 agent layer** — corpus Publications section, `get_paper` MCP tool,
  real `search_publications`, llms.txt, resume.json `publications[]`.
- **P6 reconcile** — project pages get verified facts (thesis title,
  supervisors, dates, metrics) + paper cross-links; homepage research section
  points at the library.
- **P7 verify/deploy** — tests, typecheck, lint (pipefail), build, budgets,
  Lighthouse (/, /research, one paper page), both themes, prod smoke
  (MCP `get_paper`, `ask` about the thesis).

## Verification gates

Same as plan-0001/0002: Lighthouse ≥95 all categories (A11y/SEO/BP = 100),
content routes ≤200 kB gz first-load, CLS 0, `npm test` green, CI green.

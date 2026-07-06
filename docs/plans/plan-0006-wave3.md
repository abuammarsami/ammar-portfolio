---
title: "Plan 0006: Wave 3 — the portfolio that sells itself"
type: plan
status: in-progress
owner: Md. Abu Ammar
created: 2026-07-06
last-reviewed: 2026-07-06
tags: [plan, ai, agents, monetization, quantum, seo]
related:
  - adr-0011-public-ai-generated-pages.md
  - plan-0005-living-portfolio.md
---

# Plan 0006: Wave 3 — the portfolio that sells itself

Nine acts in three tracks, six gated PRs. Full design rationale lives in the
session plan; this doc is the shipping record.

## Tracks

- **Wow**: tailored pitch links (`/for/<slug>`, ADR-0011), interview mode
  (voice/text interview bar while the site drives itself), dynamic autopilot
  (LLM-planned tours, strictly validated, static fallback).
- **Money**: `/hire` services page (tutoring/consulting CTAs), template
  productization landing + waitlist on `/colophon`.
- **Craft**: quantum playground (`/playground`, circuit composer +
  `compose_circuit` tool), scholar layer (citation_* metas, paper OG cards,
  .bib downloads), typeset `/cv` (print-perfect, lens-aware), colophon build
  stats (`colophon.json`, committed stats emitted by the budgets script).

## PRs

| PR | Contents | Status |
|---|---|---|
| 1 | Pitch links + ADR-0011 | in progress |
| 2 | Dynamic autopilot | pending |
| 3 | Interview mode | pending |
| 4 | /hire + scholar layer + /cv | pending |
| 5 | Quantum playground | pending |
| 6 | Colophon + template waitlist + stats | pending |

Gate ritual per PR: build + budgets + tests + typecheck + lint, Lighthouse on
touched routes, CLS 0, prod-build browser verification.

## Standing constraints

Zero new runtime deps (zod already present); all copy from `content/*.md`;
`/` has 0.0 kB eager headroom — new client features are event-triggered
dynamic imports only; Groq free tier 8k tokens/min; Redis = Upstash raw REST.

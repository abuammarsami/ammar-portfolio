---
title: "ADR-0008: The research library — real papers, distilled pages, curated PDFs"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
deciders: [Md. Abu Ammar]
tags: [adr, research, content, papers]
supersedes: null
superseded-by: null
related:
  - adr-0002-content-pipeline.md
  - adr-0003-visual-identity.md
  - adr-0007-agent-layer.md
---

# ADR-0008: The research library

**Status:** accepted · **Date:** 2026-07-04

## Context

The site's `/research` page listed research **projects** with CV-derived
summaries. The author's actual papers now exist in the repo: two accepted
NSU theses (the CSE499 QML thesis supervised by Dr. Mahdy Rahman Chowdhury and
the CSE498 Bangla-POS directed research supervised by Dr. Nabeel Mohammed),
plus IEEE-format course papers of varying polish. A full-text extraction pass
found that some drafts contain unfinished-manuscript artifacts (placeholder
values, spliced content from unrelated documents), so publishing every PDF
verbatim would harm the professor-facing audience the site serves.

The site's stated identity has also widened: not only a portfolio but a
personal space for knowledge sharing. Papers must therefore be *readable in
minutes*, not just downloadable.

## Decision

1. **Papers become first-class content**: `content/papers/<slug>.md`, parsed by
   the existing strict Zod loader (ADR-0002). Frontmatter: `title, authors,
   venue, year, kind (thesis|paper|report), supervisor?, pdf (bool), tags,
   related { project?, lesson? }, featured, status`. Required body sections
   (`**Label:**` style, same as projects): `Abstract`, `In plain words`,
   `Method`, `Results`, `Looking back`. Optional: `BibTeX`.
2. **Distilled paper pages** at `/research/<slug>`: abstract + a plain-language
   read + honest results (including negative results) + a retrospective +
   BibTeX + PDF download when published. `ScholarlyArticle` JSON-LD per page.
3. **Curated PDF hosting**: only manuscripts that pass a quality bar are copied
   to `public/papers/<slug>.pdf` and linked. Entries whose PDFs contain draft
   artifacts still get pages (the work is real) but say "manuscript available
   on request". The raw `papers/` folder stays **untracked** (`.gitignore`) —
   the public repo must never ship unreviewed drafts.
4. **The constellation**: `/research` opens with a hand-written 2D-canvas
   knowledge graph — papers, projects, and lessons as typed nodes, edges from
   `related` frontmatter. No new dependencies, WebGL-free (ADR-0006 scope
   untouched), reduced-motion/no-JS fallback is plain markup. It is navigation,
   not decoration: every node is a link.
5. **Agent layer inherits papers** (ADR-0007): the corpus gains a Publications
   section; `search_publications` searches real paper content; a `get_paper`
   MCP tool returns a single distilled paper; `/llms.txt` and `resume.json`
   list publications.

## Consequences

- Facts on project pages previously marked `[VERIFY]` are now sourced from the
  papers themselves (exact thesis title, supervisors, session dates, metrics).
- Content rule 4 (site copy only from `content/*.md`) now covers papers; the
  loader fails production builds on malformed paper files.
- Two audiences converge: professors get abstracts, BibTeX, and PDFs;
  recruiters get "In plain words" and the engineering judgment visible in
  "Looking back".
- Honest-results framing is a deliberate stance: the thesis reports quantum
  models *losing* to classical baselines (0.92 vs 0.96; 0.72 vs 0.88) and the
  anomaly-detection paper reports distillation underperforming its teacher.
  The site presents these as findings, not failures.

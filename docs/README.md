---
title: "Documentation Index"
type: reference
status: active
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
tags: [index]
related: []
---

# Documentation

Engineering documentation for the portfolio. For AI agents and future-me: start here,
then read the root [CLAUDE.md](../CLAUDE.md) agent contract.

## Folder taxonomy

| Folder | What lives here | When to add a doc |
|---|---|---|
| [architecture/](architecture/) | System overview + immutable ADRs | New system-level decision |
| [plans/](plans/) | Feature/initiative designs with status table | Before implementing anything non-trivial |
| [guides/](guides/) | How-tos (updating content, local dev) | Anything future-me needs to stay productive |
| [reference/](reference/) | Slow-changing facts (content schema, design tokens) | Producing stable reference material |

## Conventions

- Every doc opens with YAML frontmatter: `title, type, status, owner, created, last-reviewed, tags, related`.
- Status lifecycle: `draft → in-review → active → implemented → deprecated`.
- ADRs are **immutable** once accepted — write a new one with `supersedes:` instead of editing.
- kebab-case filenames; ADRs are `adr-NNNN-kebab-title.md`.

## Quick links

- [Architecture overview](architecture/overview.md)
- [All ADRs](architecture/decisions/)
- [Build plan](plans/plan-0001-portfolio-build.md)
- [Updating content (day-to-day guide)](guides/updating-content.md)
- [Content schema](reference/content-schema.md)

---
title: "Updating Content (day-to-day guide)"
type: guide
status: active
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
tags: [guide, content]
related:
  - ../reference/content-schema.md
---

# Updating Content

**Who this is for:** future me (or an AI agent) changing what the site says.
You never touch components — the site's words live entirely in `content/`.

## Prerequisites

- Node installed, `npm install` done once.

## Steps

1. Edit the relevant file in `content/` (see [content-schema](../reference/content-schema.md)
   for exactly which headings/labels each file must keep).
2. Adding a project? Copy `content/projects/_template.md` → `content/projects/<kebab-slug>.md`.
   The filename becomes the URL: `/work/<kebab-slug>`.
3. Preview: `npm run dev` → http://localhost:3000
4. Check it builds strictly: `npm run build` (a missing required section fails loudly,
   naming the file and section).
5. Commit + push — Vercel deploys automatically.

## Notes

- Optional files (`testimonials.md`, `writing.md`) can stay empty — their sections/nav
  entries simply don't render.
- Frontmatter `status: draft` on a project hides it from listings in production.

## Next steps

- [local-development.md](local-development.md) for the full dev loop.

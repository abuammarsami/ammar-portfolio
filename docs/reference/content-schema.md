---
title: "Content Schema"
type: reference
status: active
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
tags: [reference, content]
related:
  - ../architecture/decisions/adr-0002-markdown-content-pipeline.md
  - ../guides/updating-content.md
---

# Content Schema

The loader (`src/lib/content/loader.ts`) enforces these contracts. **Strict in
production builds** — a missing required section fails `npm run build` loudly, naming
the file and section. Lenient in dev (warns, renders placeholder).

## content/projects/*.md → /work/[slug]

- Slug = filename (kebab-case). Files starting with `_` are ignored.
- **Frontmatter (Zod-validated):**

| Field | Type | Notes |
|---|---|---|
| `title` | string | required |
| `date` | `YYYY-MM` string | required; listings sort newest-first |
| `tags` | string[] | rendered as `[chips]` |
| `featured` | bool | `true` → homepage |
| `category` | `engineering` \| `research` | research also feeds `/research` |
| `links.github`, `links.live` | url \| null | |
| `status` | `draft` \| `active` | `draft` hidden from production listings |

- **Body — required `**Label:**` sections:** `Summary`, `Problem`, `Approach`, `Impact`,
  `Tech stack`. Optional: `Links`, `Media`.

## content/about.md

Required `##` sections: `Hero tagline`, `Hero subheading`, `About me narrative`.

## content/experience.md

One `## Company — Title` per role; first line of each block is `*dates · location*`
(emphasized); the rest is markdown bullets.

## content/skills.md

One `##` heading per group; empty groups drop out silently.

## content/writing.md · content/testimonials.md (optional)

Free markdown after the `# H1`. Empty or template-only ⇒ the section/nav entry
doesn't render at all.

## content/meta.md

Human-maintained brief (links, targeting). Read at build time for contact constants.

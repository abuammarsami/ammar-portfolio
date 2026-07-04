---
title: "Local Development"
type: guide
status: active
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
tags: [guide, dev]
related:
  - updating-content.md
---

# Local Development

**Who this is for:** anyone (human or agent) working on the site's code.

## Prerequisites

- Node ≥ 20, npm.

## Steps

```bash
npm install        # once
npm run dev        # dev server with Turbopack
npm run typecheck  # tsc --noEmit — keep green
npm run lint
npm test           # vitest: content loader + quantum sim tests
npm run build      # production build — the merge gate
```

## Rules that bite

- Read [CLAUDE.md](../../CLAUDE.md) §5 non-negotiables before adding anything.
- New runtime dependency ⇒ write an ADR first.
- All copy comes from `content/` — if you're typing prose into a `.tsx`, stop.

## Next steps

- [updating-content.md](updating-content.md) — the content loop.
- [../architecture/overview.md](../architecture/overview.md) — how it all fits.

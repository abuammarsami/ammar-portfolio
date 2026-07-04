# CLAUDE.md — Agent Contract

Read this first, every session. Module rules live in sub-folder CLAUDE.md files (none yet).

## 1. Project Identity

Personal portfolio of **Md. Abu Ammar** — Software Engineer (backend .NET/Azure + AI/ML) and
Quantum Machine Learning researcher. Audiences served **equally**: recruiters (senior
backend/AI roles) and professors (grad-school/research).

- Live URL: TBD (Vercel)
- GitHub: github.com/abuammarsami · LinkedIn: linkedin.com/in/abu-ammar
- Design identity: research-paper minimalism base + one quantum interactive (hero) +
  monospace metadata accents. See [docs/architecture/decisions/adr-0003-visual-identity.md](docs/architecture/decisions/adr-0003-visual-identity.md).

## 2. Commands (Copy-Paste)

```bash
npm run dev          # dev server (Turbopack)
npm run build        # production build — must stay green
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest (content loader + quantum sim)
```

## 3. Repository Layout

```
content/          # ALL site copy lives here as markdown — the only place content comes from
docs/             # architecture (ADRs), plans, guides, reference — YAML frontmatter on every doc
public/           # resume.pdf, photos, favicon
src/app/          # Next App Router routes (all force-static)
src/components/   # hero/ quantum/ paper/ ui/ (palette/ stretch)
src/lib/content/  # typed markdown loader (fs + gray-matter + zod + unified)
src/styles/       # globals.css — Tailwind v4 @theme tokens = the entire visual identity
```

## 4. Architecture — One-Liner

Statically prerendered Next.js (App Router, RSC, no client JS on content pages) + typed
markdown content pipeline + one hand-written canvas quantum simulator. No CMS, no UI kit.

## 5. Non-Negotiable Rules

1. **Lighthouse ≥ 95 all categories** (A11y/SEO/BP = 100). Never merge a change that drops it.
2. **First-load JS < 130 kB gz. CLS = 0.**
3. **No new runtime dependency without an ADR.**
4. Site copy comes **only** from `content/*.md` — never hardcode prose in components.
5. No three.js / R3F / UI kits / ambient particle backgrounds (ADR-0004). The hero is the
   only animated set-piece; it pauses off-screen and respects `prefers-reduced-motion`.
6. kebab-case for all files and docs. ADRs are immutable once accepted — supersede, don't edit.
7. Every doc in `docs/` carries YAML frontmatter (`title,type,status,owner,created,last-reviewed,tags,related`).
8. TypeScript strict; no `any` without an inline justification comment.
9. The quantum sim (`src/components/quantum/statevector.ts`) stays dependency-free and unit-tested.
10. Dark is the default theme; both themes must pass WCAG AA contrast.

## 6. Naming Conventions

| Thing | Pattern | Example |
|---|---|---|
| Files/folders | kebab-case | `footer-terminal.tsx` |
| ADRs | `adr-NNNN-kebab-title.md` | `adr-0004-hero-2d-canvas-over-webgl.md` |
| Content projects | slug = filename | `content/projects/kioskvisionai.md` → `/work/kioskvisionai` |
| Design tokens | `--q0`/`--q1` accent pair, `--bg/--surface/--ink/--muted` | see `globals.css` |

## 7. Tech Stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TS strict, Turbopack) |
| Rendering | Full SSG on Vercel (not `output: export`) — ADR-0001 |
| Styling | Tailwind CSS v4, CSS-first `@theme` tokens |
| Content | fs + gray-matter + zod + unified — ADR-0002 (no MDX, no CMS) |
| Motion | `motion` via LazyMotion (scroll reveals only) |
| Hero | Hand-written 2D canvas + pure-TS 2-qubit statevector sim — ADR-0004 |
| Theme | next-themes, dark default |
| Fonts | STIX Two Text · IBM Plex Sans · IBM Plex Mono via `next/font` |
| Tests | Vitest |
| Hosting | Vercel + Web Analytics — ADR-0005 |

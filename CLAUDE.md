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
content/papers/   # the research library (ADR-0008): one .md per real paper/thesis
docs/             # architecture (ADRs), plans, guides, reference — YAML frontmatter on every doc
papers/           # UNTRACKED raw manuscript archive — never publish; curated copies go to public/papers
public/           # resume.pdf, photos, favicon; public/papers/ = reviewed PDFs only
src/app/          # Next App Router routes (all force-static); .well-known/ = agent card
src/components/   # hero/ quantum/ paper/ ui/ agent/ (palette/ stretch)
src/lib/content/  # typed markdown loader (fs + gray-matter + zod + unified)
src/lib/agent/    # the tool layer (ADR-0007/0009): corpus, mcp-tools, webmcp-tools, hero-bridge, fit-prompt
src/styles/       # globals.css — Tailwind v4 @theme tokens = the entire visual identity
```

## 4. Architecture — One-Liner

Statically prerendered Next.js (App Router, RSC, no client JS on content pages) + typed
markdown content pipeline + one hand-written canvas quantum simulator. No CMS, no UI kit.

## 5. Non-Negotiable Rules

1. **Lighthouse ≥ 95 all categories** (A11y/SEO/BP = 100). Never merge a change that drops it.
2. **Per-route JS budgets (gz first-load), enforced by `scripts/check-budgets.mjs` in CI:**
   content routes ≤ 200 kB (measured 194 kB baseline) · `/learn` ≤ 350 kB (carries the
   WebGL stage — ADR-0006) · `/learn`'s LCP element must be server-rendered text.
   **CLS = 0 everywhere. LCP < 1 s on desktop.**
3. **No new runtime dependency without an ADR.**
4. Site copy comes **only** from `content/*.md` — never hardcode prose in components.
5. three.js/R3F allowed **only** under `src/app/learn/**` + `src/components/quantum/three/**`
   (ADR-0006); every other page stays WebGL-free. No UI kits, no ambient particle
   backgrounds. Every 3D scene reads physics exclusively from `statevector.ts` and ships
   reduced-motion + no-WebGL static fallbacks. Animated set-pieces pause off-screen.
6. kebab-case for all files and docs. ADRs are immutable once accepted — supersede, don't edit.
7. Every doc in `docs/` carries YAML frontmatter (`title,type,status,owner,created,last-reviewed,tags,related`).
8. TypeScript strict; no `any` without an inline justification comment.
9. The quantum sim (`src/components/quantum/statevector.ts`) stays dependency-free and unit-tested.
   Likewise WebMCP tool definitions stay in the pure unit-tested module
   `src/lib/agent/webmcp-tools.ts` — the React provider only mounts them (ADR-0009).
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
| Hero | Hand-written 2D canvas + pure-TS 2-qubit statevector sim — ADR-0004/0006 |
| /learn | r3f + drei + postprocessing, route-scoped WebGL scrollytelling — ADR-0006 |
| Agent surfaces | MCP server + WebMCP (Chrome OT) + A2A card + fit API, one tool layer — ADR-0007/0009 |
| Theme | next-themes, dark default |
| Fonts | STIX Two Text · IBM Plex Sans · IBM Plex Mono via `next/font` |
| Tests | Vitest |
| Hosting | Vercel + Web Analytics — ADR-0005 |

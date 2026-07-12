# agentify — extraction spec (build plan for Opus)

This is the precise plan to lift the agent layer out of this portfolio into a
reusable, MIT-licensed package + Claude skill. Everything referenced already
exists and is unit-tested in `src/lib/agent/`.

## The core realization

The agent layer is **already content-agnostic in shape** — it just imports a
site-specific loader directly. Three files do the real work:

| File | ~LOC | What it is | Person-specific? |
|---|---|---|---|
| `src/lib/agent/corpus.ts` | 118 | Assembles a plain-text corpus + compact chat profile from content | Only via `getAbout/getProjects/...` imports |
| `src/lib/agent/mcp-tools.ts` | 85 | `TOOLS` descriptors + `callTool()` dispatch | Only via loader + `SITE_URL/LINKS` |
| `src/lib/agent/fit-prompt.ts` | 49 | Brief validation + grounded, honesty-enforcing fit prompt | **Fully generic already** |

`fit-prompt.ts` is the proof the design generalizes: it takes `corpus` as a
parameter and hardcodes nothing about Ammar except the name in one string. Make
the name a parameter and it's a library function verbatim.

## Step 1 — define the `ContentSource` interface

The single seam. Everything person-specific hides behind this; everything else
becomes generic.

```ts
// packages/agentify-core/src/content-source.ts
export interface Identity {
  name: string;
  headline: string;         // "Backend & AI Systems Engineer"
  siteUrl: string;
  links: { github?: string; linkedin?: string; email?: string };
  education?: string[];
}
export interface ProjectRec {
  title: string; slug: string; category: string; date: string;
  summary: string; problem?: string; approach?: string; impact?: string;
  techStack?: string; tags: string[]; github?: string; live?: string;
}
export interface PaperRec {
  title: string; slug: string; kind: string; venue?: string; year?: number;
  authors: string[]; supervisor?: string;
  abstract: string; method?: string; results?: string; plainWords?: string;
  lookingBack?: string; bibtex?: string; pdfUrl?: string | null;
}
export interface SkillGroup { group: string; body: string }
export interface Stat { value: string; label: string }

export interface ContentSource {
  identity(): Promise<Identity>;
  projects(): Promise<ProjectRec[]>;
  papers(): Promise<PaperRec[]>;
  skills(): Promise<SkillGroup[]>;
  stats(): Promise<Stat[]>;
  experience(): Promise<{ heading: string; meta: string; body: string }[]>;
  lessons?(): Promise<{ order: number; title: string; slug: string; hook?: string }[]>;
}
```

## Step 2 — generalize the three core modules

- **`corpus.ts` → `buildCorpus(src: ContentSource)` / `buildChatProfile(src)`.**
  Mechanical: replace each `getX()` call with `src.x()`; replace `SITE_URL`/`LINKS`
  with `identity()`. The `strip()` helper and section layout stay as-is.
- **`mcp-tools.ts` → `makeTools(src: ContentSource)`** returning `{ TOOLS, callTool }`.
  Drop the site-specific `compose_circuit` tool into an optional "extras" array
  the caller can pass in (keeps the quantum bit as a plugin, not core).
- **`fit-prompt.ts`** — add a `name` param to `buildFitSystemPrompt`; otherwise ship
  verbatim, including the four-section format and the "gaps never empty" rule.
  This honesty contract is the product's whole differentiation — do not water it down.

## Step 3 — surface generators

```
buildAgentCard(src)   -> .well-known/agent-card.json   (A2A schema)
buildLlmsTxt(src)     -> llms.txt (index) + llms-full.txt (buildCorpus output)
mcpHandler(src)       -> JSON-RPC POST handler (framework-agnostic core)
fitHandler(src, llm)  -> POST { brief, audience } -> grounded markdown report
```

Model the JSON-RPC handler and the static-file emitters on the existing
`src/app/api/mcp/route.ts`, `src/app/llms.txt`, `src/app/.well-known/agent-card.json`.

## Step 4 — adapters

- **`@agentify/next`** — thin: exports route handlers + a `generateStaticFiles()`
  for the App Router. This repo *is* the reference adapter; port it.
- **`@agentify/markdown`** — a `ContentSource` over a `content/*.md` tree
  (reuse the gray-matter + zod + unified approach in `src/lib/content/`).
- **`@agentify/json-resume`** — a `ContentSource` over the JSON Resume schema, so
  anyone with a `resume.json` gets surfaces for free (widest reach).

## Step 5 — the Claude skill

`SKILL.md` (in this folder) is the runtime. The skill's job at invocation:
detect the content source → pick/generate the adapter → run the surface
generators into the detected framework → verify. Ship `SKILL.md` +
`packages/agentify-core` in one repo; the skill references the package.

## Step 6 — packaging & license

- Monorepo: `packages/agentify-core`, `packages/agentify-next`,
  `packages/agentify-markdown`, `packages/agentify-json-resume`, `skill/`.
- **MIT.** Port the existing Vitest suites (`corpus`, `mcp-tools`, `fit-prompt`
  tests already exist) as the package's test baseline — they transfer almost
  directly and make the repo credible from commit one.
- New runtime deps in *this* portfolio still require an ADR (contract rule 3);
  the extracted package is a separate repo and not bound by that.

## What stays behind (the paid moat, not open-sourced)

- Hosted managed MCP endpoint.
- **Agent analytics** — logging which agents hit the surfaces and what they
  asked (needs storage + a dashboard; model this on the existing `/api/beacon`).
- The strong-model intelligence tier for fit / roast / interview.

## Effort estimate

Core extraction + Next adapter + markdown adapter: ~1–2 focused days for a
capable coding model, because the logic already exists and is tested. JSON
Resume adapter + skill polish: +1 day. Hosted layer is a separate project.

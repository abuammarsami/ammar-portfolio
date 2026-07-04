# AGENTS.md

Guide for AI agents working with this repository or consuming the deployed site.

## The site is agent-operable

- `/llms.txt` — index for LLM crawlers · `/llms-full.txt` — full corpus
- `/resume.json` — JSON Resume schema · `/resume.pdf`
- `/api/mcp` — MCP server (streamable HTTP JSON-RPC): `get_resume`,
  `list_projects`, `search_publications`, `get_lessons`, `contact`
- `/api/chat` — grounded "Ask Ammar" endpoint (also surfaced as `ask <q>` in
  the site's terminal footer and ⌘K palette)

All three surfaces read one tool layer: `src/lib/agent/` (ADR-0007).

## Working on this repo

Read `CLAUDE.md` first (agent contract: budgets, rules, naming). Key rules:
content only from `content/*.md`; no new runtime dependency without an ADR;
WebGL only under `src/app/learn` + `src/components/quantum/three` (ADR-0006);
`statevector.ts` is the sole quantum-physics source and must stay
dependency-free and unit-tested.

```bash
npm run dev · npm test · npm run typecheck · npm run lint · npm run build
node scripts/check-budgets.mjs   # per-route JS budgets (CI gate)
```

Docs live in `docs/` (ADRs are immutable — supersede, don't edit).

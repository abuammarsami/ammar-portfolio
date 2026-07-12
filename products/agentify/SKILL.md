---
name: agentify
description: >
  Make any personal site, portfolio, or professional profile operable by AI
  agents. Generates an MCP server, an A2A agent card, llms.txt / llms-full.txt,
  and a grounded "fit report" endpoint from the user's existing content
  (markdown, JSON Resume, or a repo). Trigger when the user wants their site to
  be readable/callable by AI agents, wants an MCP server for their portfolio,
  asks to "make my site agent-operable / agent-readable", or is preparing for a
  job/grad-school search where AI screeners will read them first.
metadata:
  type: product-skill
  version: 0.1.0-draft
  author: Md. Abu Ammar
  license: MIT (intended)
  status: implemented — open-source core built at ~/workspace/agentify (commit 4009745, 36 tests). This file is the guiding spec.
---

# agentify — make yourself operable by AI agents

## What this skill does

Turns a professional's existing content into a set of machine interfaces so that
AI agents (recruiter copilots, screening models, research assistants) can query
and verify them instead of guessing from a PDF or scraping HTML.

From one **content source**, it emits four surfaces:

1. **MCP server** — a JSON-RPC endpoint exposing tools like `get_resume`,
   `list_projects`, `search_publications`, `get_paper`, `contact`. An agent calls
   these and gets structured answers.
2. **A2A agent card** — `/.well-known/agent-card.json`, the discovery handshake
   that tells other agents what this one can do.
3. **Agent-readable feeds** — `llms.txt` (index) and `llms-full.txt` (the full
   grounded corpus), the emerging convention for "here is me, in plain text, for
   a model."
4. **Fit report endpoint** — paste a job description or research brief; returns a
   grounded markdown report: requirement-by-requirement evidence *with citations
   to real pages*, a **mandatory honest-gaps section**, and a verdict. Never
   invents projects, numbers, or skills.

## The non-negotiable: honesty is the contract

An agent is not a human skimmer — it can be *audited against*. So every surface
this skill generates enforces grounding:

- Claims must cite a real source path. No citation → not a "strong" claim.
- The fit report's gaps section is **required and may not be empty** unless the
  fit is genuinely perfect. Absence of evidence is a gap, stated plainly.
- Numbers should carry provenance (ideally the commit/date they were measured at).

This is not moralizing — it's what makes the output trustworthy to the machine
reader that now screens first. A profile caught hiding a negative result is
trusted on nothing else.

## How to run it

1. **Locate the content source.** In priority order: an existing
   `content/*.md` tree, a `resume.json` (JSON Resume schema), a `README`/repo, or
   an interview with the user. Confirm what's found before generating.
2. **Build the content adapter.** Implement the `ContentSource` interface (see
   `extraction-spec.md`) over whatever was found. This is the only
   person-specific code; everything downstream is generic.
3. **Generate the four surfaces** into the detected framework (Next.js App
   Router adapter first-class; a static-emit mode for everything else).
4. **Wire the fit endpoint** to a model provider (env-configured; default to a
   strong model — grounding quality degrades badly on weak ones).
5. **Verify.** Call each MCP tool; validate the agent card against the A2A
   schema; run the fit endpoint against a sample JD and confirm the gaps section
   is non-empty and every "strong" claim cites a path.

## Framework support

- **Next.js (App Router)** — first-class: emits route handlers for
  `/api/mcp`, `/api/fit`, and static `llms.txt` / `.well-known/agent-card.json`.
- **Static / any host** — emits plain files + a portable MCP server (Node) the
  user can deploy anywhere.

## Guardrails

- Never fabricate. If the content source lacks evidence for a claim, the correct
  output is a gap, not a guess.
- Do not overwrite existing routes without confirmation.
- Keep generated client-side JS at zero on content surfaces — the agent layer is
  server/edge endpoints and static files, not a bundle.
- Ask before wiring a paid model provider or committing secrets.

## Open-core boundary

This skill (scaffolding + the four open surfaces) is meant to be **MIT / free**.
The hosted layer it can optionally point at — managed MCP endpoint, *agent
analytics* (which agents queried you, what they asked), and the strong-model
intelligence tier — is the paid product. The skill works fully standalone
without it.

## Reference implementation

The surfaces above are extracted from a live site
(`github.com/abuammarsami` — the portfolio's `src/lib/agent/`). See
`extraction-spec.md` in this folder for the exact modules and the generalization
plan.

# agentify

**Make yourself operable by AI agents.**

The résumé was built for a human skimmer. That reader is being replaced — at the
first gate, the entity that reads you is increasingly an AI: a recruiter's
copilot, a screening model, a professor's research assistant. `agentify` turns
your existing content into the interfaces that reader needs.

From one content source (a `content/*.md` tree, a `resume.json`, or a repo) it
generates:

- an **MCP server** agents can query for structured facts,
- an **A2A agent card** for agent-to-agent discovery,
- **`llms.txt` / `llms-full.txt`** agent-readable feeds,
- a grounded **fit-report endpoint** that maps a job/research brief to real
  evidence *with citations* — and an honest-gaps section it may never leave empty.

## Why

An agent can't be charmed the way a human skimmer can — it can audit you. So
being machine-readable means being **verifiable**, which is a higher bar than
being impressive, and a better one. `agentify` bakes that honesty in: claims
cite sources, gaps are mandatory, numbers carry provenance. See the essay
[*Your Career Is About to Have an API*](../../content/essays/your-career-as-an-api.md).

## Status

`0.1.0-draft` — spec stage. The four surfaces run in production on the reference
site (this repo's `src/lib/agent/`); this folder is the plan to extract them into
a standalone MIT package + Claude skill.

- [`SKILL.md`](SKILL.md) — the Claude skill (runtime behavior + guardrails).
- [`extraction-spec.md`](extraction-spec.md) — the build plan: interfaces,
  module-by-module generalization, packaging.

## Open-core

The scaffolding and the four surfaces are free (MIT). The optional hosted layer —
managed MCP endpoint, **agent analytics** (which agents queried you, what they
asked), and the strong-model intelligence tier — is the paid product. The skill
works fully standalone without it.

## Reference implementation

`github.com/abuammarsami` — a live portfolio that is itself agent-operable.
Point an MCP client at its `/api/mcp`, or read its `/llms.txt`.

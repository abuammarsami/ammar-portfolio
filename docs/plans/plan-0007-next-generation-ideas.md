---
title: "Plan 0007: Next-Generation Ideas — frontier AI features & intelligence-moat revenue"
type: plan
status: draft
owner: Md. Abu Ammar
created: 2026-07-06
last-reviewed: 2026-07-06
tags: [plan, ai, product, revenue, ideas]
related:
  - plan-0004-agent-operable-site.md
  - plan-0005-living-portfolio.md
  - ../guides/pending-user-actions.md
---

# Next-generation ideas

Two buckets. **Bucket A** is mechanical build work — a strong coding model
(Opus) can execute each from the spec below; no frontier reasoning required at
runtime. **Bucket B** is where the *quality of a frontier model's reasoning is
the product itself* — a cheaper model running the same feature produces visibly
worse output, so the model is the moat, not the plumbing.

Nothing here is committed. This is an idea backlog to pull from.

---

## Bucket A — buildable now (hand to Opus with this spec)

### A1. Free custom domain (10-minute unblock)
Claim the GitHub Student Pack free domain (Namecheap `.me` / `.TECH`). Set
`NEXT_PUBLIC_SITE_URL`, redeploy, run `docs/guides/launch-checklist.md`. Lights
up all already-built canonical/SEO/Scholar work for $0. **Do this first.**

### A2. Live Azure backend demo (flagship build)
Deploy one small real **.NET microservice on Azure Container Apps** ($100
Student credit; KioskVisionAI is already Aspire). Wire into the portfolio as:
- a live demo panel (visitor hits a real endpoint, gets real data);
- a self-updating telemetry strip (p50/p99, uptime, error rate) — Datadog Pro
  (2yr free) or Sentry, both in the pack;
- an **MCP tool** so a recruiter's agent can call the running production
  service. Turns "case study" into "here is the system, running now."
Keeps client-JS budget at zero (separate backend). New deps → ADR per contract.

### A3. Template product + checkout
Package the site as a paid premium template ("agent-operable
research/engineering portfolio" — a category with no competitor). Wire
**Stripe** (Student Pack waives fees on first $1,000) + the existing waitlist
into real checkout. Price $39–79.

### A4. Consulting funnel
`/hire` currently dead-ends at a mailto. Add Calendly + a Stripe deposit link
for a paid ".NET / AI-integration architecture audit." A2 is the proof that
closes it.

### A5. Real datastore + notifications
MongoDB Atlas / Neon (pack) for guestbook, fit-reports, agent-changelog data.
Twilio/SendGrid (pack) for contact + "someone hired me" alerts.

### Student-pack asset map
Free domain → A1 · Azure $100 → A2 · Datadog/Sentry → A2 telemetry · Stripe
fee waiver → A3/A4 · MongoDB/Neon → A5 · Twilio/SendGrid → A5 · Figma Pro →
design system · Copilot/JetBrains/Frontend Masters → own velocity.

---

## Bucket B — intelligence is the moat (frontier-model features)

Test for inclusion: *would this be embarrassing if a weak model produced it?*
If yes, the model quality is the product.

### B1. Adversarial candidacy red-team ("Roast me")
The twin plays a **skeptical staff engineer / PhD admissions committee**,
generates the hardest possible questions about *his specific* work, answers
them citing real artifacts, **and honestly names where the profile is weak**.
Weak models flatter; a frontier model does genuine adversarial critique + honest
gap analysis. This is both a site feature and the seed of B-revenue item R1.

### B2. Live "prove it" challenges
Visitor names any skill/claim ("can he design a rate limiter?"). The twin
generates a bespoke, correct, grounded mini-demonstration *on the spot* — tied
to his real architecture (e.g. KioskVisionAI's queue fan-out), with tradeoffs.
The scarce good is correct reasoning under an open prompt, not retrieval.

### B3. Proof-carrying claims
Every headline claim links to a frontier-model-generated verification that
re-derives, from his actual code/data, *why* the claim holds — auditable by a
skeptical human or their agent. An honesty/trust moat only high-quality
reasoning can hold without hallucinating. Extends the colophon "receipts" ethos
from build stats → verifiable claims.

### B4. Research-collaborator mode (professor audience)
Given the QML thesis, the model proposes **genuinely novel, non-obvious research
directions** connecting his quanvolution work to open problems — at a level
useful to a professor actually reading it. Signals "thinks like a researcher,"
which requires research taste, not lookup.

### B5. Socratic thesis defense
The site defends his thesis under qualifying-exam-depth questioning. Professor
asks a hard follow-up; the twin holds the argument, concedes what's genuinely
open. Only credible with strong reasoning.

### B6. Self-writing, honest case studies
The model periodically re-reads his real GitHub commits/repos and *writes* the
case study — keeping it current and, crucially, **honest** (distilling messy
commits into an accurate narrative without overclaiming). "My portfolio writes
itself from my actual work, verifiably."

### B7. The portfolio that interviews the visitor back
Short intelligent conversation to infer what the visitor needs, then
dynamically assembles the most relevant narrative. Real conversational
reasoning, not a form.

### B8. The synthesis manifesto (inbound driver)
One essay / interactive artifact only *he + a frontier model* could produce:
coherently connecting quantum ML, backend distributed systems, and AI agents
into a worldview. The intellectual synthesis is the scarce good; a strong
manifesto gets shared and drives inbound. Lives on the site; doubles as R-items.

---

## Bucket B → revenue (model quality = the product)

- **R1. Portfolio Doctor (micro-SaaS).** Others paste a portfolio/resume URL →
  brutally honest, frontier-grade critique + rewrite (productized B1). Cheap
  models give generic feedback; a Fable-tier critique is worth paying for. His
  own site is the proof he gets it. Stripe fee waiver covers launch.
- **R2. Digital-twin-as-a-service.** Sell the agent-operable, *citation-grounded*
  twin to other engineers/researchers. Differentiator = grounding + honesty
  quality, which needs a strong model. Recurring revenue.
- **R3. Grad-school SOP / research-statement adversarial editor.** Niche, high
  willingness-to-pay; committee-level critique. He's credible (applying himself).
- **R4. Explainer-as-a-service.** `/learn` proves he can turn hard concepts into
  correct interactive lessons. The scarce input is the pedagogical *decomposition*
  of a hard topic — frontier territory. Sell to deep-tech companies who must
  explain their tech.

---

## Bucket C — the extractable product ("agentfolio" / open-core)

The insight: `src/lib/agent/` is **not** portfolio glue — it's a general,
content-driven *"make yourself operable by AI agents"* engine. `mcp-tools.ts`
(MCP server), `.well-known/agent-card.json` (A2A), `llms.txt` / `llms-full.txt`
(agent-readable), `fit-prompt.ts` (score-vs-JD) — all read from typed markdown.
Swap the content and it works for any engineer. **The product is already built;
it needs extracting.**

**Category / thesis:** "Agent-operable professional presence — your career as an
API." AI agents now do first-pass candidate screening; almost no one has made
their site operable by the screening agent. Early to a real, timely gap. Owning
the category is worth more to the career than the SaaS revenue.

**Open-source wedge (MIT — reach, reputation, inbound):**
- Library + Next.js adapter that generates MCP server + A2A card + `llms.txt` +
  fit endpoint from any markdown/JSON content (= today's `src/lib/agent/` with
  content abstracted out).
- A **Claude Code skill `/agentify`** that scaffolds the whole layer into any
  repo from a resume. Skills are the ideal distribution vector now — new,
  shareable, low-friction; early + useful = reputation.

**Paid hosted layer (money + moat):**
- **Managed MCP endpoint + Agent Analytics** — dashboard of *which agents
  queried you, what they asked, JD-fit questions received*. ~$5–15/mo.
  Defensible (needs hosting + data, not just code).
- **Intelligence tier** — grounded, honest, citation-backed fit / roast /
  interview endpoints on a strong model (= R1 delivered as a hosted API, not
  bolted onto one site). Weak models degrade visibly → model quality is the moat.

**Honest money reality (ranked):** reputation → jobs/consulting/inbound
(biggest, most certain) · hosted intelligence tier (real recurring, model-moated)
· analytics subscription (small, sticky) · template/skill sales (small,
immediate, Stripe-fee-waived). Direct OSS revenue is unreliable; the reputation
and hosted-intelligence paths are the ones that pay.

**First artifact:** the `/agentify` Claude skill (cheap, high-signal, is its own
demo). Then extract the library; then stand up the hosted analytics + intelligence.

**BUILT 2026-07-06 — `~/workspace/agentify` (local git repo, commit 4009745).**
The open-source core is no longer a spec: a real zero-runtime-dependency
TypeScript package. `ContentSource` seam + generalized corpus/tools/fit;
surfaces (A2A card, llms.txt/llms-full.txt); three adapters (markdown w/ a
zero-dep frontmatter parser, JSON Resume, object); a dependency-free MCP server
over stdio (initialize/tools.list/tools.call/ping); a `serve|build|corpus` CLI.
Verified end to end: drove the live MCP server through a real JSON-RPC session
(initialize → tools/list → search_publications → get_paper returned Ammar's real
grounded data).

**REVIEWED & HARDENED 2026-07-07 (commit 34f89aa).** A four-agent pre-publish
review (SWE/architecture, error handling & edge cases, logging & MCP protocol
conformance, DX/packaging) surfaced ~20 findings, all fixed: stdio single-flight
flush guard (no reorder under pipelined requests) + stream error handlers;
absolute-`siteUrl` enforcement on the discovery surfaces; quote-aware frontmatter
arrays; crash-proof, collision-free JSON-Resume slugs; JSON-RPC `-32600`/`-32602`
+ version negotiation; actionable CLI errors + real `--version`; extras
name-collision guard; subpath exports. Tests 36 → **47 pass**, typecheck/build
clean, `npm pack` = 33 kB (dist + docs only). Still publish-ready.

REMAINING (needs user accounts): `git remote` + `npm publish`; the
`@agentify/next` adapter; the paid hosted layer (managed MCP + agent analytics +
strong-model intelligence tier). The `products/agentify/*` files in THIS repo are
the original spec that guided the build.

**Original draft (2026-07-06, superseded by the build above):**
- `products/agentify/SKILL.md` — the publishable Claude skill (runtime + guardrails).
- `products/agentify/extraction-spec.md` — module-by-module build plan (the
  `ContentSource` seam; generalizing `corpus.ts`/`mcp-tools.ts`/`fit-prompt.ts`;
  packaging; the paid-moat boundary). ~1–2 days of coding-model work.
- `products/agentify/README.md` — product positioning / open-core boundary.
- `content/essays/your-career-as-an-api.md` — the category manifesto (B8), doubles
  as site essay + skill launch post. **Route not yet wired** (`/essays/[slug]` or a
  long-form `/writing` entry); once wired, add a link row to `content/writing.md`.

---

## Suggested sequencing
A1 (free, unblocks) → B8 manifesto or B1 red-team (cheap, high-signal, on-site
proof) → **C: publish `/agentify` skill (category wedge + reputation)** →
A2 flagship backend → productize the winner (hosted intelligence / R1 / R4).

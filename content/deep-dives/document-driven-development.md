---
title: "Document-Driven Development (D³): Docs Are the Interface Your AI Works Through"
summary: "Docs-as-Context Engineering — a document-type-partitioned, frontmatter-governed engineering wiki wired straight into your AI agents, so business rules, architectural decisions, and every fixed bug become durable context instead of tribal memory that evaporates between sessions."
readingMinutes: 14
date: 2026-07
tags: [ai-tooling, developer-productivity, documentation, context-engineering, claude-code, dotnet]
featured: true
status: active
---

An AI agent is only as good as the context you hand it. Give it the right business rule, the right decision record, the right note about the bug someone already fixed, and it writes code like it's been on the team for a year. Give it nothing, and it writes plausible, confident, wrong code — because it's guessing, and it has no way to know it's guessing.

Here's the uncomfortable part: most teams hand their agents *nothing durable*. The knowledge that actually governs the system — why payment doesn't equal activation, why that slug needs a trailing hyphen, why you never use `Clients.All` in SignalR — lives in exactly one person's head. It comes out in a Slack thread, gets acted on, and evaporates. The next session, human or AI, starts cold. Every hard-won lesson gets re-learned, re-argued, re-broken.

The usual reaction is "we should write more docs." That's not wrong, but it misses the point badly enough to guarantee the docs rot in a wiki nobody opens. The reframe that actually changed how I build:

**Documentation isn't a byproduct of the work — it's the interface your AI works through.** Your docs are the API surface your agent develops against. Every rule, decision, and postmortem is a durable context object the agent loads on demand. Once you believe that, you stop writing docs *for the human who might read them someday* and start writing them *for the agent that will read them on the next task* — and everything about how you structure, name, and wire them changes.

I've been running this on [Partners.com.bd](https://partners.com.bd) — a live marketplace-plus-business-social platform (a .NET 10 modular monolith, five ad categories, three consumer segments, mid-migration off a legacy MVC app) — for months. I call it Document-Driven Development, D³ for short. The superscript disambiguates it from Domain-Driven Design, which I lean on separately and affectionately call "DDD-lite." This is the whole methodology.

## The reframe in one line

Docs are the interface. That's it. That's the spine of everything below.

Not "docs describe the interface." Not "docs document the interface." The corpus of documents *is* the surface your agent programs against — the place it reads its constraints from before it writes a line, and the place it writes new constraints back to when it learns something. If your architecture decisions, domain rules, and bug history aren't reachable by the agent at the moment it needs them, they don't exist as far as the work is concerned.

![Docs as the interface — one document corpus reaches the agent through a layered contract: a router CLAUDE.md that links into docs/, module files that auto-load per subtree, a graphify knowledge graph queried instead of grep, and .remember for session continuity.](/figures/d3-consumption.svg)

The rest of this is how I make that literally true: how the corpus is organized so every fact has one home, how it's wired so the right document lands in the agent's context at the right moment, and the loop that keeps it fed instead of letting it rot.

## One home per fact: the taxonomy

The first failure mode of "just write docs" is that facts scatter. The same rule ends up half-stated in a wiki page, contradicted in a Slack pin, and re-derived in a code comment. An agent grepping for the truth finds three versions and picks the wrong one.

So the corpus is partitioned by *document type*, not by feature. From `docs/README.md`, the entrypoint every agent reads first:

> Every doc lives in one of six top-level folders, organized by **document type** (not by feature module — feature grouping happens *inside* `plans/` and `reference/` where useful).

Six buckets, and the decision of where a thing goes is mechanical:

```
docs/
├── architecture/   ← system design + immutable ADRs (adr-NNNN)
├── plans/          ← feature/initiative designs, one folder per plan
├── runbooks/       ← on-call / operational procedures
├── guides/         ← developer how-tos and onboarding
├── reference/      ← audits, incident post-mortems, business rules, enums
└── legacy/         ← how the retired MVC system worked (migration context)
```

A decision becomes an ADR. A future design becomes a plan. A shipped bug becomes a dated audit. A domain fact becomes a business rule. There is exactly one correct destination for any unit of knowledge, and the taxonomy tells you which — so the agent (and I) never has to wonder "where would I have written this down?"

![The taxonomy — every unit of knowledge has exactly one home, decided by what kind of document it is: a decision becomes an ADR, a future design becomes a plan, a shipped bug becomes a dated audit, a domain fact becomes a business rule.](/figures/d3-taxonomy.svg)

Two rails keep the partition honest. Every doc opens with **frontmatter** — a typed header the agent can filter on:

```yaml
---
title: <Title shown at top of doc>
type: plan | adr | runbook | guide | reference | architecture | legacy
status: draft | in-review | active | implemented | deprecated
owner: <person or team>
created: YYYY-MM-DD
last-reviewed: YYYY-MM-DD
supersedes: <relative path or null>
superseded-by: <relative path or null>
---
```

The `status` field rides a lifecycle — `draft → in-review → active → implemented → deprecated` — so `grep -l "status: active" docs/plans/` returns every in-flight initiative in one shot. `last-reviewed` flags stale docs; `supersedes`/`superseded-by` keep decision history linked instead of overwritten. That last pair is why ADRs are **immutable** — you don't edit a shipped decision, you write a new one that supersedes it, and the chain of *why we changed our mind* stays intact for the agent to walk.

And every folder carries a `README.md` with a live contents table — title, status, owner, last-reviewed — so the taxonomy is self-describing. An agent that opens `docs/reference/audits/README.md` gets a dated index of every audit before it reads a single one. The corpus documents its own shape.

## Docs are a deliverable, not an afterthought

Structure is worthless if the corpus lags the code. A doc that describes last month's system is worse than no doc — it's *confidently* wrong, and the agent trusts it. So the discipline that makes D³ actually hold is a hard rule, rule #14 in the root agent contract:

> **No undocumented work** — every feature, migration, or cross-layer change ships its documentation in the **same change set** [...] Docs are a deliverable, not an afterthought.

Same change set. Not a follow-up ticket, not a "docs sprint" that never comes. The PR that changes behavior changes the docs that describe that behavior, or it isn't done. This is the single highest-leverage rule in the whole system, because it's the one that keeps the interface synchronized with the implementation it's supposed to describe.

For anything non-trivial, the doc comes *first*. The clearest proof sits in `docs/plans/api/idempotency/` — a full implementation design for idempotency across 13 high-risk write endpoints (ad-create, bKash init/execute, membership upgrade), written and approved, then deliberately parked:

> **⚠ STATUS: Implementation on hold as of 2026-05-17.** Design + ADR are complete and approved; the actual code work (server + mobile) is deferred until other priorities clear. Resume by re-reading this doc + ADR-0008 and starting with §5 (SQL schema), then §6 (C# components), then §7 (mobile).

Read that resume instruction again. It's a doc written to be *executed by an agent later* — SQL schema first, then the C# pipeline behavior, then the mobile key-minting. The design isn't a description of code that exists; it's the context an agent will load to *write* the code that doesn't yet. That's document-first development in its purest form: the plan is the program, and the agent is the runtime.

The background-jobs system landed the same way. The design doc and ADR-0016 (Hangfire) went into git a full day *before* the phased implementation — the decision record predates the code it decides. When the build started, the agent wasn't reasoning from scratch; it was executing an approved design it could re-read at any point.

## The wiring that makes docs an interface

Here's the crux, and the part almost everyone skips. A well-organized corpus that the agent doesn't *automatically consume* is just a nicer wiki. The word "interface" is load-bearing: the docs have to reach the agent's context at the right moment, without me pasting them in by hand. That's a wiring problem, and the repo solves it in five layers.

**The router CLAUDE.md.** The root `CLAUDE.md` is deliberately a short **238-line router**, not an encyclopedia. It states the non-negotiable rules and the architecture in one screen, then *links out* to `docs/` for everything long-form. It's always loaded, every turn, so it stays lean — the detail lives one hop away, loaded only when relevant. (I wrote a whole separate piece on why a bloated CLAUDE.md is an anchor; the router pattern is the fix.)

**Module CLAUDE.md files that auto-load per subtree.** Six nested contracts — one each under `Partners.Domain`, `Partners.Application`, `Partners.Infrastructure`, `Partners.Api`, `tests/`, and `database/`. Claude Code loads a nested `CLAUDE.md` only when it's working inside that subtree. Edit a repository and the Dapper-and-stored-procedure rules arrive automatically; edit the domain layer and the "no persistence, no DI" rules arrive instead. The right constraints show up exactly where they bind, and nowhere they don't.

**Cross-tool siblings.** `AGENTS.md` mirrors the contract for tools that read that convention instead; `.cursor/rules/*.mdc` (numbered `01-project-overview` through `07-progress`) carries the same rules into Cursor. One set of facts, several front doors, so the interface doesn't depend on which agent you happen to be driving.

**The graphify knowledge graph.** The repo commits a queryable knowledge graph at `graphify-out/`, and the contract tells the agent to reach for it first:

> For codebase questions, **prefer the graph over grep** — it returns a scoped subgraph instead of raw text matches.

`graphify query "what connects X to Y?"` returns a focused subgraph — relationships, call paths, concept neighborhoods — instead of a wall of text hits. And it's enforced, not merely suggested: a **PreToolUse hook** in `.claude/settings.json` intercepts `grep`/`find`/`rg`/`fd` commands and, when `graphify-out/graph.json` exists, injects a nudge telling the agent to run a graph query instead. The hook literally sits between the agent and the blunt-instrument search, steering it toward the structured interface. That's docs-as-interface made mechanical — the agent can't fall back to grepping raw files without the graph tapping it on the shoulder.

**`.remember/` for session continuity.** A committed worklog — `now.md`, `recent.md`, dated `today-YYYY-MM-DD.done.md` files — that survives across sessions. When a session ends mid-thought, the next one primes from `.remember` and picks up the thread instead of cold-starting. It's the short-term memory that complements the long-term corpus.

Each layer delivers a *different slice* of the corpus at a *different moment*: the router every turn, the module rules on subtree entry, the graph on a relationship question, `.remember` on session start. Stack them and the documents stop being something the agent *might* consult and become something it *reads through* to see the codebase at all. That's the thesis stated as plumbing.

## Every bug is a permanent artifact

Nowhere does D³ pay off harder than bugs, because a bug is a lesson the system is trying to teach you, and most teams throw the lesson away the moment the fix ships. In this repo, a fixed bug becomes a durable artifact in one of two lanes.

`docs/reference/audits/` holds dated, **immutable** hotfix records. The rule, from the audits README:

> Each audit is dated and immutable — when something gets re-audited, write a new file rather than editing the old one. The history shows progress.

The worked example I point everyone to is `2026-06-08-mobile-ad-routepath-missing-hyphen-fix.md`. Ads posted from the mobile/API flow wouldn't open their detail page in `dev`, and only in `dev`. The audit captures the reported symptom *verbatim* — the actual words, not a sanitized paraphrase:

> "for any new posted from mobile don't show the ad details due to the end hyphen missing before all post id."

Then it diagnoses to the exact line. The public slug is built in two steps: create stores a base `RoutePath`, and approval appends the new id with `CONCAT(@RoutePath, @AllPostId)`. That append assumes the base slug *already ends in a hyphen*. The legacy web path honored it (`VehicleRepository.cs:389` builds the slug with a trailing `-`); the five new SQL create SPs didn't. So `…-mirpur-` + `123` gave a clean `…-mirpur-123`, but `…-mirpur` + `123` fused into `…-mirpur123`, and the detail resolver — which grabs the id by reading everything after the last hyphen — cast `mirpur123` to `INT`, failed, and returned no row. Dev-only because dev ads flow through the new SPs; production ads came from the legacy path that already carried the hyphen.

The fix was to add the trailing `-` to the five create SPs. But the audit is careful about what it *didn't* touch:

> `ApprovePost` and the legacy web path were intentionally **not** touched — the legacy create flow is still active [...] so changing the shared approval SP would risk double-hyphenating legacy slugs.

That "what was deliberately NOT touched" section is the part that makes the audit worth its weight. It's the reasoning an agent needs six months later to avoid re-opening the wound from the other side. And the doc closes with numbered verification steps — apply, post from mobile, confirm the slug ends `-{id}`, re-run the idempotent backfill for 0 rows. Anatomy complete: verbatim symptom → root cause at `file:line` → fix plus the blast radius you avoided → how to prove it.

The second lane, `docs/reference/incidents/`, is for post-mortems, and it runs on a fixed template — Summary → Timeline → Root cause → Contributing factors → What we changed → *What we considered and didn't change*. Same discipline: the road not taken is documented, not just the fix.

Some of these artifacts exonerate the code entirely, which is its own kind of durable value. The bKash sandbox audit (`2026-06-28`, verdict updated `2026-06-29`) reproduced a live "Invalid page access request" and pinned it on two independent causes — both on bKash's side, neither a bug in our code. The primary, day-to-day driver is an intermittent bKash sandbox outage: during a failing window even a brand-new, first-access payment URL errors, and — the decisive tell — bKash's *own* merchant demo fails identically in the same minute. The secondary cause is that the checkout URL is single-use: a refresh, a back-button, or a mobile WebView double-load re-hits a consumed URL and triggers the same error. That's a fact worth a permanent home, because without it the next person to see that error burns a day chasing a bug that was never in our system.

The payoff of both lanes is one line: **nothing is learned twice.** Every bug that cost real hours becomes context the agent loads before it touches that area again.

## The business model is documentation too

The most valuable context isn't architectural — it's the domain rules that don't live anywhere in the code, or live scattered across a legacy system you're actively retiring. On a rebuild, those rules *are* the spec, and if the agent can't see them it will faithfully rebuild the wrong behavior.

So `docs/reference/business-rules/` extracts the legacy logic into source-of-truth docs, cited to `file:line`, written to survive the code they describe. The membership rules doc states the one thing that, if you get it wrong, corrupts the entire revenue model:

> **Payment ≠ activation: the tier is granted by admin approval, not by paying.**

A General User picks a tier, fills a shop profile, and pays — and that creates a *pending request*, nothing more. Only an admin's approval sets `AspNetUsers.MasterMemberShipId` and makes the tier live. An agent that never read this would wire "payment succeeds → tier active" without blinking, because that's the obvious design — and it would be exactly, expensively wrong. The doc exists so the obvious-but-wrong path is closed before it's ever written.

The promotions doc does the same for a counterintuitive rule that reads like a bug until you know it's intentional:

> **Any authenticated user can boost ANY active ad** — not only their own. There is **no ownership check** at any layer.

It then proves it across both stacks — the legacy flow never gates the boost behind ownership at all, and the new stack resolves the ad by category and post id and uses the caller's id only as the *payer*, never as an owner match. Without that doc, a well-meaning agent "fixes" the missing ownership check and quietly breaks a feature the business depends on. With it, the surprising behavior is documented as deliberate, cited to `file:line`, and the agent leaves it alone.

This is the whole thesis applied to the domain: the business rules are context objects. Extract them once, cite them to the source, and every future rebuild slice reads its spec from the doc instead of re-reverse-engineering a legacy controller.

## The loop

Put together, D³ is a loop — the same shape for a feature and for a bug.

**For a new feature:**

1. **Prime** — read the router `CLAUDE.md`, the relevant `docs/`, and `.remember/now.md`. Load the context before writing anything.
2. **Design first** — for anything non-trivial, write the plan (and an ADR if it's a real decision) *before* the code. The idempotency plan is the model.
3. **Build in slices** — vertical slices, per the architecture, executing against the design.
4. **Ship docs in the same change set** — rule #14. The PR carries the doc updates or it isn't done.
5. **Refresh the graph** — `graphify update .` so the knowledge graph reflects reality.
6. **Save the session** — write `.remember` so the next session resumes warm.

**For a bug:**

1. **Reproduce** — capture the symptom verbatim, in the reporter's words.
2. **Diagnose to root cause** — trace to `file:line`, not a plausible guess.
3. **File a dated, immutable audit** — symptom, root cause, fix, what you deliberately didn't touch, numbered verification. Never edit an old one; write a new one.

![The loop — prime from the docs before you build, write the design first for anything non-trivial, ship the docs in the same changeset as the code, and turn every bug into a dated, immutable audit. Nothing is learned twice.](/figures/d3-loop.svg)

The loop is self-reinforcing. Every pass through it leaves the corpus richer than it found it, which makes the *next* prime step better, which makes the next build sharper. The docs compound.

## Make it a habit

You can adopt this incrementally, and you should — it's a set of habits, not a big-bang migration.

- **Partition by type.** Stand up the six buckets — `architecture/`, `plans/`, `runbooks/`, `guides/`, `reference/`, `legacy/`. Decide a doc's home by *what kind of document it is*, never by feature.
- **Frontmatter plus status.** Every doc opens with the typed header and rides the `draft → … → deprecated` lifecycle. This is what makes the corpus queryable.
- **One README per folder.** A live contents table so the taxonomy describes itself.
- **Wire the router.** A short root `CLAUDE.md` that links into `docs/`; nested files per module; then layer in the graph and `.remember` as you go.
- **Make "no undocumented work" a rule.** The change set that changes behavior changes the docs. This is the keystone — without it the rest slowly rots.

The loop is now packaged as a Claude Code skill so it stays effortless: `/d3:d3 prime` pulls the right docs into context before you build, and `/d3:d3 capture` files a new rule, decision, or bug into its canonical home. (Installed as a plugin, Claude Code namespaces the skill by plugin name, so it's `/d3:d3`; add it as a plain personal or project skill instead and the bare `/d3` works.) The corpus stays fed and current without me remembering to feed it — the habit is enforced by tooling instead of willpower.

```
/d3:d3 prime      # load router + relevant docs/ + .remember before building
/d3:d3 capture    # file a new rule / ADR / audit in its one correct home
```

It's open source and repo-agnostic — it discovers whatever `docs/` taxonomy a repo already has, so it runs the same across my .NET backend, my Flutter app, and the legacy MVC project. Install it in any Claude Code session:

```
/plugin marketplace add abuammarsami/d3
/plugin install d3@ammar-skills
```

The [source is on GitHub](https://github.com/abuammarsami/d3), and there's a [one-page overview of the skill](/d3) if you'd rather see it before the full method.

## The takeaway

For a decade we wrote documentation for a reader who mostly never came — the future teammate who *might* open the wiki, the auditor who *might* ask. So docs were optional, aspirational, and always the first thing to slip.

That reader has arrived, and it opens the docs on every single task. It's the agent. It reads your business rules before it writes the payment flow, your ADRs before it changes the architecture, your bug audits before it touches the code that broke last time — *if* those documents exist, have one home, and are wired into its context. When they are, it works from the same hard-won knowledge you have. When they're not, it confidently rebuilds every mistake you already paid to learn.

So write for that reader. Partition by type, govern with frontmatter, ship docs in the same breath as code, and turn every bug into a permanent artifact. The best documentation isn't a byproduct of the work anymore. It's the interface the work happens through — and the next task is already reading it.

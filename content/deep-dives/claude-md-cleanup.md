---
title: "Your CLAUDE.md Is Probably Too Big — How I Cut Mine by 78%"
series: claude-md-mastery
order: 1
summary: "A 30-minute, mechanical cleanup that cut a 1,014-line CLAUDE.md to 221 — using the three loading mechanisms Anthropic actually built, and the one trick that stops it bloating again."
readingMinutes: 8
date: 2026-05
tags: [claude-code, ai-tooling, developer-productivity, anthropic, agent-context]
status: active
---

It was a Friday afternoon. I asked Claude Code to "fix the bug in the auth handler."

It spent the first three seconds reading my CLAUDE.md. All **1,014 lines** of it.

It read about stored-procedure naming conventions. About my bKash payment integration. About the 7-step phone OTP flow. About a 57-issue security audit. About a really specific RDLC dataset namespace gotcha I'd written down six months ago and forgotten existed.

Then it fixed the bug.

But here's the thing — none of that other context mattered. The bug was a missing `await`. The cost? Probably half a cent in tokens and a couple of seconds of latency. Not a fortune. But multiply that by every interaction across a team, every day, for a year, and suddenly your AI coding assistant is dragging an anchor everywhere it goes.

This is what I did about it. It took **30 minutes**. The result was a 78% reduction in CLAUDE.md size, faster responses, and — surprisingly — a file my **human teammates** could actually read.

Let's go.

## The mental model that changes everything

Most people treat CLAUDE.md like an onboarding doc. They sit down for an afternoon, brain-dump everything a new engineer would need to know, and call it done.

That's the trap.

Here's the shift in thinking:

> **CLAUDE.md is a contract, not a manual.**

A manual is exhaustive. A contract is the minimum binding language.

The job of CLAUDE.md is to tell Claude **what's always true on every turn** — the rules, the commands, the conventions. Everything else is *reference material* that should load only when relevant.

Once you internalize that, the cleanup is mechanical.

## What "too big" actually costs you

Let me show you what was happening, visually.

![The anchor — a 1,014-line CLAUDE.md is re-read on every turn; only a small slice is ever relevant, the rest is loaded, paid for, and competing for the model's attention.](/figures/claude-md-anchor.svg)

The highlighted block is what was relevant. Everything around it was noise — loaded, paid for, and **competing for Claude's attention** on every single turn.

## The three mechanisms Anthropic actually gives you

This is the part most tutorials skip. Anthropic didn't just say "keep it short." They built three mechanisms into Claude Code specifically to solve this. Most setups lean on one and skip the other two.

### Mechanism 1 — hierarchical, nested CLAUDE.md files

Drop a `CLAUDE.md` in a subdirectory. **It auto-loads only when Claude is working in that subtree.**

This is the biggest token win available. And it's the least-used of the three.

```
your-project/
├── CLAUDE.md                          ← always loaded
│
├── src/
│   ├── frontend/
│   │   ├── CLAUDE.md                  ← loaded only when editing frontend
│   │   └── ...
│   │
│   └── backend/
│       ├── CLAUDE.md                  ← loaded only when editing backend
│       └── ...
│
├── tests/
│   ├── CLAUDE.md                      ← loaded only when editing tests
│   └── ...
│
└── database/
    ├── CLAUDE.md                      ← loaded only when editing SQL
    └── ...
```

When you ask Claude to "add a unit test for the login form," it loads root + `tests/CLAUDE.md` + `src/frontend/CLAUDE.md`. It does **not** load your database conventions, your backend repo grouping rules, or anything else that doesn't matter.

### Mechanism 2 — `@imports` for always-on content

Inside CLAUDE.md, you can write:

```markdown
@docs/conventions/non-negotiable-rules.md
@~/.claude/CLAUDE.md
```

This **inlines** that file at runtime — same effect as if you'd pasted the content in, but without the bloat living in the file you edit by hand. Reserve this for content that truly matters every turn: personal preferences, hard non-negotiables.

### Mechanism 3 — plain markdown links to `docs/`

For everything else — code samples, audit reports, auth-flow walkthroughs, business rules — just **link**. Claude reads it when it needs to, skips it otherwise.

## The layout I ended up with

Here's the structure after my cleanup. This is a real .NET marketplace project — Clean Architecture, modular monolith.

![The layout after cleanup — a lean 221-line root that's always loaded, module rules that auto-load only inside their own subtree, and everything else linked in docs/ and read on demand.](/figures/claude-md-layout.svg)

Each nested CLAUDE.md is small (≤ 80 lines) and laser-focused on **that module's** rules. The Domain one is just 31 lines because the whole *point* of a Domain layer is restraint — "no persistence, no DI, no external services." That's almost the whole content.

## The 6-step cleanup — real, mechanical, 30 minutes

Stop reading and try this on your project. The before/after will surprise you.

### Step 1 — measure (1 minute)

```bash
wc -l CLAUDE.md
```

Under 250? Skip to the practices at the end and just maintain. Over 250? Keep going. Over 700? You're me a week ago.

### Step 2 — inventory (5 minutes)

Open CLAUDE.md. For each section, ask one question — *"Is this true on every turn?"* — and tag it:

| If the section is... | Tag it for... |
|---|---|
| A code example > 10 lines | `docs/guides/` |
| A list of enum values, error codes, tables | `docs/reference/` |
| A flow walkthrough (auth, payment, onboarding) | `docs/reference/` |
| A rule that only applies in one module | That module's nested CLAUDE.md |
| A duplicate of an existing doc | **DELETE**, replace with a link |
| The audit / known-issues list | Already in your audit doc → link only |
| One of your sacred non-negotiables | Stays in root |

I literally went through my file with a red pen: MOVE, DELETE, KEEP, split.

### Step 3 — create the nested skeleton (5 minutes)

```bash
touch src/Core/Domain/CLAUDE.md
touch src/Core/Application/CLAUDE.md
touch src/Infrastructure/CLAUDE.md
touch src/Api/CLAUDE.md
touch tests/CLAUDE.md
touch database/CLAUDE.md
```

(Adjust paths to match your project. The naming doesn't matter — Claude finds them by location.)

### Step 4 — move content (15 minutes)

This is where the magic happens. For each tagged section:

- **→ module CLAUDE.md**: cut, paste, *trim*. Keep the rule; drop the prose. If you wrote "Always use FluentValidation in handlers because validation is critical for…" — just write "FluentValidation runs via `ValidationBehavior`. Don't call `Validate()` manually."
- **→ `docs/`**: cut, paste into the appropriate `docs/` file. In CLAUDE.md, replace the section with a one-line link: `- [Caching strategy](docs/guides/caching.md) — HybridCache keys + TTLs.`

### Step 5 — rewrite the root (5 minutes)

Use this skeleton:

```markdown
# Project — Agent Contract

## 1. Identity
[One paragraph. What is this project?]

## 2. Commands
[Copy-paste-ready: build, test, run]

## 3. Repository Layout
[Tree, ≤ 20 lines]

## 4. Architecture
[One-liner stack + dependency rules]

## 5. Non-Negotiable Rules
[Numbered list, terse — 10–15 max]

## 6. Naming Conventions
[Compact tables]

## 7. Module Rules (auto-loaded)
- [Domain](src/Domain/CLAUDE.md) — one-liner
- [Application](src/Application/CLAUDE.md) — one-liner

## 8. Reference
- [Architecture overview](docs/architecture/overview.md)
- [Auth flows](docs/reference/auth-flows.md)
```

### Step 6 — verify (2 minutes)

```bash
wc -l CLAUDE.md       # should be ≤ 250
find . -name CLAUDE.md
```

Open a fresh Claude Code session and try this dialogue:

> **You:** What are the non-negotiable rules?
> **Claude:** *(answers from root CLAUDE.md without reading docs/)*

Then open a file deep in one of your module subtrees. Ask Claude something module-specific. Confirm it cites the rules from the nested file without you prompting it. That proves the nested CLAUDE.md auto-loaded.

## Before and after — real numbers

![Before and after — the root CLAUDE.md dropped from 1,014 to 221 lines and roughly 12,000 to 2,600 tokens loaded every turn: a 78% cut.](/figures/claude-md-before-after.svg)

| Metric | Before | After | Δ |
|---|---|---|---|
| Root `CLAUDE.md` lines | 1,014 | 221 | **−78%** |
| Tokens loaded every turn | ~12,000 | ~2,600 | **−78%** |
| Module rules in context when irrelevant | Always | Never | ✓ |
| Time to find a specific rule | 30-sec scroll | 1 click | ✓ |
| Risk of stale duplicated info | High | Low | ✓ |
| Could a human teammate actually read it? | No | **Yes** | ✓ |

That last row matters more than the token math. The token math says "you save a few cents per task." The human-readable row says **"your teammates will actually trust the file and contribute to it."** That's compounding value.

> The token math says "a few cents per task." The human-readable row says "your team will actually contribute." Guess which one compounds.

## The trick that keeps it from bloating again

This is the one lifecycle hack most write-ups miss.

In any Claude Code session, prefix a message with `#`:

```
# Tests fail unless you call SeedAsync first.
```

Claude figures out the right CLAUDE.md (likely `tests/CLAUDE.md`), summarizes the note, places it in the right section, and saves.

Why this matters:

- **Pre-written rules are guesses.** When you sit down to write CLAUDE.md from scratch, you guess what Claude will need. Half of those guesses are wrong.
- **`#`-added rules are real.** Every one is something you actually hit in a session. The signal-to-noise stays at 100%.

This is how Anthropic's own docs say to grow CLAUDE.md. Use it.

## 5 mistakes I made so you don't have to

**1. Treating every nested CLAUDE.md as a mini-manual.**
Module files should be ≤ 80 lines. If yours is creeping toward that limit, push detail to `docs/`.

**2. Duplicating rules between root and nested files.**
The *what* belongs in the root ("No raw SQL"). The *how it applies in this module* belongs in the nested file ("Use Dapper + SP, repo grouped under `Persistence/Repositories/{Module}/`").

**3. Embedding full code samples in CLAUDE.md.**
A 40-line `CreateAdHandler` example is overkill. The module CLAUDE.md says *"MediatR pattern — see [the guide](docs/guides/mediator-pattern.md)."* That's it.

**4. Letting CLAUDE.md become a changelog.**
`"✓ Resolved 2026-05-20"` drifts. Status lives in one place — the audit doc, the commit log, your PR description — and CLAUDE.md links to it. Never duplicate.

**5. Not using `#` to grow it organically.**
Every rule you pre-write is a guess. Every rule `#` adds is one you actually needed. Use it.

## Monthly health check

Run this once a month. Three or more reds means it's time to refactor.

```
[ ] Root CLAUDE.md ≤ 250 lines
[ ] No code samples > 10 lines in any CLAUDE.md
[ ] Module-specific rules live in nested CLAUDE.md files
[ ] Reference material is linked, not embedded
[ ] No duplicated status / audit info in CLAUDE.md
[ ] The build/test commands at the top still work today
[ ] You've used `#` at least once in the last month
```

Take a screenshot and stick it in your team chat. Make it a ritual.

## The one-screen cheat sheet

```
┌─────────────────────────────────────────────────────────────┐
│  CLAUDE.md is a contract, not a manual.                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1.  Keep the root ≤ 250 lines.                             │
│  2.  Use nested CLAUDE.md for module-specific rules         │
│      (auto-loads only when relevant).                       │
│  3.  Use @imports only for content needed every turn.       │
│  4.  Link to docs/ for everything else.                     │
│  5.  Use `#` in sessions to grow it organically.            │
│                                                             │
│  Result: faster Claude, lower bills, readable file.         │
└─────────────────────────────────────────────────────────────┘
```

The first cleanup takes 30 minutes. The discipline takes forever. But once your CLAUDE.md is a contract, Claude works **faster, sharper, and cheaper** — and your team can actually read it without their eyes glazing over.

That's episode one. The next parts of this series go deep on the most-skipped mechanism — nested files: when, where, and how big — and on the `#` workflow that lets the file grow itself.

### Resources

- Anthropic's official Claude Code docs: [docs.claude.com/en/docs/claude-code](https://docs.claude.com/en/docs/claude-code/overview)
- Claude Agent SDK: [docs.claude.com/en/api/agent-sdk](https://docs.claude.com/en/api/agent-sdk/overview)
- The `#` shortcut for organic CLAUDE.md growth — built into Claude Code, no setup.
- `/init` for new projects — scaffolds your first CLAUDE.md.
- Hierarchical CLAUDE.md — drop one in any subdirectory, Claude finds it.

---
title: "Nested CLAUDE.md, Deep — When to Split, Where to Put It, and How Big"
series: claude-md-mastery
order: 2
summary: "The highest-leverage, least-used mechanism in Claude Code: directory-scoped context files that auto-load only in their subtree. When to create one, where it goes, how big it should be, and what belongs in root versus nested."
readingMinutes: 11
date: 2026-07
tags: [claude-code, ai-tooling, developer-productivity, anthropic, agent-context]
status: active
---

In [episode one](/deep-dives/claude-md-cleanup) I cut a 1,014-line CLAUDE.md down to 221 by treating it as a contract instead of a manual. But a contract can only stay short if the detail it drops has somewhere to land. It didn't get deleted. It moved.

Most of it moved *down* — into six small CLAUDE.md files, one per module, each sitting in the directory it governs. That's the mechanism this episode is about. Anthropic built it, it costs nothing, and it's the least-used of the three: a `CLAUDE.md` in a subdirectory auto-loads **only** when Claude is working in that subtree.

The root cleanup was the visible win. Nested files are where the leverage actually lives. Let's go deep.

## How auto-load actually works

There is no config file. No registration step. No `include` list. The directory *is* the trigger.

When Claude Code runs a task, it walks the paths it's about to touch, and for each one it loads every `CLAUDE.md` from the repo root down to that file. The loaded set for any given turn is:

```
root CLAUDE.md              (always)
+  the nested CLAUDE.md for each subtree you actually touch
```

That's it. Nothing else loads. If you never open `database/`, its stored-procedure naming rules never enter the context window. They're not skimmed and discarded — they're never read. You don't pay for them in tokens, and more importantly the model never has to hold them in attention alongside the thing you actually asked for.

This is the inversion that makes it powerful: a nested file is **zero cost until it's relevant, then it's automatically present.** You don't have to remember to load it. You don't have to link to it. You put the rule next to the code it governs and forget about it. The next time someone — human or agent — works in that folder, the rule is right there.

## A worked example: what loads for one task

Take a real task from the repo this series is about: *"add a FluentValidation validator to the Application layer."*

Here's the tree, trimmed to the parts with a CLAUDE.md in them:

```
CLAUDE.md                                  ← root contract (238 lines)
src/
├── Core/
│   ├── Partners.Domain/CLAUDE.md          ← 33 lines
│   └── Partners.Application/CLAUDE.md      ← 67 lines
├── Infrastructure/
│   └── Partners.Infrastructure/CLAUDE.md  ← 58 lines
└── Presentation/
    └── Partners.Api/CLAUDE.md             ← 43 lines
tests/CLAUDE.md                            ← 60 lines
database/CLAUDE.md                         ← 48 lines
```

The validator lives under `src/Core/Partners.Application/Features/{Module}/Commands/{UseCase}/`. So the loaded set is:

```
LOADED:
  root CLAUDE.md
  src/Core/Partners.Application/CLAUDE.md

NOT LOADED:
  Partners.Domain      · Partners.Infrastructure
  Partners.Api         · tests · database
```

And the Application file earns its place immediately. It tells Claude, in one line, the rule it would otherwise have to guess:

> **FluentValidation runs via `ValidationBehavior`** — do not call `Validate()` manually in handlers.

The Domain rules ("no persistence, no DI"), the Dapper stored-procedure conventions, the SP naming table, the xUnit fixtures — none of that is in the window. Not because Claude chose to ignore it, but because the directory it's working in never asked for it.

![For any task, only a subset of CLAUDE.md files load — the always-on root plus the nested files for the subtrees you actually touch; everything else stays out of context.](/figures/claude-md-nested-loading.svg)

Touch two subtrees and you load two nested files. Ask for "wire the new validator up to a controller and add a handler test" and you'd pull in `Partners.Api/CLAUDE.md` and `tests/CLAUDE.md` too — but still not Domain, Infrastructure, or database. The context tracks the work.

## When to split: the "in the X layer" signal

You don't need a nested file per folder. You need one per **bounded module that has its own rules.** The test I use is embarrassingly simple, and it's a smell in the *root* file:

> If you keep writing *"in the X layer, do Y"* in root, X wants its own CLAUDE.md.

Every time a root rule has to name its own scope — "in the Infrastructure layer, repos go under `Persistence/Repositories/{Module}/`" — that qualifier is the file telling you where it belongs. A rule that only applies inside one subtree is paying rent in a file that's read on *every* turn, to be relevant on a fraction of them.

In this repo that produced exactly six modules, and they map to the architecture's real seams — the four Clean Architecture layers plus the two cross-cutting concerns that have their own conventions:

- **Domain** — the pure business core.
- **Application** — MediatR handlers, the vertical slices.
- **Infrastructure** — Dapper, repositories, external services.
- **Api** — thin controllers, request contracts.
- **tests** — xUnit, the test-data factories.
- **database** — the `.sql` scripts and SP naming.

Six seams, six files. Not one per folder — one per set of rules that only make sense inside that folder.

## Where to put it: the directory is the address

A nested file goes at the **natural working root of its module** — the directory you'd `cd` into to do that module's work. For the Application layer that's `src/Core/Partners.Application/`, so the file is `src/Core/Partners.Application/CLAUDE.md`. Anything you open below that point inherits it. You don't put it deeper (at `Features/` or `Commands/`) — the whole slice shares the rules, so the rules sit at the top of the slice.

Every one of these files opens with the same one-line header, and it's not decoration — it's the file stating its own scope out loud:

> Auto-loaded when working in `src/Infrastructure/Partners.Infrastructure/`. Inherits root `CLAUDE.md`.

That header is a gift to the next human. It says *this file is not the whole story — root still applies, and I only kick in here.* It stops nested files from quietly trying to become standalone documentation.

## One repo, two stacks: the monorepo case

Here's the detail that sold me on nested scoping completely.

This is not a clean greenfield repo. The same tree holds **two entire application stacks**: the legacy ASP.NET MVC app in `OnlineShop/` (Razor, jQuery, Kendo UI, cookie auth) *and* the new Clean Architecture Web API under `src/Core/Partners.*` and `src/Presentation/Partners.Api` (MediatR, JWT, Dapper, Swagger). One `OnlineShop.sln`. One `git clone`. Two worlds with almost nothing in common at the code level.

A single flat CLAUDE.md trying to describe both is a disaster — every rule has to caveat which stack it means, and the model reads the MVC conventions while writing an API handler. Nested scoping dissolves the problem. The root file carries only what's true across *both* stacks (the dependency direction, "no raw SQL in C#," "no hardcoded credentials") and even keeps a two-column tech-stack table that says, explicitly, `Partners.*` uses MediatR + FluentValidation + HybridCache while `OnlineShop` uses Razor + jQuery. Then the six nested files scope the *new* stack's detail into `src/` — so when Claude is deep in a MediatR slice, the JWT-and-Dapper world is loaded and the jQuery world simply isn't in the room.

The legacy `OnlineShop/` tree is scoped by root alone today — which makes it the textbook home for the *seventh* nested file the moment its Razor conventions are worth writing down. That's the mental model: **the directory that owns a stack owns that stack's context.** One repo, two stacks, no cross-contamination — because the folder boundary is also the context boundary.

## How big: the 80-line ceiling

A nested file only helps if it stays scannable. The moment it becomes a document you have to *read* rather than *glance at*, it's competing with the code for your attention and losing the plot. My ceiling is **80 lines.** Every real file in this repo clears it with room to spare:

| Module file | Lines |
|---|---|
| `Partners.Domain/CLAUDE.md` | 33 |
| `Partners.Api/CLAUDE.md` | 43 |
| `database/CLAUDE.md` | 48 |
| `Partners.Infrastructure/CLAUDE.md` | 58 |
| `tests/CLAUDE.md` | 60 |
| `Partners.Application/CLAUDE.md` | 67 |

The spread is the interesting part. Domain is the smallest at **33 lines** — and that's not laziness, it's the point. A Domain layer's whole reason to exist is *restraint*, so its rulebook is almost entirely a list of things you may **not** do:

> - **No repository interfaces** — those live in `Partners.Application`.
> - **No persistence concerns** — no EF attributes, no SQL, no Dapper.
> - **No external services** — no HTTP, no SMS, no email, no payment gateway types.
> - **No `IConfiguration` / `IOptions`** — Domain is config-free.

There's nothing to elaborate. The file is short because the layer is disciplined, and it closes with the one heuristic that makes all four rules self-serving: *"would this still be true if we switched from SQL Server to Postgres, or REST to gRPC? If yes → it belongs here."*

Application sits at the top of the range (67 lines) because it carries two genuinely load-bearing contracts that live nowhere else — the Upload→Create image handshake and the server-side field-visibility rule. That's the ceiling working as designed: the file is allowed to grow *for real rules*, and when it approaches 80 the pressure is to push detail into `docs/`, not to raise the limit.

## Root vs nested: the what lives up, the how lives down

This is the division of labor that keeps the whole system from rotting into duplication. Get it wrong and you write the same rule in two places, they drift, and now nobody trusts either copy.

The split is clean once you name it:

- **Root owns the *what*** — the non-negotiable, stack-wide law.
- **Nested owns the *how it applies here*** — the shape that law takes inside one module.

Take the real data-access rule. Root, in its non-negotiables, states the law and nothing more:

```
11. No raw SQL in C# — always use Stored Procedures via Dapper,
    or EF for the cases listed in docs/guides/data-access.md.
```

The Infrastructure nested file never repeats "no raw SQL." It states the *mechanics* — the how, the where, the enforcement — that only make sense once you're standing in that folder:

```
2. Dapper executes Stored Procedures — no raw SQL strings in C#,
   no exceptions. DapperRepositoryBase exposes only Sp* helpers,
   so this is enforced by construction. Need atomicity across
   statements? Put the transaction inside the SP (BEGIN TRAN)...

1. Repositories live under Persistence/Repositories/{Module}/.
   Services stay at root level. Never mix.
```

Root tells you the rule exists. The nested file tells you it's enforced by a base class, where the repository goes, and how to get a transaction without reaching for a C# `SqlTransaction`. Neither sentence appears twice. If the law changes, you edit root; if the mechanics change, you edit the module. **Avoiding the duplication is the entire discipline** — the moment you catch yourself pasting a root rule into a nested file, stop and ask which half you actually meant.

## Anti-patterns I had to unlearn

Three ways to turn a nested file back into the anchor episode one just cut off.

**The mini-manual.** A nested file that has grown a "Background," an "Architecture rationale," and a walkthrough is no longer a rule sheet — it's the old root file wearing a smaller hat. If a module file is drifting past 80 lines, that's the signal to move prose out, not to keep typing. The rules are the deliverable; the explanation goes to `docs/`.

**Duplicating root rules.** Restating "no `IHttpContextAccessor`" in four nested files feels thorough and is actually corrosion — four copies that will disagree the first time the rule is refined. State the law once in root. In the nested file, only add the module-local *shape* of it if there is one ("pass `userId` as a command parameter").

**Embedding long code samples.** A 40-line handler pasted into a CLAUDE.md is dead weight that goes stale the day the real code changes. The nested files here don't do it — they keep at most a tiny skeleton and then *link*: the Application file ends with pointers to `docs/guides/mediator-pattern.md`, the caching guide, the enums reference, the auth flows. The real `docs/` tree holds the walkthroughs; the CLAUDE.md holds the rule and a link. Reference material is read on demand and nowhere near every turn.

---

Six files, all under 80 lines, each sitting in the directory it governs, each loading only when you're actually there. That's the mechanism episode one deferred, worked all the way through.

But there's a question I've dodged twice now: how do these files *stay* right as the code moves? You don't sit down and author them in an afternoon — that's just guessing at a smaller scale. Episode three is about the `#` workflow that lets each of these files grow itself, one real rule at a time, from the sessions where you actually hit the wall.

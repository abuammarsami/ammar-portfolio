---
title: "The # Workflow — Growing CLAUDE.md Without Ever Editing It"
series: claude-md-mastery
order: 3
summary: "Pre-written rules are guesses; rules you add the moment you hit them are real. The # shortcut lets Claude route a one-line note to the right CLAUDE.md, summarize it, and save it — so the file grows itself, at 100% signal."
readingMinutes: 9
date: 2026-07
tags: [claude-code, ai-tooling, developer-productivity, anthropic, agent-context]
status: active
---

In [Part 1](/deep-dives/claude-md-cleanup) I cut a 1,014-line CLAUDE.md down to 221. In [Part 2](/deep-dives/nested-claude-md) I split what was left across six module files that auto-load only when Claude is working in their subtree. Two episodes of surgery. A lean root, scoped rules, a file my teammates could finally read.

And here's the uncomfortable part: all of that decays the moment I start hand-editing the file again.

Because that's what actually happens. You hit a gotcha in a session — the tests won't run until you seed the database, say. You make a mental note. Three weeks later you hit it again, having forgotten, and burn twenty minutes rediscovering it. *This* time you decide to write it down. You open the root CLAUDE.md, scroll to a section that feels vaguely right, write two paragraphs explaining the whole saga so "future me understands the context," and save. You just added twelve lines to the always-loaded contract to encode a five-word rule. Do that a dozen times and you've reinflated the very file you spent 30 minutes deflating.

The fix isn't more discipline about *how* you hand-edit. The fix is to (almost) never hand-edit it at all.

## The core insight: pre-written rules are guesses

When you sit down to author a CLAUDE.md from a blank page, you are predicting the future. You're guessing which conventions Claude will trip over, which commands it'll get wrong, which module boundary it'll cross by accident. You write those guesses down as rules.

Half of them are wrong.

I don't mean factually wrong — I mean *irrelevant*. You write "always use `async`/`await`" and Claude already does, every time, because it's a strong prior in the model. That rule earns its place in your token budget on every single turn and never once changes an outcome. Meanwhile the rule you actually needed — the one about the `TestDataFactory` you built last Tuesday, the one no pretraining corpus has ever seen — isn't in the file, because when you wrote it that factory didn't exist.

Now flip it. A rule you add the *instant you hit the problem* has a perfect provenance: something surprised you, in a real session, doing real work. It is by construction a thing Claude got wrong or a thing you had to explain. There is no guessing. Every rule added this way is a rule you demonstrably needed.

That's the whole thesis of this episode. Pre-written rules trend toward noise because they're speculative. Hit-driven rules stay at ~100% signal because each one is a scar from a real collision. The `#` shortcut is the mechanism that makes capturing them frictionless enough that you actually do it.

## How `#` actually works

In any Claude Code session, start a message with `#`. That's the entire interface.

You don't get a normal turn back. Instead Claude treats the line as a note to persist. Anthropic's description is deliberately minimal — "Press `#` to instruct Claude Code to add a memory. Then, type your memory and hit Enter to add it to the relevant CLAUDE.md file" — and in practice it prompts you to choose the destination: the project root, one of the nested module files, or your user-level `~/.claude/CLAUDE.md`. You pick the file; Claude writes your note into it as a rule. No file open, no scrolling, no commit dance in the moment — the capture happens inline, in the same session the rule bit you.

Here's a real one from this repo. Mid-session, a test run blows up because the handler under test reads from a `HybridCache` that nobody seeded. I already know the fix. Instead of just fixing it and moving on, I type:

```
# Tests fail unless you call SeedAsync on the fixture before Act — the
# handler reads HybridCache and an empty cache returns not-found.
```

I send it to `tests/CLAUDE.md` — the picker offers the nested files, and this rule is test-harness-specific, not root — and Claude appends it under the existing **Rules** heading as a terse rule. The diff it writes:

```diff
  ## Rules

  1. **Every feature must have tests before rollout.** No exceptions.
  2. **Use `{Module}TestDataFactory`** for consistent test data.
  3. **Use `TestHybridCacheFactory.Create()`** whenever the handler takes `HybridCache`.
+ 7. **Seed the cache before Act.** Handlers that read `HybridCache` see
+    not-found on an empty cache — call `SeedAsync` on the fixture first.
```

Notice what it *didn't* keep: my explanation of why. The rule is the imperative; the saga that produced it is gone. That terseness is the point — a rule earns its tokens by being a rule, not a story. (And notice it landed next to rule 3, which is already about `TestHybridCacheFactory`. It filed the new note beside its relatives, not at the bottom.)

## Why it composes with nested files

This is where the whole series pays off, so let me be precise about the mechanism.

The routing decision `#` surfaces — *which* CLAUDE.md — is the exact same scoping decision Part 2 was about. When my seed rule goes to `tests/CLAUDE.md` because it's test-harness-specific, it's filed into the file that will *auto-load only when someone next works in `tests/`*. The note about a database convention I add while writing a stored procedure lands in `database/CLAUDE.md`. The rule about `IFieldAssignmentReader` I add while touching a Create handler lands in `src/Core/Partners.Application/CLAUDE.md`. Each rule is filed into the file where it will later auto-load.

![The # workflow — a one-line session note is routed to the right CLAUDE.md (root or the matching nested file), summarized to a terse rule, and saved; the file grows from real hits instead of upfront guesses.](/figures/claude-md-hash-workflow.svg)

So the two mechanisms multiply. Nested files answer *where a rule should live so it loads only when relevant.* The `#` workflow answers *how a rule gets there without you thinking about it.* Together they mean the system doesn't just stay lean by upfront design — it stays lean *as it grows*, because growth is routed to leaves, not dumped on the root. The seed rule never costs a token on a turn that touches the API. The stored-procedure rule never loads while I'm editing tests. A hit in `tests/` becomes context for future work in `tests/`, and nowhere else.

That is the thing I wish someone had told me before I wrote my first thousand-line contract: a CLAUDE.md that grows by `#` into nested files is a CLAUDE.md that grows *at constant relevance*.

## The loop

The discipline is almost embarrassingly small. Four beats:

1. **Hit a surprise.** Claude does something you have to correct, or you rediscover a gotcha you already knew. Anything that makes you think "it should have known that."
2. **`#` it immediately.** Same session, while the context is hot. One line. Don't polish it — Claude will compress it anyway.
3. **Review the one-line diff.** Before you commit, read what it actually wrote. Did it land in the right file? Is the rule right? This is a five-second glance, not a review.
4. **It's permanent.** From the next turn on, that rule is context on every relevant turn, forever. The collision you had once, nobody on the team has again.

Contrast this with the approach it replaces, which I'll call *"I'll write good docs later."* Later never comes, and even when it does, you're reconstructing the rule from memory — you've lost the exact error message, the exact reason, the precise shape of the mistake. The `#`-in-the-moment loop captures the rule at its highest fidelity, which is the instant it bit you. Documentation written from a scar is always sharper than documentation written from a plan.

The compounding is the real prize. Every session leaves the file slightly smarter than it found it. A month of real work is a month of real collisions captured. You are, without ever scheduling a "documentation day," continuously training your agent on the exact failure modes of *your* codebase.

## Guardrails so it doesn't re-bloat

`#` is a growth mechanism, and unmanaged growth is how you got the 1,014-line file in the first place. So the contract mindset from Part 1 still governs — `#` just changes how rules get *in*, not the standard they're held to. Four guardrails keep the loop from quietly reinflating the file:

- **Keep the notes terse, and trust the compression.** You write a sentence; the file gets an imperative. If you find yourself typing a paragraph after `#`, you're writing docs, not a rule. Docs go in `docs/` with a link — that was rule 3 from Part 1 and it doesn't change here.
- **Actually read the diff.** `#` is high-trust but not zero-trust. Once in a while it mis-routes (a genuinely project-wide rule lands in a nested file, or vice versa) or writes a rule fatter than it needs to be. The review step is where you catch that. Ten seconds.
- **Watch the line count on the leaves.** Part 2's ceiling was ~80 lines per nested file. `#` can push a file past it over time. When a nested CLAUDE.md creeps toward that limit, that's your signal to lift the *detail* into `docs/` and leave a one-line rule plus a link behind — same refactor as episode 1, just localized.
- **`#` is for rules, not code.** If the note you're capturing wants to be a 20-line example, it doesn't belong in any CLAUDE.md. Write the rule ("Create handlers consult `IFieldAssignmentReader` before persisting — never the repository directly") and link the example. A rule is a sentence; a sample is a file.

Fold a check into the monthly health check from Part 1: *has anything I `#`-added this month drifted to the wrong file or outgrown its home?* Three minutes, once a month, and the file never rots.

## When not to reach for #

`#` is a good default, not a universal one. A few failure modes to name so you can catch them:

- **The mis-scoped rule.** Sometimes what feels module-specific in the moment is actually project-wide — or the reverse. If Claude files a rule you know belongs elsewhere, move it. This is a manual edit, and it's the *right* kind: you're correcting the routing, not writing prose. (This is exactly the root-vs-nested judgment from Part 2; `#` gets it right most of the time, and you arbitrate the rest.)
- **The changelog trap.** `#` captures *rules that are true going forward*, not *events that happened*. "Fixed the null-in-Razor bug on 2026-06-07" is not a rule — it's history, and history belongs in the audit doc and the commit log, never in CLAUDE.md. If your note reads like a status update, don't `#` it. (Part 1, mistake #4: letting the file become a changelog. Still the fastest way to rot it.)
- **The one-off.** Not every surprise generalizes. If you hit something that will never recur — a flake, a one-time migration quirk — capturing it as a permanent rule just adds noise. Ask "will this be true next week?" before you `#` it.

The through-line: `#` lowers the *cost* of adding a rule to near zero, which is exactly why you still need judgment about *whether* a rule should exist. Cheap to add is not the same as free to keep.

## Closing the series

Three episodes, one idea, arrived at from three sides.

Part 1 was the **contract** — the realization that CLAUDE.md is the minimum binding language, not an onboarding manual, and that treating it that way cuts it by 78%. Part 2 was **scope** — nested files that load a module's rules only when you're inside that module, so the always-loaded budget stays tiny while the total knowledge grows. And this part was **organic growth** — the `#` workflow that lets the file extend itself from real collisions, routing each new rule into the exact nested file where it'll later auto-load, at 100% signal.

Put them together and you get a CLAUDE.md that does something most documentation never manages: it *maintains itself*. It stays lean because it's a contract. It loads the right rules because it's scoped. And it gets smarter every week because it grows by `#`, one real scar at a time, instead of one hopeful guess.

The best documentation isn't the doc you sit down to write. It's the one that writes itself the moment you learn something — and then remembers it forever, so you never have to.

### Resources

- Anthropic's official Claude Code docs: [docs.claude.com/en/docs/claude-code](https://docs.claude.com/en/docs/claude-code/overview)
- The `#` shortcut for organic CLAUDE.md growth — built into Claude Code, no setup. Prefix any session message with `#`.
- Hierarchical CLAUDE.md — drop one in any subdirectory, Claude finds it (Part 2).
- The series index: [Claude.md Mastery](/deep-dives) — start at [Part 1](/deep-dives/claude-md-cleanup) if you're new here.

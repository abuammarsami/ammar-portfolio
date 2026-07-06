---
status: active
---

## Intro

Most sites tell you what they do. This page shows the receipts: what this
site is made of, what it refuses to carry, and the numbers it holds itself
to on every merge. Everything below the principles is measured from the
repository itself at build time — when a number here goes stale, the caption
says exactly when it was last measured.

## Principles

- **Content is markdown, period.** Every sentence on this site lives in a
  `content/*.md` file behind a strict schema — components never carry prose.
- **The physics is real.** The hero classifier, the [playground](/playground),
  and every Bloch sphere read from one hand-written, unit-tested statevector
  simulator. No animation pretends to be computation.
- **Agent-native, honestly labeled.** MCP server, WebMCP browser tools,
  llms.txt, fit reports with a mandatory gaps section, an AI-pitch page that
  discloses itself. The [machine interface](/agents) is documented like an API,
  because it is one.
- **Performance is a contract, not a vibe.** Per-route JavaScript budgets are
  enforced in CI; the homepage carries a live quantum simulator inside the
  same budget most sites spend on a cookie banner.
- **Never overclaim.** Results are reported with their baselines, including
  the ones the quantum models lost to.

## Template

Everything above is being extracted into an open-source template — the
**agent-native portfolio**: the markdown pipeline, the MCP/WebMCP tool
layer, the fit report, the guestbook, the budgets CI, minus my content. If
you want it when it ships, leave an email. No spam — exactly one launch
email, then the address is deleted.

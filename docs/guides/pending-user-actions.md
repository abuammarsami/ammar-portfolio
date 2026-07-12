---
title: "Pending User Actions — publish agentify, wire manifesto, domain, Scholar"
type: guide
status: active
owner: Md. Abu Ammar
created: 2026-07-06
last-reviewed: 2026-07-06
tags: [guide, launch, product, content, todo]
related:
  - launch-checklist.md
  - ../plans/plan-0007-next-generation-ideas.md
  - ../../products/agentify/README.md
---

# Pending user actions

Everything left that needs input only you have — accounts, secrets, manual
sign-in, or a content/product decision. Ordered by leverage. Each item says
exactly what to do and where the detailed steps live.

## 1. Publish the agentify package (highest leverage)

**What it is:** the open-source product extracted from this site's agent layer —
built, tested, reviewed, and publish-ready. It lives in its OWN repo at
**`~/workspace/agentify`** (kept separate on purpose so this portfolio's
budget/ADR gates stay green). Publishing it is where the reputation + money is
(see `plan-0007` Bucket C).

**Status:** reviewed & hardened 2026-07-07 (commit `34f89aa`) via a four-agent
pre-publish pass — ~20 findings across SWE/architecture, error handling, MCP
protocol conformance, and DX/packaging, all fixed. **47 tests pass**, typecheck +
build clean, `npm pack` = 33 kB (dist + docs only). Nothing left to fix before
publishing — only the account-tied steps below.

**Chosen name:** `@abuammarsami/agentify` — the unscoped `agentify` is taken on
npm; this scoped name is in your namespace and free. (Alternatives free at build
time if you'd rather go unscoped: `agentic-me`, `make-operable`, `portfolio-mcp`
— say so and I'll rename in one pass.)

**Steps live in `~/workspace/agentify/PUBLISHING.md`.** Short version:

1. Create npm account `abuammarsami` (owns the `@abuammarsami` scope).
2. Create GitHub repo `abuammarsami/agentify`, then:
   ```bash
   cd ~/workspace/agentify
   git remote add origin git@github.com:abuammarsami/agentify.git
   git push -u origin main
   ```
3. Publish — pick one:
   - **Simple:** `npm login` → `npm publish` (scoped public; runs the build).
   - **Recommended (provenance):** add repo secret `NPM_TOKEN` (npmjs → Access
     Tokens → Automation), then draft a GitHub Release for the tag — CI publishes.
4. Sanity check first: `npm run typecheck && npm test && npm run build && npm pack --dry-run`.

**Then (optional flourish):** tell me to write the launch — a README/manifesto
post pointing at the live npm package. The manifesto (§2) is that post.

## 2. Wire the manifesto to a live route

`content/essays/your-career-as-an-api.md` is written and ready — the category
manifesto ("Your Career Is About to Have an API"), which doubles as the agentify
launch post. It has **no route yet** (I didn't want a broken link on prod). Say
"wire the essay" and I'll add an `/essays/[slug]` route (or a long-form `/writing`
entry), keep it inside the JS budget, and add a link row to `content/writing.md`.
Do this around the same time you publish agentify (§1) so the post can link the
live package.

## 3. Custom domain

Follow [launch-checklist.md](launch-checklist.md) §1–§3: buy a domain (or use a
GitHub Student Pack free one — Namecheap `.me` / `.TECH`), add it in Vercel, set
`NEXT_PUBLIC_SITE_URL`, redeploy, verify every SITE_URL consumer, submit to
Search Console. **Do this before §4.**

## 4. Google Scholar

Follow [launch-checklist.md](launch-checklist.md) §4. Code-side prerequisites are
done; needs §3 first, plus creating the profile (manual, logged-in). Note: with
the two course papers dropped (§6), only the two signed theses carry
`citation_pdf_url`.

## 5. Testimonials (whenever quotes arrive)

Paste real quotes into `content/testimonials.md` in the documented format (one
blockquote per testimonial, last line `— Name, Title, Company`). The /about
section appears automatically; no code change. Verbatim only — never invented.

## 6. Dropped — the two course papers (decided 2026-07-06)

**No longer publishing** `blood-cell-detection` and `network-anomaly-detection`.
You decided they're coursework made from internet sources, not your research, so
they don't belong on a research portfolio. The `.md` pages stay as-is with
`pdf: false`; the raw PDFs stay untracked in `papers/`. No action needed. (The
old defect report is preserved in git history if ever wanted.)

## 7. Also parked (from earlier waves)

- Calendly/Stripe/Gumroad links into `content/hire.md` + `colophon.md` (CTAs are
  mailto placeholders until then). Stripe waives fees on your first $1,000
  (Student Pack) — good for the agentify hosted tier or consulting.
- Replace the two thesis PDFs in `public/papers/` with correctly 2022-dated
  recompiles (current copies stamped July 2026 on title/approval pages;
  ship-then-replace decided 2026-07-04).
- Voice-mode microphone round-trip needs one human test.

## Bigger builds waiting on you (from plan-0007)

Not manual actions — just flagged so they're not forgotten. Say the word and I
build: the `@agentify/next` adapter (so this site dogfoods the package), the
paid hosted layer (managed MCP + agent-analytics + strong-model intelligence
tier = the moat), and the Bucket B on-site features (roast-me red-team,
proof-carrying claims, Socratic thesis defense).

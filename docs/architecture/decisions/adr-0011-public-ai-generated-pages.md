---
title: "ADR-0011: Public AI-generated pages — the tailored pitch link contract"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-06
last-reviewed: 2026-07-06
deciders: [Md. Abu Ammar]
tags: [adr, ai, agents, safety, storage, pitch]
supersedes: null
superseded-by: null
related:
  - adr-0010-agent-guestbook-storage.md
  - adr-0009-agent-operable-web-surfaces.md
---

# ADR-0011: Public AI-generated pages — the tailored pitch link contract

## Status

Accepted — 2026-07-06.

## Context

Wave 3 (plan-0006) introduces `/for/<slug>`: persistent, shareable pages minted
from a recruiter's job description by the Groq-backed pitch engine. This is the
first feature that publishes **model output under this domain's name to an
audience the owner never sees**. A wrong or manipulated page is a reputation
incident, not a bug. The storage layer is the existing Upstash Redis (ADR-0010,
raw REST, no SDK).

## Decision

Public AI-generated pages are allowed **only** under the following contract,
implemented in `src/lib/agent/pitch.ts` (pure, unit-tested) and
`src/app/api/pitch/route.ts`:

1. **Structured output only.** The model must return JSON matching a zod
   schema (headline/summary/strengths/gaps/verdict with hard length caps).
   Free-form model text is never rendered. Parse-or-validate failure → one
   retry → 502. The stored value is re-validated on every read.
2. **The brief is ephemeral.** The submitted job description is sent to the
   model and discarded — never stored, never rendered. Only the clamped
   company label (≤64 chars, safe charset) and the validated report persist.
3. **Honest gaps are mandatory.** A report with an empty `gaps` array fails
   validation and is not stored. The honesty brand is enforced by schema, not
   by prompt alone.
4. **Sanitized against link spam and protocol impersonation.** Every text
   field is stripped of URLs, `www.` hosts, markdown link syntax, and `@@`
   lines before validation; strength citations must pass the internal-path
   whitelist (`isInternalPath`).
5. **Unindexed and self-expiring.** `robots: noindex,nofollow`, absent from
   the sitemap, stored with a 90-day TTL (`SET … EX 7776000 NX`), rendered
   `force-dynamic` so deletion is instant. Every page opens with an honesty
   banner naming the generation date and stating the company did not request
   or endorse it.
6. **Unguessable, auditable slugs.** Slug = clamped company + 16-hex (64-bit)
   random suffix; `NX` prevents overwrites. Every minted slug is appended to
   `pitch:index` (LTRIM-capped) so the owner can audit and kill pages
   (`DEL pitch:<slug>` in the Upstash console) without guessing keys.
7. **Redis-backed daily mint cap.** In-memory per-IP limits (3/10 min) are
   per-instance and cold-start-soft on Vercel, so the real control is a global
   `pitch:quota:<date>` counter (`PITCH_DAILY_CAP`, default 20/day) — read
   before minting, **incremented only after a page is actually stored**, so
   failed upstream calls or invalid model output cannot burn the quota. No
   Redis → no pitch links (503), never an unlimited fallback.

## Consequences

- Any future feature that publishes model output publicly (e.g. generated
  summaries, agent-authored notes) must adopt this same contract: schema-
  validated structure, sanitizers, honesty banner, noindex, TTL, audit trail.
- Waitlist emails and other PII stored in the same Redis are write-only from
  the site's perspective: no route or tool may ever enumerate or render them.
- The corpus remains the only source of claims; the pitch engine can be no
  more dishonest than the site itself.

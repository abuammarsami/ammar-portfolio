---
title: "Ask-Ammar starter answers"
type: reference
status: active
---

# Ask-Ammar starter answers

Curated answers for the four suggested-question chips in the "Ask Ammar" chat
(the `STARTERS` array in `src/components/agent/interview-mode.tsx`). These are
served verbatim from `src/lib/agent/starter-cache.ts` on the first turn, so the
most-clicked questions answer instantly and never spend the model's free-tier
token budget. Every claim here must stay grounded in `content/` — treat this as
the same source of truth the live agent draws on. The `## Heading` of each
section must match a starter question exactly (matching is punctuation- and
case-insensitive).

## What has he shipped to production?

He runs **Partners.com.bd** end to end — a live marketplace and business-social
platform across Bangladesh and the UK — owning its .NET API, the Flutter apps,
and a legacy MVC→API migration, with a generic-ledger payments platform and
self-healing settlement at the core (/work/payments-platform). Before that, at
**Masjid Solutions**, he built the Apple Pay / Google Pay and Authorize.Net ACH
donation stack on rails moving millions of dollars a year (/work/ach-payment-integration)
and **KioskVisionAI**, a serverless Azure visual-QA platform watching 200+
donation kiosks (/work/kioskvisionai). He ships constantly — 7–8 production
releases a week through CI/CD he architected. See /work for the full list.

## Tell me about his payment infrastructure work

Two bodies of work. At **Partners.com.bd** he designed and built the payments
platform around one generic ledger with self-healing settlement — a recovery
loop that reconciles and retries stuck payouts without a human (/work/payments-platform).
Before that, on the **Masjid Solutions** payments team, he built the wallet and
the Authorize.Net **ACH** stack end to end — one-time and recurring donations,
plus Apple Pay / Google Pay — on rails moving millions of dollars a year for
20,000+ users (/work/ach-payment-integration). Ask about the ledger design or the
settlement recovery loop and I'll go deeper.

## What is his quantum ML research about?

His B.Sc. thesis, *Machine Learning in the Realm of Quantum*, surveyed the field
and built **variational quantum circuits** and data-encoding methods on PennyLane
simulators (/research/quantum-machine-learning-thesis). The research thread
continues through his MS — Bangla POS tagging with knowledge distillation,
multi-output CNNs, and ensemble methods — bringing a production engineer's
discipline to research code. The homepage hero is a two-qubit quantum classifier
he wrote from scratch, and /learn is a six-lesson interactive quantum curriculum
you can play with.

## Why should I interview him?

He's rare in pairing production-engineering discipline with genuine research
depth. He owns a live marketplace's .NET API, Flutter apps, and payment rails
end to end (/work/payments-platform), shipped AI-powered Azure kiosk monitoring
across 200+ devices (/work/kioskvisionai), and does published quantum-ML research
(/research) — all with DDD, vertical slices, and clean architecture throughout,
at a cadence of 7–8 production releases a week. He operates like a senior engineer
and thinks like a researcher. Start at /hire, or email him directly.

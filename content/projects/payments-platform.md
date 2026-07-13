---
title: Payments Platform — One Generic Ledger, Self-Healing Settlement
date: 2026-06
tags: [dotnet, payments, distributed-systems, reliability, sqlserver]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
layout: case-study
---

# Payments Platform — One Generic Ledger, Self-Healing Settlement

**Summary:** Designed and built the payments platform for the Partners.com.bd marketplace
backend (.NET, ASP.NET Core, SQL Server) — one generic `dbo.Payment` money ledger that serves
every paid feature, a vendor-agnostic `IPaymentGateway` abstraction with a country-aware
resolver, a single self-healing settlement coordinator, and a Hangfire reconciliation backstop.
It replaces a legacy wide table (`dbo.OnlinePayment`) that stored money as text and trusted the
client's callback.

**Problem:** The legacy `dbo.OnlinePayment` crammed every paid feature's columns *and* bKash's
API shape into one wide table, with `Amount` stored as `NVARCHAR(200)` — money as free text.
Worse than the schema was the settlement logic: four features had copy-pasted
verify→claim→fulfil code that had drifted apart, and every one of them short-circuited a
re-delivered callback with an `already settled → return success` line. A 2026-06-18 review
found the money-loss bug that hides behind that line (finding C1): if the domain write failed
*after* the payment was claimed, the user was charged and the feature never delivered — and the
re-delivered callback that could have completed it was thrown away. There was no reconciliation,
no atomic claim, and no server-side amount cross-check.

**Approach:** Collapsed the plumbing into ONE generic ledger. A `Purpose` discriminator plus a
nullable `ReferenceId` link a `dbo.Payment` row back to the feature's own domain row, so
status, idempotency, settlement, refunds and reconciliation live exactly once (Fig. 3) — five
features (Boost, BundlePurchase, Membership, ProfileFee, Advertisement) now reuse it. Money is
`DECIMAL(18,2)`; three identifiers separate the internal `Id`, the external `PublicId` GUID, and
a Stripe-style `pay_…` receipt code; the create idempotency key is unique *per user* (a global
key would be an IDOR). Vendors sit behind `IPaymentGateway` (create / execute / verify-callback /
resolve-webhook-reference / refund), and a resolver indexes every injected gateway by provider
and per-country availability — adding a vendor is one class, one DI line, and listing it under a
country. Bundle (internal balance) and bKash (real four-call tokenized checkout with a
process-wide grant-token cache and an execute→query fallback) are implemented; Nagad, Rocket,
SSLCommerz, Stripe and PayHere are enum-scaffolded.

The correctness core is a single `PaymentSettlementCoordinator` that every settler delegates to,
supplying only its idempotent `fulfil` step (Fig. 1). It resolves the gateway by the *payment
row's* server-trusted country, verifies with the vendor (the one trusted settlement gate),
cross-checks the vendor's captured amount against the server-stored order (`AMOUNT_MISMATCH`
otherwise), and atomically claims `Pending → Settled` exactly once via a guarded SQL `UPDATE`.
Then it **always** runs fulfilment — on a fresh claim, on a lost claim race, and on a
re-delivered already-settled callback — because each fulfilment stored procedure stamps
`FulfilledDate` exactly once (`WHERE FulfilledDate IS NULL`), making the domain write idempotent
and letting a settled-but-unfulfilled row self-heal on the next pass. A Hangfire job runs every
five minutes with three disjoint passes (Fig. 2): sweep inline-Bundle fulfilled-but-Pending rows
to Settled, expire abandoned intents past a 30-minute TTL, and re-dispatch the idempotent settle
command for settled-but-unfulfilled rows (giving up after 168 hours). Idempotency on the *create*
side is a MediatR pipeline behavior (ADR-0008) over 13 curated high-risk endpoints, keyed by a
required `Idempotency-Key` header with a SHA-256 body hash and a 7-day TTL for payments.

**Impact:** The `already settled → return success` money-loss path is gone by construction: the
coordinator re-runs idempotent fulfilment on every attempt, `FulfilledDate` prevents double
credit, and reconciliation is the backstop. Four drifting settlers became one audited pipeline;
the unsafe deferred-debit `dbo.WalletDebit` primitive was deleted so the double-debit pattern
can't return. Backed by ~883 automated tests (the coordinator alone has a dedicated suite). Honest
status: the SQL is `CREATE OR ALTER`, applied manually in SSMS — green in CI but not yet run
against the live DB, and no bKash-sandbox smoke test yet (the biggest gap). Only Bundle + bKash
are real; no webhook vendor is wired; payment callback host-header hardening and confirmation
emails/SMS are designed but deferred; `RefundAsync` exists but has no new-stack admin surface —
an explicit go-live gate before real bKash traffic.

**Tech stack:** .NET, ASP.NET Core, C#, MediatR, Dapper + stored procedures, SQL Server,
Hangfire (recurring reconciliation), bKash Tokenized Checkout, FluentValidation, xUnit

**Links:** (sole-engineer build for a production marketplace — walk-through on request)

**Media:**
![Fig. 1 — vendor-agnostic decoupling: one dbo.Payment ledger links via Purpose + ReferenceId to five paid features, and via IPaymentGateway + resolver to seven providers — Bundle and bKash implemented, five scaffolded — so a new vendor is one class plus one DI line](/figures/payments-decoupling.svg)
![Fig. 2 — the self-healing settlement pipeline: one coordinator looks the payment up, checks Purpose, branches on already-Settled, verifies with the vendor and cross-checks the amount, claims Pending→Settled once, then ALWAYS runs the idempotent fulfilment; a failed fulfil logs critical and returns FULFILMENT_FAILED so it self-heals on the next pass](/figures/payments-settlement.svg)
![Fig. 3 — legacy vs new, row by row: NVARCHAR money and a client-trusted callback and copy-pasted settlers that lost money on re-delivery, against a DECIMAL ledger with server-side amount cross-check, one shared coordinator, always-idempotent fulfil, and a reconciliation backstop](/figures/payments-legacy-vs-new.svg)
![Fig. 4 — the FulfilledDate state machine: Status × FulfilledDate forms four cells, with Settled + FulfilledDate-null as the charged-but-undelivered money-loss cell; three disjoint reconciliation passes (inline-Bundle sweep, expire abandoned, re-dispatch settle) each match non-overlapping rows every five minutes](/figures/payments-reconciliation.svg)

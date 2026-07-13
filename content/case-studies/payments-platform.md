---
name: payments-platform
title: "Payments Platform"
type: case-study
status: active
updated: 2026-07-13
headings:
  problem: "A wide table wasn’t the dangerous part"
  bigIdea: "Make settlement a property of the data, not the code"
  howItWorks: "One ledger, one gateway seam, one settlement path"
  followAJob: "Follow one payment from tap to delivered"
  decisions: "Where the real thinking went"
  warStoryKicker: "The war story · retiring a money table"
  warStory: "Retiring OnlinePayment without charging anyone twice"
  impact: "A class of money-loss bugs, gone by construction"
---

## Tagline

One money ledger for every paid feature — engineered so a payment can never be captured without the thing it paid for eventually arriving, even when the delivery step fails after the charge.

## Role

Sole engineer of Partners.com.bd — I design, build, and run the whole platform end to end: the Flutter mobile apps, the .NET API, and the legacy MVC → API migration. This payments platform is one slice of that rebuild, taken from a legacy wide table through a full security review to a shared, self-healing settlement pipeline.

## In one minute

When you pay for something in an app, two things have to happen: the money leaves your account, and the thing you bought unlocks. It *feels* like one action, but on the server it's two — capture the money, then write the feature. They are not one database transaction, so there's a gap: what if the money is captured and the feature write then fails? You've been charged and got nothing.

The legacy code "solved" this by not looking. When the vendor re-delivered the callback, it saw the payment was already settled and returned success — throwing away the one retry that could have finished the delivery. This project is the opposite instinct: a single settlement pipeline that treats the delivery step as **idempotent and always-run**, so a payment that got stuck halfway *self-heals* the next time anything touches it — and a reconciliation job that goes looking every five minutes.

## Stats

- 1 | generic ledger for every paid feature
- 4 → 1 | drifting settlers replaced by one coordinator
- ~883 | automated tests across the suite
- exactly once | FulfilledDate claimed per payment
- 5 min | reconciliation backstop cadence

## The problem

The legacy `dbo.OnlinePayment` was one wide table that crammed every paid feature's columns *and* bKash's raw API shape into a single row — with `Amount` stored as `NVARCHAR(200)`, money as free text. But the schema wasn't the dangerous part. Four features — boost, the profile fee, bundle top-ups, membership — each had their own copy-pasted verify→claim→fulfil settlement code, and the copies had drifted. Every one of them ended a re-delivered callback with the same short-circuit: *already settled → return success*. There was no atomic claim, no server-side check that the amount the vendor reported matched the order, and nothing that ever went back to look at a payment that got stuck. A June 2026 end-to-end review is what surfaced how much money that quiet line could lose.

## Incidents

### A user could be charged and never receive what they paid for

*symptom → cause*

Settlement is two steps — claim the money (`Status → Settled`), then do the feature's domain write (credit the balance, apply the boost, grant the tier). They aren't one transaction. If the write failed *after* the claim, the payment sat Settled-but-undelivered — and because the re-delivered callback short-circuited on "already settled," the retry that could have completed it was discarded. Charged, undelivered, no recovery. This was finding C1, the most severe in the review.

### The upgrade that took the money but not the tier

*symptom → cause*

The membership settler called `MarkPaid` but ignored its result, and returned success even when the request reference was null. So a membership payment could capture the money while the tier was never granted — and report a clean success on the way out, which is exactly the failure that never generates an alert, only a confused customer.

### A replayed callback could settle an expensive order cheaply

*symptom → cause*

Nothing cross-checked the amount the vendor said it captured against the amount the server had recorded for the order. A replayed or tampered callback carrying a small amount could, in principle, settle a large purchase — the class of bug where the ledger and reality quietly disagree.

## The big idea

Any framework gives you a payments table and an HTTP client. What none of them give you is the property that actually matters here: **settlement is two steps that can't be one transaction, so the second step must be safe to run any number of times.** That's the whole thesis.

So the design collapses to two moves. First, *one* generic ledger — `dbo.Payment` with a `Purpose` discriminator and a `ReferenceId` — so payment status, idempotency, settlement, refunds and reconciliation are written once, not re-implemented per feature. Second, *one* settlement coordinator that owns the money-critical sequence, where every feature supplies only its own idempotent delivery step. The idempotency is anchored in a single column, `FulfilledDate`, stamped exactly once per payment by a guarded SQL claim — which is simultaneously what stops a double credit and what lets a reconciliation sweep *find* the payments that got stuck.

## The wrapper

- Generic ledger | One `dbo.Payment` row is the money record for every feature. `Purpose` + a nullable `ReferenceId` link it back to the feature's own domain row, so the plumbing lives once. `DECIMAL(18,2)`, never text.
- Three identifiers | `Id` (internal BIGINT, for joins), `PublicId` (external GUID, for URLs/callbacks), and a Stripe-style `pay_…` receipt code — each with one job, so the enumerable id is never what's exposed.
- Vendor abstraction | `IPaymentGateway` (create · execute · verify-callback · resolve-webhook-reference · refund) behind a resolver that indexes every registered gateway by provider and country. A new vendor is one class, one DI line, listed under a country.
- Trusted settlement gate | Exactly one place settles: `VerifyCallbackAsync`, signature/execute-checked, followed by an amount cross-check against the server-stored order. A mismatch is `AMOUNT_MISMATCH`, not a settlement.
- Claim-once | `Pending → Settled` is a single guarded `UPDATE … WHERE Status = 'Pending'` that reports whether *this* call won the race — so concurrent and re-delivered callbacks settle a payment exactly once.
- Idempotent fulfilment | Every fulfilment stored procedure stamps `FulfilledDate` in one `WHERE FulfilledDate IS NULL` claim inside its transaction — no double credit on a re-run, and a visible gap (`Settled` + `FulfilledDate IS NULL`) when a delivery is owed.
- Reconciliation backstop | A Hangfire job runs every five minutes with three disjoint passes: sweep inline-Bundle rows to Settled, expire abandoned intents past a 30-minute TTL, and re-dispatch the idempotent settle command for the stuck-but-owed (giving up after 168 hours).
- Create idempotency | A retried "start payment" can't double-charge — `dbo.PaymentCreate` dedupes on a per-user `IdempotencyKey` unique index today. A MediatR behavior (ADR-0008; required header + SHA-256 body hash) is built and registered for a curated 13-endpoint rollout, but not yet marked live on any command — a coordinated mobile+server cutover.

## How it works

At the center is a single class, `PaymentSettlementCoordinator`, and a rule: no feature writes its own settlement sequence. Each per-feature settler — boost, bundle, membership, profile fee, advertisement — calls the coordinator and hands it exactly one thing: a `fulfil` delegate that does that feature's domain write. The coordinator owns everything money-critical around it: parsing the provider, looking the payment up by the gateway's reference, checking the `Purpose` matches (a boost row that reaches the membership settler is a routing bug, `WRONG_PURPOSE`), resolving the vendor gateway by the *payment row's* server-trusted country, verifying, cross-checking the amount, and claiming the money once. Because the sequence exists in one place, it's tested once and exhaustively instead of four times and inconsistently — which is precisely what let the old defects diverge per feature.

## Follow a job

### 1. The order is priced and recorded on the server

*server-stored*

When you start a payment, the server recomputes the total (never trusting a client amount), writes a `dbo.Payment` row with a per-user idempotency key, and — for an external vendor — asks the gateway to create a checkout. Bundle top-ups are internal-balance and settle inline; bKash returns a hosted-checkout URL.

### 2. The vendor captures the money

*tokenized*

For bKash this is the real four-call tokenized flow — grant-token (cached process-wide behind a semaphore so concurrent requests don't each hit the rate limit), create, then an explicit server-side execute after you return from the hosted page. A failed or timed-out execute that might actually have captured is reconciled by a status query before we ever report failure, so a network blip after capture doesn't lose a real payment.

### 3. Settlement claims the money — exactly once

*claim-once*

The callback lands in the coordinator. It verifies with the vendor (the single trusted gate), cross-checks the captured amount against the stored order, then runs the guarded `Pending → Settled` update. If a concurrent caller already claimed it, this call simply loses the race — and falls through anyway, because the next step is safe to run regardless.

### 4. Fulfilment runs — always, and idempotently

*self-healing*

The coordinator **always** runs the feature's `fulfil` step: on a fresh claim, on a lost claim race, and on a re-delivered callback for an already-settled payment. Each fulfilment stamps `FulfilledDate` exactly once, so re-running is a no-op if it already happened. If fulfilment fails, the coordinator logs critical and returns `FULFILMENT_FAILED` — it never reports success — so the payment stays visibly owed and self-heals on the next callback or reconciliation pass.

## Architect decisions

### One generic ledger, not a payment column per feature

*chose: a shared `dbo.Payment` + `Purpose`/`ReferenceId` · over: payment fields bolted onto each feature table*

Payment status, idempotency, settlement, refunds and reconciliation are identical across features, so they live once on the ledger and a new paid feature adds (at most) its own small domain table plus one `Purpose` value. The contrast is the legacy wide table that re-implemented all of it, per feature, in `NVARCHAR`.

### One settlement coordinator, not four copies

*chose: a single pipeline every settler delegates to · over: per-feature verify→claim→fulfil code*

Copy-pasted money code drifts, and drift is where the defects hid. Centralizing the sequence means it's written and audited in one place and tested exhaustively once; each feature contributes only the delivery step that's genuinely feature-specific.

### FulfilledDate idempotency, not a distributed transaction

*chose: a once-stamped marker column + always-run fulfilment · over: wrapping capture and delivery in one transaction*

Capture and delivery can't share a transaction (the capture is a claim against an external charge). Rather than reach for a distributed transaction, the delivery step is made idempotent by a single guarded `FulfilledDate` claim — which also becomes the signal reconciliation scans for. Simpler, and it turns "stuck" into "self-healing."

### Resolve the gateway by the payment's country, not the caller's

*chose: the server-stored `CountryCode` on the payment row · over: the country supplied on the callback*

A settlement that trusts the caller's country can be steered to the wrong vendor on a cross-country callback. The payment row already records the country it was created under, server-side; settlement resolves the gateway from that. (Finding H2 — it was defaulting to "BD" and would have broken the GB/LK expansion.)

## The war story

The dangerous bug wasn't a crash — it was a line that looked like a safety check. Four settlers all ended a re-delivered callback with *if the payment is already settled, return success.* Reading it in isolation, it's obviously correct: don't settle twice. But settlement is two steps, and that line silently assumed the second step — the feature delivery — had also succeeded. If delivery had failed after the money was claimed, the payment was Settled-but-undelivered, and this exact line threw away every future callback that could have completed it. Charged, nothing delivered, no path back. It was finding C1 of the June review, and its root cause was structural: the same logic copy-pasted four times had drifted, so there was no single place to reason about it.

The fix was to delete the assumption. All four settlers now delegate to one coordinator that *always* re-runs the (now idempotent) fulfilment — on a fresh settle, on a lost race, and on a re-delivered already-settled callback — with `FulfilledDate` making the re-run safe and a five-minute reconciliation sweep as the backstop for anything the callbacks never revisit. Then a second adversarial review of the fix caught a regression I'd introduced: the profile-fee "already active" branch didn't stamp `FulfilledDate`, so if the entitlement was ever granted by another path, that payment would loop in the reconciliation backlog *forever*. That's what added the give-up window (168 hours) so a genuinely permanent failure drops out for a human instead of re-alerting for eternity. The same pass deleted the unsafe deferred-debit `dbo.WalletDebit` primitive and folded the membership balance debit into one transaction with the fulfilment claim — so the double-debit pattern it enabled can't come back.

## Impact

The money-loss short-circuit is gone by construction, not by patch: the coordinator re-runs idempotent fulfilment on every attempt, `FulfilledDate` prevents a double credit, and reconciliation finds anything the callbacks miss. Four drifting settlers collapsed into one audited pipeline serving five features (boost, bundle, membership, profile fee, advertisement) across a vendor-agnostic gateway abstraction, all under ~883 automated tests. The honest part matters as much as the wins, though. The SQL is `CREATE OR ALTER`, applied *manually in SSMS* — it's green in CI and the full flow passed end to end against the bKash sandbox, but it hasn't been applied to the live production database yet; a production dry-run with real-money bKash is the remaining gate. Only Bundle and bKash are real gateways; Nagad, Rocket, SSLCommerz, Stripe and PayHere are enum-scaffolded, and no webhook vendor is wired (bKash uses a GET callback). Payment-callback host-header hardening is deferred — the auth links are already hardened, but the payment `CallbackUrl` still derives from the request host, mitigated for now by the amount cross-check and vendor verification. Confirmation emails/SMS via a notification outbox are designed, not built. `RefundAsync` exists on every gateway, but there's no new-stack admin surface to trigger one — which is an explicit go-live gate I've drawn before any real bKash traffic.

## Going deeper

The whole thing is documented rather than just shipped: a written end-to-end payment review (findings C1–C3, H1–H4 and their remediation), an ADR for idempotency on the 13 high-risk endpoints, and per-migration SQL manifests that each say "apply manually in SSMS" so nothing is pretended to be live that isn't. The design is deliberately boring where money is on the line — one ledger, one coordinator, one idempotency column, one reconciliation job — and the caveats above are tracked as gates, not swept under. The next steps are unglamorous and correct: apply the SQL to the production database, mark the idempotency endpoints live per the ADR-0008 rollout, repeat the end-to-end bKash run against production, and build a refund admin surface before the first live taka moves.

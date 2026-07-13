---
name: background-job-system
title: "Background Job System"
type: case-study
status: active
updated: 2026-07-13
---

## Tagline

The invisible machine that runs everything a user shouldn't have to wait for — and never loses a job, even when a server dies mid-task.

## Role

Sole engineer of Partners.com.bd — I design, build, and run the whole platform end to end: the Flutter mobile apps, the .NET API, and the legacy MVC → API migration. This background-job system is one slice of that rebuild, taken from first principles through the sequenced cutover that retires the legacy money scheduler.

## In one minute

When you tap **Register** on an app, some work happens instantly (your account appears) and some work should happen *just after* (a welcome email, a receipt, an image getting watermarked). If the app tries to do the slow part while you wait, the tap feels sluggish — and if that slow part fails, it can corrupt the fast part that already succeeded.

The fix is a **background job system**: the app does the fast part now and hands the slow part to a separate worker to finish moments later. That sounds simple. Doing it so that a job is *never silently lost, never accidentally run twice, and never invisible when it breaks* is the actual engineering — and it's what this project is.

## Stats

- 3 → 1 | tangled subsystems replaced by one
- real DB | integration tests over the actual stored procedures
- 0 | business rules changed in the migration
- ≥1 | every job runs at least once — safely

## The problem

Before this, "background work" wasn't a system — it was scattered habits. Some jobs ran on hand-written loops that woke up on a timer. Other slow work (sending email, watermarking images, generating PDFs, uploading documents) ran *inline*, on the same thread that was answering the user's web request. There was no dashboard to see jobs, no consistent retry when one failed, no place a dead job could land, and no metrics. Worst of all, the failures were the quiet kind — the kind you learn about from a confused user, not an alert.

## Incidents

### Registration could return an error *and* create the account

*symptom → cause*

A user tapped Register. The database saved their account, then the code tried to send the verification email on the same thread. The mail server hiccuped, the send threw, and the request returned a 500. From the user's side: "registration failed." From the database's side: a half-born account that already existed. Two sources of truth, disagreeing — the bug that generates support tickets for weeks.

### One slow email could freeze a web thread for a minute

*symptom → cause*

The email client had no timeout configured, so its default was ~100 seconds. A single unresponsive mail server didn't just delay one email — it held a precious request-handling thread hostage for a minute and a half, starving every other user waiting behind it.

### A failed signup leaked files onto the CDN forever

*symptom → cause*

Document uploads pushed files to the CDN *before* the user record was committed. If the signup then failed, the files were already out there — orphaned, unowned, and (because of a naive naming scheme) able to collide across users. Storage that only ever grew, and nobody to clean it.

## The big idea

Every mature language has a background-job engine you can install in an afternoon. The engine gives you scheduling, a retry button, and a dashboard. What it does **not** give you is correctness — and correctness is the entire job.

So the thesis I built the whole system around is one sentence: **the engine is plumbing; the top-1% layer is the wrapper you put around it.** The wrapper is where a job becomes safe to run twice, where "enqueue this work" becomes atomic with the database change it belongs to, where failures get classified instead of blindly retried, where nothing dies without leaving a trace, and where the whole thing is measurable, lockable, and rehearsed before it ever touches production.

## The wrapper

- Idempotency | Every job is assumed to run at least twice — a marker row makes the second run a safe no-op, so a retry can never double-charge or double-send.
- Atomic enqueue | The instruction "run this job later" is written in the *same database transaction* as the change it follows, so a job can never exist without its data, or vice versa.
- Failure classification | Failures are sorted into "worth retrying" (a timeout) and "never retry" (a bad payload) — so the system doesn't waste hours re-running something that can't succeed.
- Dead-letter queue | When a job exhausts its retries it lands in a durable table with its full history, and two alert channels fire — the opposite of failing silently.
- Observability | Every execution is measured; the flagship signal is the *age of the oldest un-started job* — if it's climbing, the whole pipeline is stalled, and I know before users do.
- Security | Write access to the job store is remote code execution on the worker, so the API, the worker, the job-dispatch role, and deploys each run under their own least-privilege database login.
- Kill switches | Any job can be switched off in seconds without a deploy, and the switch fails *closed* — a typo can never accidentally turn a sensitive job on.

## How it works

At the center is a deliberate split: the API stays lean and fast, and a **dedicated worker service** — a separate process entirely — owns the job engine. The API's only job is to record work into a durable *outbox* inside the database, in the same breath as the business change. The worker then picks that work up and runs it, across two pools tuned for different job shapes, with a dashboard, health checks, and full telemetry. A job that runs *inside* your API is a foreground job in disguise; giving it its own house is the first real decision.

## Follow a job

### 1. The API commits the work and the intent together

*one transaction*

Instead of "save the order, then tell the queue about it" — two systems, two chances to fail — the API writes the order **and** a row describing the follow-up job into one database transaction. Either both land or neither does. There is no gap for a crash to fall into.

### 2. A dispatcher relays the intent — safely across many servers

*every minute*

A small dispatcher wakes on a tick, claims a batch of pending rows, and hands them to the engine. It claims with a database trick (`READPAST` + a short lease) so that even with several workers running, no two ever grab the same row — and if a worker dies mid-hand-off, the lease expires and the row is simply picked up again.

### 3. The worker runs the job — at least once, exactly one effect

*idempotent*

Because a crash can cause step 2 to replay, delivery is *at-least-once*. That's a feature, not a bug — as long as every job is idempotent. The first thing each job does is check a marker: if this exact message already ran, it stops. Run it twice, get one effect.

## Architect decisions

### Outbox over a distributed transaction

*chose: a transactional outbox · over: a distributed transaction across the DB and the queue*

The tempting fix is to wrap the database write and the enqueue in one transaction. But the engine opens its own connection, which escalates the whole thing to a distributed transaction coordinator — heavyweight, fragile, and slow, to solve a problem a single-table insert already solves. The outbox keeps it to one database, one commit.

### A separate worker process, not a thread in the API

*chose: a dedicated worker service · over: a background thread inside the API*

Jobs that live inside the API compete with user requests for threads, die on every deploy, and can't be scaled or secured on their own. A separate service means job load can never starve the site, and a deploy of one doesn't kill the other.

### Classify failures — never blind-retry

*chose: transient vs. permanent at the boundary · over: retry everything the same way*

A network blip should be retried; a malformed payload never will succeed no matter how many times you try. Sorting failures at the point they happen means the retry budget is spent only where it can help, and a genuinely-broken job dead-letters fast for a human instead of looping for hours.

### Four database logins, least privilege

*chose: split lanes per principal · over: one shared application login*

Because writing to job storage equals running code on the worker, the blast radius of a SQL-injection bug is decided by *which login* the vulnerable code holds. The API's business login is explicitly denied access to job storage; the outbox row is the single, audited doorway from the app into the job system.

## The war story

The most dangerous part wasn't in the new code — it was a *legacy scheduler* nobody had touched in a long while, quietly running three recurring jobs against the production database. One of them credited real money to user balances, and it was **not** idempotent: run it twice, pay twice.

Retiring it safely was pure sequencing. The new worker's safety lock lives in its own storage and *cannot* coordinate with the old app's storage, so the only thing preventing a double-payout was ordering: **stop the old scheduler first, confirm it's fully down, then enable ours — and enable the money job dead last.** I pinned that job to *never* auto-retry (a re-run means a re-payment), wrote an executable "did it run exactly once?" check to confirm the morning after, and a runbook rule in bold: a missed run is reconciled in SQL, never by pressing "run again." The promise isn't that the cutover is careful — it's that the ordering plus the never-retry pin make a double-payout structurally impossible, not merely unlikely. It's rehearsed against a separate database; the money job flips on dead last.

## Impact

One observable, secure, idempotent subsystem now owns every piece of async work, and an entire class of production defects — the half-created account, the frozen thread, the orphaned files — is gone by construction, not by patch. Three hand-rolled loops and a standalone scheduler app collapsed into uniform, dashboarded, dead-lettered jobs. It shipped in independently-releasable phases, each behind a hot-reloadable switch, with zero business-rule changes — and it's covered by a test suite that spins up a real database in a container and exercises the actual stored procedures, not just mocks.

## Going deeper

I wrote the whole thing up as a **[seven-part engineering deep-dive](/deep-dives)** — from "why your background thread isn't enough" through the outbox, the dead-letter queue, the security model, and the cutover — so the reasoning is documented, not just the result. The design is deliberately boring where it should be (no new infrastructure, no message broker, one database) and careful exactly where money and correctness are on the line. **[Read the full series →](/deep-dives)**

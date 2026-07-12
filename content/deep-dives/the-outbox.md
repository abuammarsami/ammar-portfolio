---
title: "The Outbox — Why \"Enqueue Then Commit\" Is a Lie, and How to Fix It"
series: background-jobs
order: 4
summary: "Make the enqueue atomic with the state change by writing it into the same SQL transaction — table, claim SP, and dispatcher included."
readingMinutes: 15
date: 2026-07
tags: [dotnet, background-jobs, reliability, sql-server, distributed-systems]
status: active
---

## The bug that shipped a half-registered account

Back in Part 1 I mentioned a live defect I inherited: registration would sometimes return a `500`, and the user would end up with an account that existed but never got a verification email. The support ticket was always the same — "I signed up, I can't log in, and no email came." The account row was real. The email never happened.

Here's the code that caused it, stripped to the two lines that matter:

```csharp
await _authRepo.CreateUserAsync(user);        // DB write #1: the account row commits
_jobs.Enqueue<IEmailJobs>(x => x.SendVerification(user.Id));  // write #2: a different system
```

Two writes. Two different storage systems — SQL Server and the Hangfire job store. **There is no transaction spanning them.** If the process dies in the gap between them, the account commits and the enqueue never happens: silent loss. Flip the order to enqueue-first, and you trade one bug for a worse one — a worker picks up the job and runs it against a user row that the *later* rollback erased. Now you're emailing a ghost. This is the [Part 1](/deep-dives/why-background-jobs) partial-commit defect, and no amount of retry logic fixes it, because retry needs a durable record of intent, and that's exactly what we failed to write.

## What you'll build

This part fixes the dual-write hazard for good. The idea is small: stop treating "enqueue" as a second write to a second system, and make it a *row in the same database transaction as the state change*. A separate process relays those rows to Hangfire afterward. That's the transactional outbox.

You'll build:

- **`dbo.JobOutbox`** — the intent table, with a `Status` lifecycle and a filtered covering index.
- **`JobOutboxEnqueue`** — the enqueue primitive, called *inside* your business SP's transaction.
- **`JobOutboxClaimBatch`** — the multi-node-safe claim SP (`ROWLOCK, READPAST, UPDLOCK` + a lease).
- **`OutboxDispatcher`** — the recurring Hangfire job that relays claimed rows and dead-letters poison.

## Two writes, no transaction: the dual-write hazard

Let me name the failure precisely, because "eventual consistency" hand-waving hides it. You have two resource managers: the application database and the job engine's storage. A crash can land in the window between committing to one and committing to the other. There are exactly two orderings and both are broken:

| Ordering | Crash in the gap | Result |
|---|---|---|
| Commit DB, then enqueue | after commit, before enqueue | State exists, job lost. **Silent loss.** |
| Enqueue, then commit DB | after enqueue, before commit | Job runs against rolled-back state. **Ghost.** |

There is no third ordering that saves you, because the problem isn't the order — it's that *two commits can't be made atomic by sequencing them*. You need them to be **one commit**. The only way to get one atomic commit is to have one resource manager involved. So we make the enqueue a write to the database the state change already lives in.

## The outbox, from zero

The transactional outbox pattern (concept note: the outbox pattern) is almost embarrassingly simple once you see it:

> Instead of enqueuing to the job engine, **insert a row describing the job into an outbox table — in the same transaction as your state change.** A separate dispatcher polls that table and relays each row to the real engine.

Think of it as an outbox tray on a desk. You don't run to the post office mid-meeting (a second system, a second failure point). You drop the letter in the tray — the same desk, the same drawer you just filed your paperwork in — and either both go in the drawer or neither does. Someone else empties the tray on a schedule.

The magic is that "file the paperwork" (your state change) and "drop the letter" (the enqueue intent) are now **the same physical act against the same database**. One transaction. It commits atomically or it rolls back atomically. The crash-in-the-gap window is *gone* because there is no gap — there's one commit.

What you trade for that guarantee: latency (the tray gets emptied on a tick, not instantly) and **at-least-once delivery** (the dispatcher can relay a row, crash before recording success, and relay it again). That second one is why every handler downstream must be idempotent — which is exactly the discipline we built in [Part 3](/deep-dives/the-job-contract). The outbox and idempotency are two halves of one contract.

Here is the whole flow — the atomic write on the left, the dispatcher's relay loop on the right:

![The transactional outbox — state and enqueue-intent commit atomically, then a dispatcher relays each row to Hangfire and marks it dispatched; a crash re-claims the row, making delivery at-least-once.](/figures/background-job-system-outbox.svg)

## Why not the "obvious" fixes

Before the build, two dead ends I watched people (me) walk into.

**"Just wrap both in a `TransactionScope`."** Tempting — one `using` block around the DB write and the `Enqueue`, done. Except Hangfire's SQL storage opens *its own* connection. The moment a `TransactionScope` sees two connections enrolled in one ambient transaction, it escalates to the **Distributed Transaction Coordinator (MSDTC)**. Our design doc rejected this outright (decision D5, and the §15 decision log entry reads simply: *"Outbox; TransactionScope rejected — MSDTC"*). The research note is blunter:

> `TransactionScope` around `Enqueue` escalates to MSDTC (Hangfire opens its own connection). Outbox is the atomic path; plain enqueue-just-before-commit for non-critical jobs.

MSDTC drags in a distributed transaction coordinator, two-phase commit, and a whole class of ops pain — for a problem a single-table insert solves. Hard no.

**"Just enqueue right before commit — the window is tiny."** Sometimes acceptable. If the work is *fully regenerable and has no state to couple to*, a plain enqueue-before-commit is fine. Our forgot-password email is exactly this: there's no durable state that a lost email corrupts, the user is staring at a "check your email" screen so the outbox's up-to-60-second dispatch latency is *wrong* for them, and if the mail is lost they just click resend. So [Part 1](/deep-dives/why-background-jobs)'s password-reset path enqueues directly to the `1-critical` queue and skips the outbox. But partner-verification email — a *side effect of the registration state change* — goes through the outbox, because losing it leaves a user in a broken state. The rule: **couple to state → outbox; regenerable and standalone → direct enqueue is defensible.**

## Building it: the `dbo.JobOutbox` table

Here's the table, trimmed to the load-bearing columns:

```sql
-- database/tables/jobs/dbo.JobOutbox.sql
CREATE TABLE dbo.JobOutbox
(
    Id            BIGINT           NOT NULL IDENTITY(1,1),  -- clustered, append-only, near-FIFO
    MessageId     UNIQUEIDENTIFIER NOT NULL,                -- transport dedup key
    JobType       NVARCHAR(200)    NOT NULL,                -- LOGICAL name, not a CLR type
    PayloadJson   NVARCHAR(MAX)    NOT NULL,
    Status        TINYINT          NOT NULL DEFAULT (0),
    OccurredUtc   DATETIME2(3)     NOT NULL DEFAULT (SYSUTCDATETIME()),
    ClaimedBy     NVARCHAR(100)    NULL,
    LockedUntil   DATETIME2(3)     NULL,
    Attempts      INT              NOT NULL DEFAULT (0),
    DispatchedUtc DATETIME2(3)     NULL,
    LastError     NVARCHAR(2000)   NULL,
    CorrelationId NVARCHAR(64)     NULL,
    CONSTRAINT PK_JobOutbox PRIMARY KEY CLUSTERED (Id)
);
-- Transport dedup: a retried producer with the same MessageId is a no-op.
CREATE UNIQUE NONCLUSTERED INDEX UX_JobOutbox_MessageId ON dbo.JobOutbox (MessageId);
-- The dispatcher's hot path. Filtered to unprocessed rows so the index stays tiny.
CREATE NONCLUSTERED INDEX IX_JobOutbox_Unprocessed
    ON dbo.JobOutbox (Id) INCLUDE (Status, LockedUntil) WHERE Status <= 1;
```

Two design points earn their keep. **`Status` is a four-state lifecycle:** `0 Pending → 1 Claimed → 2 Dispatched → 3 Dead`. **The `IX_JobOutbox_Unprocessed` index is filtered** (`WHERE Status <= 1`) — it only ever indexes pending and claimed rows, so as millions of dispatched rows pile up, the dispatcher's scan stays over a handful of live rows, not the whole table. `JobType` is a *logical* string (`"email.partner-verification.v1"`), never a CLR type name — that's what lets implementations move without orphaning rows.

Now the write. This is the whole point of the pattern — the enqueue happening *inside* the business transaction:

```sql
-- database/stored-procedures/jobs/dbo.PartnerDocumentAttachAndEnqueue.sql
BEGIN TRY
    BEGIN TRAN;

    UPDATE dbo.PartnerDocumentUpload
    SET UserId = @UserId
    WHERE Id IN (SELECT PendingImageId FROM @DocIds) AND UserId IS NULL AND Status = 0;

    IF @@ROWCOUNT <> @Expected      -- partial attach is corruption; fail loud
        THROW 50001, 'doc id set did not all attach', 1;

    -- Durable upload intent, SAME transaction as the attach.
    EXEC dbo.JobOutboxEnqueue
        @MessageId   = @MessageId, @JobType = N'partner-docs.upload.v1',
        @PayloadJson = @PayloadJson, @CorrelationId = @CorrelationId;

    COMMIT TRAN;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK TRAN;
    THROW;
END CATCH
```

The state change (attaching staged documents to a real user) and the enqueue intent are in one `BEGIN TRAN … COMMIT`. Either both land or neither does. The `JobOutboxEnqueue` primitive itself is idempotent on `MessageId` — a retried producer inserts nothing and returns the existing `Id`:

```sql
-- database/stored-procedures/jobs/dbo.JobOutboxEnqueue.sql
BEGIN TRY
    INSERT INTO dbo.JobOutbox (MessageId, JobType, PayloadJson, CorrelationId)
    VALUES (@MessageId, @JobType, @PayloadJson, @CorrelationId);
    SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS Id;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() IN (2627, 2601)   -- same MessageId already enqueued → idempotent success
    BEGIN
        SELECT Id FROM dbo.JobOutbox WHERE MessageId = @MessageId;
        RETURN;
    END
    ;THROW;   -- anything else must roll back the caller's transaction
END CATCH
```

Note it catches **both** `2627` (constraint) and `2601` (unique index) — the same dual-catch we used for the idempotency marker in Part 3. And a *real* error re-throws, so it propagates out and rolls back the caller's whole transaction. It doesn't quietly swallow.

## The claim SP: multi-node safety from READPAST, not the lock

Now the subtle core. Multiple dispatcher instances (or one instance running batches) must each grab a *disjoint* set of rows without blocking each other and without a crashed dispatcher stranding rows forever. Here's how one SP does all of that:

```sql
-- database/stored-procedures/jobs/dbo.JobOutboxClaimBatch.sql
WITH Claimable AS
(
    SELECT TOP (@BatchSize) Id, MessageId, JobType, PayloadJson, Status, ClaimedBy,
           LockedUntil, Attempts, CorrelationId, OccurredUtc
    FROM dbo.JobOutbox WITH (ROWLOCK, READPAST, UPDLOCK)
    WHERE Status <= 1
      AND (Status = 0 OR LockedUntil < SYSUTCDATETIME())  -- pending, or a dead claimant's expired lease
    ORDER BY Id
)
UPDATE Claimable
SET Status      = 1,
    ClaimedBy   = @ClaimedBy,
    LockedUntil = DATEADD(SECOND, @LeaseSeconds, SYSUTCDATETIME()),
    Attempts    = Attempts + 1
OUTPUT inserted.Id, inserted.MessageId, inserted.JobType, inserted.PayloadJson,
       inserted.Attempts, inserted.CorrelationId, inserted.OccurredUtc;
```

Read the three hints on that `WITH` clause slowly, because they *are* the design:

- **`UPDLOCK`** takes update locks on the rows we're about to modify, so two claimers can't both select the same row and race to update it.
- **`READPAST`** is the load-bearing one. It tells SQL Server: *if a row is locked by someone else, skip it — don't wait.* So dispatcher B, hitting rows dispatcher A already locked, silently reads past them to the next unclaimed rows instead of blocking. This is SQL Server's version of `FOR UPDATE SKIP LOCKED`. **Multi-node safety comes from READPAST, not from any dispatcher-level lock.** The whole outbox is safe to run on two nodes concurrently *because of this hint*, independent of any application coordination.
- **`ROWLOCK`** keeps the locking granularity at the row level so SQL doesn't escalate to a page/table lock and accidentally serialize everyone.

Two more things. **`LockedUntil` is a lease.** A claimer stamps "I own this until now + 60s." If it crashes mid-dispatch, the row isn't stranded — once `LockedUntil` passes, the `(Status = 0 OR LockedUntil < SYSUTCDATETIME())` predicate makes it claimable again. Crash recovery for free, no reaper thread. And **`Attempts` increments at claim time** — a row that keeps getting claimed and never dispatched is climbing toward the poison cap on every attempt, even if the dispatcher dies before reporting failure. `OUTPUT inserted.*` returns the freshly-claimed rows in the same round trip, so claim-and-fetch is one statement.

## The dispatcher

The relay is a Hangfire recurring job that ticks every minute:

```csharp
// src/Infrastructure/.../Jobs/Outbox/OutboxDispatcher.cs
[Queue(JobQueues.Default)]
[SkipConcurrentExecution]   // efficiency only — READPAST makes overlap correct
public async Task RunAsync(CancellationToken ct)
{
    var opts = options.CurrentValue;
    if (!opts.IsJobEnabled(Recurring.RecurringJobIds.OutboxDispatcher))
    {
        // EMERGENCY BRAKE: producers keep writing rows (durable); nothing reaches Hangfire.
        logger.LogWarning("OutboxDispatch skipped — disabled via Jobs:Toggles; rows accumulating");
        return;
    }
    var claimedBy = $"{Environment.MachineName}:{Environment.ProcessId}".ToLowerInvariant();

    for (var batch = 0; batch < MaxBatchesPerRun && !ct.IsCancellationRequested; batch++)
    {
        var messages = await outbox.ClaimBatchAsync(claimedBy, opts.OutboxBatchSize, opts.OutboxLeaseSeconds, ct);
        if (messages.Count == 0) break;   // drained

        foreach (var message in messages)
        {
            try { router.Dispatch(backgroundJobs, message); }   // the real Enqueue
            catch (Exception ex) { await HandleDispatchFailureAsync(message, ex, claimedBy, opts, ct); continue; }

            // Enqueue SUCCEEDED — mark dispatched ONLY now.
            if (await outbox.MarkDispatchedAsync(message.Id, claimedBy, ct)) dispatched++;
            else logger.LogWarning("row {OutboxId} was reclaimed before mark-dispatched", message.Id);
        }
    }
}
```

`[SkipConcurrentExecution]` stops two ticks on the *same node* from overlapping — but note the comment: that's an **efficiency** optimization, not a correctness one. Correctness across nodes is READPAST's job. The kill-switch check is an emergency brake: flip `Jobs:Toggles` off and producers keep durably writing outbox rows while nothing reaches Hangfire — you can pause delivery without losing intent.

The ordering is the whole ballgame: **`router.Dispatch` (the real `Enqueue`) runs first, and `MarkDispatched` runs only if it succeeded.** If enqueue throws, we go to the failure handler and the row stays claimed; when its lease expires it's re-dispatched. That's the at-least-once guarantee made concrete — and why downstream idempotency is non-negotiable.

On the failure path, `Attempts` (already bumped at claim) is checked against the cap. Under it, the row goes back to `Status = 0` for retry. At it, the row flips to `Status = 3` (Dead) and a dead-letter record is written — the durable death record we'll build out in [Part 5](/deep-dives/when-jobs-fail). Both the mark-dispatched and mark-failed SPs carry a **`ClaimedBy` ownership guard**:

```sql
-- dbo.JobOutboxMarkDispatched.sql
UPDATE dbo.JobOutbox
SET Status = 2, DispatchedUtc = SYSUTCDATETIME(), LockedUntil = NULL, LastError = NULL
WHERE Id = @Id
  AND Status = 1
  AND ClaimedBy = @ClaimedBy;   -- ownership guard: a reclaimed row isn't double-stamped
```

Here's the race it closes. Dispatcher A claims row 42, then stalls (GC pause, slow enqueue). Its 60-second lease expires. Dispatcher B claims row 42, enqueues it, marks it dispatched. Now A wakes up and tries to mark 42 — *without the guard, A would stamp B's row, and if A also enqueued, you'd have a duplicate that nobody flags.* The `ClaimedBy = @ClaimedBy` predicate means A's UPDATE matches zero rows: the row is no longer A's. `MarkDispatched` returns false, A logs "reclaimed before mark-dispatched," and moves on. The stale claimant can never stamp or poison a row it no longer owns.

## Mistakes that page you at 3am

1. **Marking dispatched *before* the enqueue succeeds.** The single most common inversion. If you flip `Status = 2` first and the enqueue then throws, you've recorded "delivered" for a job that never reached the engine — silent loss, reborn inside the very pattern meant to prevent it. Mark dispatched *only after* `Enqueue` returns.

2. **Forgetting idempotency now that delivery is at-least-once.** The outbox *guarantees* redelivery — a lease-expiry re-dispatch, a crash-before-mark. Every downstream handler will run more than once. If your handlers aren't idempotent ([Part 3](/deep-dives/the-job-contract)), the outbox doesn't fix your dual-write, it *converts it into duplicates*.

3. **Reaching for `TransactionScope`.** It escalates to MSDTC the instant Hangfire's second connection enrolls (design decision D5). A single-table insert inside your existing SP transaction is the entire fix. Don't summon a distributed transaction coordinator.

4. **Unbounded retention.** Dispatched rows are terminal and have no read use case — but they accumulate forever if you let them. Purge them in bounded `DELETE TOP (2000)` batches (staying under SQL's ~5k lock-escalation threshold). The filtered index hides them from the hot path, but the table still grows on disk. Delete dispatched rows; keep deaths in the DLQ.

5. **Putting secrets or DTOs in `PayloadJson`.** Outbox rows are plaintext in the DB and visible in tooling. IDs only — regenerate tokens and reload entities at execution time, exactly as the email runner does.

## Cheat-sheet

```text
┌──────────────────────── THE OUTBOX, IN ONE SCREEN ────────────────────────┐
│ PROBLEM   Enqueue + state change = two commits, no transaction across them.│
│           Crash in the gap → lost job (commit-first) or ghost (enqueue-1st)│
│                                                                            │
│ FIX       INSERT the enqueue intent as a row in the SAME SQL transaction   │
│           as the state change. One resource manager. Atomic.               │
│                                                                            │
│ TABLE     dbo.JobOutbox  Status: 0 Pending→1 Claimed→2 Dispatched→3 Dead   │
│           filtered index WHERE Status <= 1 (hot path stays tiny)           │
│                                                                            │
│ CLAIM     WITH (ROWLOCK, READPAST, UPDLOCK) + LockedUntil lease            │
│           READPAST = skip locked rows = multi-node safety (NOT the lock)   │
│           LockedUntil = crash recovery;  Attempts++ at claim time          │
│                                                                            │
│ DISPATCH  recurring 1-min tick, [SkipConcurrentExecution] (efficiency)     │
│           Enqueue FIRST → MarkDispatched ONLY on success                   │
│           ClaimedBy ownership guard → stale claimant can't stamp your row  │
│                                                                            │
│ COST      at-least-once delivery ⇒ every handler MUST be idempotent        │
│ AVOID     TransactionScope (MSDTC) · mark-before-enqueue · unbounded rows  │
└────────────────────────────────────────────────────────────────────────────┘
```

## Where this leaves us

The outbox makes delivery *durable and atomic* — nothing is lost between the state change and the engine — but it deliberately trades that for at-least-once delivery, and it says nothing yet about what happens when a job keeps failing. In [Part 5](/deep-dives/when-jobs-fail) we build the other half: classifying transient vs permanent failures at the provider boundary, the retry curve, and the dead-letter table that catches everything the retries can't save.

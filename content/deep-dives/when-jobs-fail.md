---
title: "When Jobs Fail — Retry Classification, the Dead-Letter Queue, and Resilience"
series: background-jobs
order: 5
summary: "Transient vs permanent, one global retry curve, and a dead-letter table that never lets a death vanish."
readingMinutes: 15
date: 2026-07
tags: [dotnet, hangfire, background-jobs, reliability, sql-server]
status: active
---

## The failure that was invisible since 2024

I once found this in a production job handler:

```csharp
try { /* … do the work … */ }
catch (Exception ex) { ex.ToString(); }
```

Read it twice. It catches every exception, calls `ToString()` on it — building a string — and then throws that string away. No log, no rethrow, no metric. The job reports success. Since 2024, every failure that handler ever hit had simply *ceased to exist* the moment it happened. You'll meet this exact anti-pattern again when we retire that scheduler in [Part 7](/deep-dives/production-patterns).

A crash is loud. You get a stack trace, a page, a bad night, and a fix. A *swallowed* failure is worse: the work silently didn't happen, and nobody knows until a partner emails asking where their verification link went. This part is about the opposite discipline — **never retry the unretryable, and never let a death vanish.**

## What you'll build in this part

The failure-handling layer that sits underneath every job in the system. Concretely:

- Two exception types — `TransientJobException` and `PermanentJobException` — that classify a failure *at the provider boundary*.
- One **global** `AutomaticRetry` policy (`Attempts = 5` — five *retries* after the first run, so up to six executions — on a `[60, 300, 1800, 7200]`-second curve) and the per-job attribute that overrides it.
- A durable **dead-letter table** (`dbo.JobDeadLetter`) plus the Hangfire state filter that writes a row on the *final* failure — and *only* the final failure.
- Alerting that fires on **arrival** in the DLQ, over two independent channels (email + webhook).
- The **timeout ladder** and per-downstream circuit breakers that stop a slow dependency from taking a worker hostage.

## The concept, from zero: not all failures are equal

When a job throws, you face exactly one decision: **retry, or don't.**

Retry a failure that will *never* succeed — a malformed payload, a validation error, a 404 for a user who was deleted — and you burn the entire retry budget — six executions across ~4.5 hours — to arrive at the same failure, having wasted a worker slot and delayed everyone behind it. That's a **permanent** failure.

*Don't* retry a failure that *would* have succeeded a moment later — SMTP was briefly unreachable, the CDN returned a 503, DNS blipped, a socket timed out — and you've thrown away work that was one retry from done. That's a **transient** failure.

So the whole game is classification. And the honest place to classify is **at the boundary where you call the outside world**, because that's the only place you know whether a 429 means "back off" (transient) or a 400 means "your request is wrong" (permanent). We express that decision as the *type* of exception we throw.

Here is the whole lifecycle at a glance — where a failure goes from the moment it's thrown:

![Failure lifecycle — classify at the provider boundary, delete permanent failures without retry, back off transient ones over five retries, then dead-letter the exhausted job and alert on arrival.](/figures/background-job-system-failure.svg)

## The two exception types

Here they are, verbatim — the entire classification vocabulary the system has:

```csharp
// src/Core/Partners.Application/Common/Jobs/JobExecutionExceptions.cs:10-27
// Hangfire's retry filter is configured with ExceptOn = [typeof(PermanentJobException)] so the
// permanent class FAILS FAST …
public class PermanentJobException : Exception
{
    public PermanentJobException(string message) : base(message) { }
    public PermanentJobException(string message, Exception innerException) : base(message, innerException) { }
}

// … note SqlException still has no working IsTransient, so classification matches error numbers.
// Unclassified exceptions are ALSO treated as transient by the retry filter …
public class TransientJobException : Exception
{
    public TransientJobException(string message) : base(message) { }
    public TransientJobException(string message, Exception innerException) : base(message, innerException) { }
}
```

Two things matter here.

**First**, the default is *transient*. The retry filter's `ExceptOn` list contains only `PermanentJobException`, so anything else — a bare `Exception`, a `TimeoutException`, an `HttpRequestException` — rides the retry curve. This is the correct default: a random unclassified exception is more likely a hiccup than a poison payload, and retrying a genuinely-permanent one just wastes a bounded number of attempts. The dangerous default would be the reverse.

**Second — and read this carefully, because it's easy to over-claim — there is no shipped SQL-error-number classifier.** The comment on line 18 documents a real design principle: `SqlException.IsTransient` is unreliable, so *in principle* you classify by matching transient SQL error numbers (40613, 49918, 1205 deadlock, and friends) across every entry in `ex.Errors`. That's a good thing to build. But in this codebase it is **not** a class you can point to. Runners throw `PermanentJobException` explicitly for known-bad input (an unknown role code, a validation failure), and let everything else default to transient. The SQL-number matcher is documented intent, not code — I'm flagging it so you build it deliberately rather than assume it's already there.

The permanent-throw looks like this in a real runner (from the email job in [Part 3](/deep-dives/the-job-contract)): a role code that isn't in the enum can never be fixed by retrying, so it fails fast rather than looping.

```csharp
// Unknown role = malformed payload retrying can never fix → PermanentJobException (fail fast).
var callbackPath = PartnerVerificationEmailContent.CallbackPathFor(roleCode);
```

## The retry policy: one global curve

Retry itself is configured *once*, globally, when we wire Hangfire up:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/HangfireServiceCollectionExtensions.cs:19-101
config
    .UseFilter(new AutomaticRetryAttribute
    {
        Attempts = 5,
        // 1 min → 5 min → 30 min → 2 h → 2 h (Hangfire reuses the LAST delay) …
        DelaysInSeconds = [60, 300, 1800, 7200],
        ExceptOn = [typeof(PermanentJobException)],
        OnAttemptsExceeded = AttemptsExceededAction.Fail
    })
```

Walk the curve: the first run fails, wait 60s; retry 1 fails, wait 300s (5 min); then 1800s (30 min); then 7200s (2 h); and because `Attempts = 5` gives six executions that need five gaps while the curve lists only four delays, Hangfire reuses the last — so the fifth gap is 2 h again. That's roughly a 4.5-hour window for a transient dependency outage to heal itself, entirely worker-free (a scheduled job holds no thread).

`OnAttemptsExceeded = AttemptsExceededAction.Fail` is deliberate: on exhaustion the job transitions to `FailedState` — it does **not** get silently deleted. That failed transition is the hook the dead-letter queue hangs on. (Note we first *remove* Hangfire's built-in default `AutomaticRetryAttribute` before adding ours, guarded by an `Interlocked.CompareExchange` so it happens exactly once per process — `GlobalJobFilters` is process-global state.)

### Overriding per job — closest attribute wins

`AutomaticRetryAttribute` has `AllowMultiple = false`. That's the whole trick: a method-level `[AutomaticRetry(...)]` on a specific job **replaces** the global one for that job, because Hangfire resolves filters closest-first and a non-multiple attribute doesn't stack. A job that must *never* auto-retry declares:

```csharp
[AutomaticRetry(Attempts = 0)]
public async Task RunAsync(/* … */) { /* … */ }
```

This is exactly the lever the non-idempotent money job pulls in [Part 7](/deep-dives/production-patterns) — for a job that credits balances, an accidental retry is a double-payment, so it opts out of the curve entirely and owns its own exactly-once check.

### The rule: one layer owns long retries

Here's the mistake I want to inoculate you against now. You will have Polly retries on your HTTP clients (next section). You will have Hangfire's five-retry curve. If **both** layers do long retries, you get a *product*: 3 Polly retries × 5 Hangfire attempts = 15 real attempts against a struggling dependency, amplifying an outage into a self-inflicted DDoS.

The discipline: **Polly does 2–3 *short* retries** (sub-second, for the transient blip that heals in milliseconds). **Hangfire owns the *long* curve** (minutes to hours, for the outage that needs real time). Never both long. One layer owns the long retries; the other stays short and defers.

## The dead-letter queue

When a job exhausts its five retries, it lands in `FailedState` and stops. Left there, it's just a row in Hangfire's storage that expires and disappears — another silent death. We refuse that. Every final failure gets copied into a **durable, business-owned table** we control:

```sql
-- database/tables/jobs/dbo.JobDeadLetter.sql:29-89
CREATE TABLE dbo.JobDeadLetter
(
    Id               BIGINT             NOT NULL    IDENTITY(1,1),
    HangfireJobId    NVARCHAR(50)       NULL,       -- NULL for outbox rows poisoned pre-Hangfire
    SourceMessageId  UNIQUEIDENTIFIER   NULL,       -- outbox MessageId for pre-Hangfire deaths
    JobType          NVARCHAR(300)      NOT NULL,
    ArgsJson         NVARCHAR(MAX)      NULL,        -- snapshot → redrivable after Hangfire row expires
    ExceptionType    NVARCHAR(300)      NULL,
    ExceptionMessage NVARCHAR(4000)     NULL,
    ExceptionDetail  NVARCHAR(MAX)      NULL,
    AttemptCount     INT                NOT NULL    CONSTRAINT DF_JobDeadLetter_AttemptCount DEFAULT (0),
    FailureClass     TINYINT            NOT NULL    CONSTRAINT DF_JobDeadLetter_FailureClass DEFAULT (0),
    CorrelationId    NVARCHAR(64)       NULL,
    DeadLetteredUtc  DATETIME2(3)       NOT NULL    CONSTRAINT DF_JobDeadLetter_DeadLetteredUtc DEFAULT (SYSUTCDATETIME()),
    Status           TINYINT            NOT NULL    CONSTRAINT DF_JobDeadLetter_Status DEFAULT (0),
    -- … RedrivenBy / RedrivenUtc / RedriveOutcome / NewHangfireJobId …
    CONSTRAINT PK_JobDeadLetter PRIMARY KEY CLUSTERED (Id)
);
```

`FailureClass` is `0 TransientExhausted / 1 Permanent / 2 Poison`. `Status` is `0 Dead / 1 Redriven / 2 Resolved / 3 Discarded`. Crucially, `ArgsJson` is a *snapshot* — it survives long after Hangfire's own job row is purged, so you can redrive a job that died a week ago.

### Writing the row: an `IApplyStateFilter` on the final failure

How does a row get here? A Hangfire **state filter**. Every time a job's state is applied, our filter gets a callback; it acts only when the applied state is `FailedState` — which, because the retry filter elects `ScheduledState` while any budget remains, *only ever happens on the final failure*.

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/DeadLetter/JobDeadLetterFilter.cs:28-105
public sealed class JobDeadLetterFilter(
    IServiceScopeFactory scopeFactory,
    ILogger<JobDeadLetterFilter> logger) : IApplyStateFilter
{
    public void OnStateApplied(ApplyStateContext context, IWriteOnlyTransaction transaction)
    {
        if (context.NewState is not FailedState failedState)
            return;

        try
        {
            var entry = BuildEntry(
                context.BackgroundJob.Id, context.BackgroundJob.Job, failedState.Exception,
                retryCount: context.GetJobParameter<int>("RetryCount"),
                correlationId: SafeGetParameter(context, "CorrelationId"),
                createdAtUtc: context.BackgroundJob.CreatedAt);

            using var scope = scopeFactory.CreateScope();
            scope.ServiceProvider.GetRequiredService<IJobDeadLetterRecorder>()
                .RecordAsync(entry, CancellationToken.None)
                .GetAwaiter().GetResult();       // sync-over-async is deliberate: state filters are sync
        }
        catch (Exception ex)
        {
            // Losing the DLQ row is bad but wedging Hangfire's state machinery would be worse.
            logger.LogError(ex, "Dead-letter recording failed for Hangfire job {JobId}", context.BackgroundJob.Id);
        }
    }

    public void OnStateUnapplied(ApplyStateContext context, IWriteOnlyTransaction transaction) { }  // audit — never undone
```

Three details earn their place. `BuildEntry` maps the exception to a `FailureClass` — a `null` job or `JobLoadException` is `Poison` (the invocation couldn't even be deserialized), a `PermanentJobException` is `Permanent`, everything else is `TransientExhausted`. `OnStateUnapplied` is empty: a dead-letter record is an **audit fact**, never rolled back. And the whole thing is wrapped in a catch that only logs — losing a DLQ row is bad, but throwing here would wedge Hangfire's state machine, which is worse.

The actual INSERT is idempotent per death — a unique index on `HangfireJobId` means a raced double-transition can't write two rows:

```sql
-- database/stored-procedures/jobs/dbo.JobDeadLetterAdd.sql:34-69
INSERT INTO dbo.JobDeadLetter (HangfireJobId, SourceMessageId, JobType, /* … */)
VALUES (@HangfireJobId, @SourceMessageId, @JobType, /* … */);
SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS Id, CAST(0 AS BIT) AS AlreadyExisted;
-- BEGIN CATCH: IF ERROR_NUMBER() IN (2627, 2601) → return existing row + AlreadyExisted = 1
```

### Redrive is a fresh enqueue, never a mutation

When you fix the bug and want a dead job to run again, the rule is absolute: **you never mutate the dead job.** You *enqueue a brand-new job* from the snapshotted `ArgsJson`, and you write an audit trail onto the DLQ row (`Status → Redriven`, `RedrivenBy`, `NewHangfireJobId`). The dead row stays as the historical record of what happened; the redrive is a new event. Mutating in place destroys your only evidence and invites double-processing.

### Alerts fire on arrival — once

The recorder writes the row, then fans out to alert sinks — but only on a *genuinely new* arrival:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/DeadLetter/JobDeadLetterRecorder.cs:22-77
var added = await deadLetters.AddAsync(entry, ct);
if (added.AlreadyExisted)
    return added.Id;                       // already recorded + alerted by an earlier transition

// The ONE Error-level line per death — keeps Error 1:1 with dead-letter arrivals.
logger.LogError("JobDeadLettered {JobType} (class {FailureClass}, attempts {AttemptCount}, DLQ {DeadLetterId}) …");

foreach (var sink in alertSinks)
{
    using var sinkTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
    sinkTimeout.CancelAfter(TimeSpan.FromSeconds(10));   // per-sink budget; runs inside a sync state transition
    try { await sink.NotifyJobDeadLetteredAsync(alert, sinkTimeout.Token); }
    catch (Exception ex) { logger.LogError(ex, "Job alert sink {Sink} failed …"); }
}
```

Two sinks, deliberately independent. The **email** sink goes through `IEmailService` to an ops mailbox and carries the exception message (internal recipient, safe). The **webhook** sink is the SMTP-independent channel — a single POST carrying Slack's `text` and Discord's `content` in one body, exception **type only**, never the message or stack (a third-party target; messages can embed PII). If SMTP is the very thing that's down, the webhook still pages you. Each sink gets a 10-second budget because this runs *inside* Hangfire's synchronous state transition.

## Resilience: the timeout ladder

Retry classification handles *failures*. But the nastier problem is a dependency that neither succeeds nor fails — it just **hangs**. In [Part 1](/deep-dives/why-background-jobs) the villain was an SMTP client on its 100-second unconfigured default timeout, holding a request thread hostage the entire time. A timeout is not a nicety; it's the thing that converts an infinite hang into a finite, classifiable failure.

So every downstream call sits inside a nested ladder of bounds, inside → out: an HTTP attempt timeout (20s), then a total HTTP budget of 90s across three retries, then the job's wall-clock via a linked CTS, then Hangfire's retry curve (60s→2h ×5), and finally the dead-letter with its alert. The HTTP layers are pure Polly, via .NET's standard resilience handler:

```csharp
// src/Infrastructure/Partners.Infrastructure/DependencyInjection.cs:389-409
services.AddHttpClient<IFileUploadService, BunnyCDNFileUploadService>(client =>
    {
        // Per-request hard cap MUST be above the resilience handler's TotalRequestTimeout
        // (90s) — otherwise HttpClient.Timeout would short-circuit retries …
        client.Timeout = TimeSpan.FromSeconds(120);
    })
    .AddStandardResilienceHandler(options =>
    {
        options.Retry.MaxRetryAttempts = 3;
        options.Retry.Delay = TimeSpan.FromMilliseconds(500);
        options.AttemptTimeout.Timeout = TimeSpan.FromSeconds(20);
        options.TotalRequestTimeout.Timeout = TimeSpan.FromSeconds(90);
        // SamplingDuration must be >= 2x AttemptTimeout (Polly invariant) … set to 60s (3x).
        options.CircuitBreaker.SamplingDuration = TimeSpan.FromSeconds(60);
    });
```

Note the ordering constraint that's easy to get wrong: `HttpClient.Timeout` (120s) must sit **above** `TotalRequestTimeout` (90s). Get it backwards and `HttpClient` short-circuits Polly mid-retry — the retries you configured never actually run. Those Polly retries are the *short* ones (500ms, 3 attempts) from the "one layer owns long retries" rule; the long curve is Hangfire's.

`AddStandardResilienceHandler` also brings a **circuit breaker per downstream**. When a dependency is clearly down, the breaker opens and every call fails *instantly* — the job fails fast, and Hangfire reschedules it onto the long curve to try again in a minute. You never sleep a worker on an open circuit. The QuestPDF client and the payments client (60s / 3 retries / 15s attempt / 50s total) mirror the same ladder.

And the fix that started it all: MailKit now ships an explicit `SmtpOptions.TimeoutSeconds` of 30s. The unconfigured 100s default that held a thread hostage is gone.

![The nested timeout ladder — each layer's deadline is larger than the one it wraps, so a hang is caught at the tightest level and escalates outward to a dead-letter.](/figures/background-job-timeout-ladder.svg)

## The mistakes — so you don't get paged at 3am

1. **Retrying a permanent failure.** A validation error or a 404 will fail identically five times over four hours. Throw `PermanentJobException` at the boundary the moment you know retrying can't help — it lands in the DLQ immediately, classified `Permanent`, with a human alerted.

2. **Swallowing exceptions.** `catch (Exception ex) { ex.ToString(); }` is the failure that was invisible since 2024. Every catch must either rethrow (let the retry/DLQ machinery run) or log at Error *and* record the death. Silent success on a real failure is the worst outcome in the system.

3. **Two layers both doing long retries.** Polly's 3 × Hangfire's 5 = 15 real attempts hammering a struggling dependency. Keep Polly short (sub-second), let Hangfire own the long curve. One layer, one long retry budget.

4. **Alerting on every attempt instead of the final failure.** If you page on attempt 1, a transient blip that self-heals on attempt 2 still wakes you up — and you'll train yourself to ignore the channel. Alerts fire once, on **arrival in the DLQ**. Keep your Error-log count 1:1 with dead-letter arrivals; a retryable attempt is a Warning, not an Error.

5. **Mutating the dead job to redrive it.** Enqueue a fresh job from the snapshot and stamp the audit fields. The dead row is your evidence — never overwrite it.

## Recap / cheat-sheet

```text
FAILURE HANDLING — THE 30-SECOND MODEL
────────────────────────────────────────────────────────
CLASSIFY (at the provider boundary)
  PermanentJobException  → 4xx / validation / poison → DON'T retry
  TransientJobException  → 408/429/5xx/socket/DNS/timeout → retry
  (unclassified)         → treated as transient (safe default)
  ⚠ SQL-error-number matcher = design intent, NOT shipped code

RETRY (global, one place)
  AutomaticRetry: Attempts=5 → 5 retries / 6 runs, [60,300,1800,7200]s (last reused)
  ExceptOn = [PermanentJobException]   OnAttemptsExceeded = Fail
  Per-job override: [AutomaticRetry(Attempts=0)] — closest wins

DEAD-LETTER (on FINAL FailedState only)
  IApplyStateFilter → dbo.JobDeadLetter (durable, ArgsJson snapshot)
  Idempotent INSERT (unique HangfireJobId) → alert ONCE on arrival
  Redrive = NEW enqueue + audit row. NEVER mutate the dead job.

RESILIENCE LADDER (inside → out)
  HTTP attempt 20s → total HTTP 90s (Polly, 3 short retries)
    → job wall-clock (linked CTS) → Hangfire curve → DLQ
  Circuit breaker per downstream: open → fail fast → reschedule
  ⚠ HttpClient.Timeout > TotalRequestTimeout, or retries short-circuit
────────────────────────────────────────────────────────
```

## Where this leaves us

Every job now retries only what's worth retrying, dies loudly and durably when it can't, and pages a human exactly once — over a channel that survives its own dependencies going down. What we *haven't* addressed is who's allowed to enqueue in the first place, and how we watch the whole system in aggregate. That's next: [Part 6](/deep-dives/security-and-observability) covers "write access to job storage = RCE," the SQL-login split, and the OpenTelemetry gauges — including the flagship oldest-unprocessed-outbox-age signal.

See the full arc in [the series index](/deep-dives).

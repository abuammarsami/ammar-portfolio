---
title: "The Job Contract — Idempotency, Kill Switches, and the 'Runs Twice' Rule"
series: background-jobs
order: 3
summary: "Why every background handler must survive running at least twice, and the exact shape — message, runner, binding — that makes that convergence structural."
readingMinutes: 14
date: 2026-07
tags: [dotnet, background-jobs, idempotency, reliability, sql-server]
status: active
---

## The rule that reframes everything

Here is the sentence I made the team repeat until it was boring: **every handler will run at least twice, possibly concurrently on two nodes, and must converge.**

Not "might, in a rare failure." *Will.* In [Part 2](/deep-dives/the-worker-host) we set `SlidingInvisibilityTimeout` to five minutes — which means a worker that dies mid-job leaves that job re-fetchable, and *someone else picks it up*. That is not a bug we're tolerating; it is the at-least-once delivery contract we deliberately chose. The moment you accept at-least-once delivery — and every durable queue on SQL Server, Hangfire included, is at-least-once — "run the handler once" stops being something the infrastructure can promise you. It becomes something *your handler* has to guarantee. A job that isn't idempotent isn't done. It's a latent double-charge, a duplicate email, a CDN orphan waiting for the retry that will surely come.

This part is about the shape that makes convergence structural rather than hopeful. It's small — a message, a runner, a binding — but every line is load-bearing.

## What you'll build in this part

The uniform contract every job in the system obeys, and the two mechanisms that keep it honest:

- **The message / runner / binding trio** — a tiny record of primitive IDs, a `sealed` scoped runner, an interface-typed enqueue.
- **A fail-closed kill switch** as the *first line* of every runner.
- **A job-effect idempotency marker** (`dbo.JobProcessedMessage`) with a unique-index claim that catches duplicate inserts as a no-op.
- **The email-specific check-first / claim-after-send ordering** — duplicates over loss, on purpose.
- The distinction between this (job-effect idempotency) and **ADR-0008's HTTP-request idempotency**, and how they compose.
- A **unit test** that proves all three: toggle-off, send-then-claim ordering, and throw-never-claim.

## The job contract, from zero

A background job in this system is three things, and never more:

**The message.** A small serializable record carrying **primitive IDs only** — no DTOs, no entities, and absolutely no secrets or PII. The reason is concrete: job arguments sit in the database and render in the dashboard **as plaintext**. Put an email token in there and you've written a single-use credential to a table four SQL logins can read and printed it on an ops web page. So the message carries three things and defers the rest: a `MessageId` (a GUID for transport dedup), the **natural idempotency key**, and a `CorrelationId` to stitch the trace together. Everything else — the user's email, the confirmation token — gets *fetched or regenerated at execution time*.

**The runner.** A `sealed`, scoped class built over Application-layer interfaces, exposing a `Task RunAsync(message, CancellationToken)`-shaped method. Sealed because a job handler is not an extension point; scoped because it gets a fresh DI scope per execution.

**The binding.** You enqueue against **interfaces**, never concrete types — `Enqueue<IEmailJobs>(x => x.SendWelcome(userId, ct))`. The implementation can move freely; the interface + method + parameter list is a *public API*, additive-only, never renamed while jobs are in flight (a renamed method orphans every serialized job already in storage).

The logical name of each job is versioned and centralized, so a payload shape change is a new version rather than a silent break:

```csharp
// src/Core/Partners.Application/Common/Jobs/JobTypes.cs:13-33
public static class JobTypes
{
    public const string PartnerVerificationEmail = "email.partner-verification.v1";  // via outbox
    public const string PasswordResetEmail       = "email.password-reset.v1";        // direct 1-critical
    public const string PartnerDocsUpload        = "partner-docs.upload.v1";         // via outbox
    public const string AdImageProcess           = "ads.image-process.v1";           // direct, 3-bulk
    public const string CvPdf                    = "pdf.cv.v1";                       // direct, 2-default
}
```

The `.v1` is not decoration. When the payload contract changes, you ship `.v2` and keep `.v1` running until the old rows drain — because there is no "stop the world" moment where storage is empty.

![The job contract — an id-only message, a runner that checks its kill switch and idempotency marker before doing work, bound through an interface.](/figures/background-job-contract.svg)

## The runner skeleton, real code

Here is `EmailJobRunner` — the representative shape every runner follows. Read it top to bottom; the *ordering* is the design.

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/Email/EmailJobRunner.cs:31-103
public sealed class EmailJobRunner(
    IJobIdempotencyRepository idempotency,
    IAuthRepository authRepo,
    IEmailService emailService,
    IAppUrlBuilder appUrlBuilder,
    ILogger<EmailJobRunner> logger)
{
    private const string VerificationHandler = JobTypes.PartnerVerificationEmail;

    [Queue(JobQueues.Critical)]
    public async Task SendPartnerVerificationAsync(
        Guid messageId, string userId, string roleCode, string countryCode, CancellationToken ct)
    {
        var key = messageId.ToString("N");

        if (await idempotency.IsProcessedAsync(VerificationHandler, key, ct))
        {
            logger.LogInformation(
                "Partner-verification email already processed (message {MessageId}) — skipping duplicate",
                messageId);
            return;
        }

        var user = await authRepo.FindByIdAsync(userId, ct);
        if (user is null) return;                 // deleted since enqueue → no-op, NOT an error
        if (user.EmailConfirmed) return;          // already confirmed since enqueue → no-op

        // Regenerate the single-use token at SEND time — never stored in the job payload.
        var emailToken = await authRepo.GenerateEmailConfirmationTokenAsync(userId, ct);
        var verificationUrl = appUrlBuilder.EmailVerificationUrl(callbackPath, userId, emailToken, countryCode);

        await emailService.SendPartnerRegistrationVerificationAsync(
            user.Email, displayName, partnerDisplay, verificationUrl, ct);

        // Claim AFTER the send: a crash in the tiny send→claim window yields at worst a DUPLICATE
        // email on redelivery. Duplicates over loss. CancellationToken.None so a disconnect can't skip it.
        await idempotency.TryClaimAsync(VerificationHandler, key, CancellationToken.None);
    }
}
```

Notice what the message carries (`messageId`, `userId`, `roleCode`, `countryCode` — all primitives) and what it does *not*: the email address and the token are both produced inside the handler, at execution time. The token is regenerated so a stale single-use credential never lives in `[HangFire]` storage. Notice too the two `return` paths for "user deleted" and "already confirmed" — those are **no-ops, not errors**. A job that discovers its work is already unnecessary succeeds quietly; it does not page anyone.

For the two Phase-C runners (image watermark, CV PDF) the same skeleton is factored into a template-method base — load (null means idempotent no-op), work, mark-failed-on-final-attempt, rethrow into the dead-letter path:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/StagedJobRunnerBase.cs:37-118
protected async Task RunAsync(Guid id, PerformContext? context, CancellationToken ct)
{
    var row = await LoadAsync(id, ct);
    if (row is null) { logger.LogInformation(NoOpMessageTemplate, id); return; }  // swept → no-op

    try { await WorkAsync(id, row, ct); }
    catch (OperationCanceledException) when (ct.IsCancellationRequested)
    {
        throw;                                    // shutdown drain — requeue, not a failure
    }
    catch (Exception ex)
    {
        if (ShouldMarkFailed(retryCount, ex))
            await MarkFailedAsync(id, Describe(ex), CancellationToken.None);   // flip row FIRST
        throw;                                    // rethrow → DLQ filter records + alerts
    }
}
```

Different work, identical shape: peek/load first, converge on "already done" to a no-op, and let the failure classification (which we build in [Part 5](/deep-dives/when-jobs-fail)) decide what to do on the way out.

## Kill switch: the first line of every runner

Before any runner does work, it checks whether it's *allowed* to. And the design of that check is the whole point:

```csharp
// src/Core/Partners.Application/Common/Options/JobSystemOptions.cs:149-175
public Dictionary<string, bool> Toggles { get; init; } = new(StringComparer.OrdinalIgnoreCase);

public bool IsJobEnabled(string jobKey, bool defaultEnabled = true) =>
    Toggles.TryGetValue(jobKey, out var enabled) ? enabled : defaultEnabled;
```

Read that helper carefully. If the key is *present*, its value wins. If the key is *missing*, the **caller's own default** applies. Ordinary jobs call `IsJobEnabled(id)` and default to enabled — a missing toggle means "run normally." But the dangerous jobs — the boost-expiry sweep and the three legacy-scheduler jobs (one of which moves real money) — call `IsJobEnabled(id, defaultEnabled: false)`. For those, a **missing or misspelled config key can never accidentally start the job.** That is fail-closed: the safe state is the default, and you have to *explicitly* type `true` to turn a money job on.

This matters more than it looks. Config keys get typo'd. A `Jobs:Toggles:legacy-partner-benfits` (note the missing `i`) on a fail-*open* job silently enables a real-balance credit run. On a fail-closed job, that same typo leaves it off — exactly where you want a non-idempotent money job to sit until a human deliberately flips it. We rely on precisely this in the [Part 7](/deep-dives/production-patterns) legacy cutover.

The toggles are read through `IOptionsMonitor`, so editing config **pauses a job class without a redeploy**. A disabled *recurring* job still ticks on schedule — it just hits the check and immediately no-ops. That's the emergency brake: flip a key, the next tick logs a skip and returns, no deploy, no restart.

## Idempotency mechanics: the marker table

The convergence guarantee is backed by a two-column marker table with a composite primary key:

```sql
-- database/tables/jobs/dbo.JobProcessedMessage.sql:32-51
CREATE TABLE dbo.JobProcessedMessage
(
    HandlerName  NVARCHAR(200)  NOT NULL,
    MessageKey   NVARCHAR(300)  NOT NULL,
    ProcessedUtc DATETIME2(3)   NOT NULL DEFAULT (SYSUTCDATETIME()),

    CONSTRAINT PK_JobProcessedMessage PRIMARY KEY CLUSTERED (HandlerName, MessageKey)
);
```

`(HandlerName, MessageKey)` is the key. The handler name scopes it, so the same message ID can be processed by two *different* handlers without collision, and the second run of the *same* handler with the *same* key collides. The claim SP leans entirely on that constraint — it inserts first and treats a uniqueness violation as "already processed":

```sql
-- database/stored-procedures/jobs/dbo.JobProcessedMessageTryClaim.sql:14-40
BEGIN TRY
    INSERT INTO dbo.JobProcessedMessage (HandlerName, MessageKey)
    VALUES (@HandlerName, @MessageKey);
    SELECT CAST(0 AS BIT) AS AlreadyProcessed;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() IN (2627, 2601)     -- constraint AND unique-index: catch BOTH
    BEGIN
        SELECT CAST(1 AS BIT) AS AlreadyProcessed;
        RETURN;
    END
    ;THROW;
END CATCH
```

The detail that bites people who write this from memory: **you must catch both 2627 and 2601.** `2627` is a PRIMARY KEY / UNIQUE *constraint* violation; `2601` is a duplicate key on a unique *index*. They are not interchangeable — which one you get depends on how the uniqueness was declared — and a claim that only catches `2627` will throw on a table whose dedup is an index, turning your idempotency guard into a source of spurious failures. Catch both, or your "converge on duplicate" quietly becomes "crash on duplicate."

There's also a read-only companion — a pure `EXISTS` peek with no insert:

```sql
-- database/stored-procedures/jobs/dbo.JobProcessedMessageExists.sql:14-31
SELECT CAST(CASE WHEN EXISTS (
    SELECT 1 FROM dbo.JobProcessedMessage
    WHERE HandlerName = @HandlerName AND MessageKey = @MessageKey
) THEN 1 ELSE 0 END AS BIT) AS AlreadyProcessed;
```

That peek is what makes the email ordering possible.

## Check-first / claim-after-send: duplicates over loss

Look back at `EmailJobRunner`. It **peeks** (`IsProcessedAsync` → `Exists`), then **sends**, then **claims** (`TryClaim`). It does *not* claim before sending. That ordering is a deliberate choice, and it's specific to email.

Think about the two ways to be wrong. If you **claim before you send** and the process dies in the gap, the marker says "done" but no email went out — the retry peeks, sees the claim, and no-ops. The user never gets their verification email. That's **silent loss.** If you **send before you claim** and die in the gap, the email went out but the marker wasn't written — the retry re-sends. The user gets *two* verification emails. That's a **duplicate.**

For email specifically, a duplicate is a minor annoyance and a lost message is a broken signup flow. So we send first and accept that a crash in the tiny send→claim window costs a duplicate email. **Duplicates over loss.** (Note the `CancellationToken.None` on the claim — a client disconnect must not skip writing the marker after the mail already went out.)

This is not the universal answer — a job that *charges a card* wants the opposite bias, and ideally a provider-side idempotency key so even a duplicate attempt converges to one charge. The other tool in the box is **deterministic external keys**: the image and partner-doc pipelines write to *content-addressed CDN paths*, so re-running the watermark overwrites the same object instead of creating a second one. When the external effect is naturally idempotent by key, you don't even need the marker. Pick the bias per job; email's is duplicates-over-loss.

## Two idempotency layers, and they compose

Here's the distinction the design flags explicitly, because conflating them is a classic mistake. There are **two** idempotency mechanisms in this system, at two different levels:

| | Job-effect level (this part) | HTTP-request level (ADR-0008) |
|---|---|---|
| Table | `dbo.JobProcessedMessage` | `dbo.IdempotencyKey` |
| Keyed by | `(HandlerName, MessageKey)` | `(UserId, Idempotency-Key)` |
| Stops | a job from *doing its effect twice* | a client retry from *enqueuing twice* |
| Where | inside the runner | MediatR pipeline, before the handler |

`dbo.IdempotencyKey` sits in the request pipeline. When a mobile client fires "submit," loses the network, and retries with the same `Idempotency-Key` header, the `IdempotencyBehavior` replays the *original cached response* instead of running the handler again — so the enqueue never happens twice in the first place:

```csharp
// src/Core/Partners.Application/Common/PipelineBehaviors/IdempotencyBehavior.cs:43-124 (trimmed)
var existing = await repository.GetAsync(request.UserId, request.IdempotencyKey, ct);
if (existing is not null)
    return ReplayOrThrow(existing, hash, request.IdempotencyKey);   // fast path: replay, no re-run
// … distributed lock, re-check, then next(ct) exactly once, then cache the response …
```

They **compose**: ADR-0008 stops the *duplicate enqueue*; `JobProcessedMessage` stops the *duplicate effect* if a duplicate slips through anyway (retry, redelivery, two nodes racing). Belt and suspenders — and you want both, because the HTTP layer can't help you once the job is already in storage and the sliding-invisibility timeout hands it to a second worker. This part owns the job side; that's where at-least-once actually bites.

## Prove it with a test

Idempotency you haven't tested is idempotency you're guessing at. `EmailJobRunnerTests` asserts all three invariants explicitly:

```csharp
// tests/Partners.Infrastructure.Tests/Jobs/EmailJobRunnerTests.cs:45-118 (trimmed)
[Fact]
public async Task Verification_AlreadyProcessed_DoesNotSendOrClaim()
{
    _idempotency.IsProcessedAsync("email.partner-verification.v1", key, Arg.Any<CancellationToken>())
        .Returns(true);
    await MakeRunner().SendPartnerVerificationAsync(messageId, "user-1", UserRole.CityPartner, "BD", ct);

    await _emailService.DidNotReceive().SendPartnerRegistrationVerificationAsync(…);
    await _idempotency.DidNotReceive().TryClaimAsync(…);
    await _authRepo.DidNotReceive().FindByIdAsync(…);       // a no-op skip must not even touch the DB
}

[Fact]
public async Task Verification_HappyPath_SendsThenClaims_InThatOrder()
{
    Received.InOrder(() =>                                   // send BEFORE claim — the whole ballgame
    {
        _emailService.SendPartnerRegistrationVerificationAsync(…);
        _idempotency.TryClaimAsync("email.partner-verification.v1", key, Arg.Any<CancellationToken>());
    });
}

[Fact]
public async Task Verification_SendThrows_ExceptionPropagates_AndNeverClaims()
{
    // send throws → propagates → Hangfire retries; claim-after-send means the marker is NOT written,
    // so the retry actually re-sends instead of no-opping on a stale claim.
    await act.Should().ThrowAsync<InvalidOperationException>();
    await _idempotency.DidNotReceive().TryClaimAsync(…);
}
```

Three assertions, three invariants: the guard short-circuits without touching the database; the happy path sends *then* claims in that order; and a failed send **never** writes the marker, so the retry genuinely re-sends. The last one is the whole reason claim-after-send is safe — if a throw could leave a claim behind, a transient SMTP hiccup would permanently suppress the email. The run-twice-one-effect invariant at the SQL level is proven separately by a Testcontainers integration test that exercises the real unique-index dedup.

## The mistakes

**1. Claiming before the effect on a non-transactional side effect.** If your external effect (send, PUT, charge) can't share a transaction with the marker write, claiming first converts every crash into *silent loss*. Decide the bias explicitly. For email we send first and eat the occasional duplicate. Writing the marker "for safety" up front is how signups silently stop arriving.

**2. Catching only error 2627.** `2601` (unique *index* violation) is a different number from `2627` (unique *constraint* violation). Catch only one and your idempotency guard throws on exactly the duplicate it was built to absorb.

**3. Fail-*open* kill switches.** `IsJobEnabled(id)` defaulting to `true` is fine for a welcome email and catastrophic for a balance-credit job. A typo'd or absent config key should leave a money job **off**. Hard-code `defaultEnabled: false` on anything you'd hate to run by accident.

**4. Fat payloads.** Serialize a DTO — or worse, a token — into a job argument and you've written it in plaintext to a table and a dashboard. Pass IDs; fetch or *regenerate* the sensitive parts at execution time, like the runner regenerates the confirmation token.

**5. Treating "already done" as an error.** User deleted since enqueue? Already confirmed? Row already swept? Those are **no-ops that succeed**, not failures. Throw on them and you'll dead-letter and page on jobs that did exactly the right thing: nothing.

## Recap

```text
┌─────────────────────────────────────────────────────────────┐
│  THE JOB CONTRACT — every job, no exceptions                 │
├─────────────────────────────────────────────────────────────┤
│  MESSAGE   primitive IDs only — MessageId + key + Correlation│
│            NO DTOs, NO secrets (args are plaintext in DB/UI) │
│  RUNNER    sealed, scoped, RunAsync(msg, ct)                 │
│  BINDING   enqueue against interfaces (public API, add-only) │
├─────────────────────────────────────────────────────────────┤
│  LINE 1    IsJobEnabled(id, defaultEnabled:false for money)  │
│            fail-closed · IOptionsMonitor hot-reload          │
│  IDEMPOTENT  peek → do effect → claim  (duplicates over loss)│
│            marker = (HandlerName, MessageKey) unique PK      │
│            claim SP catches 2627 AND 2601 as no-op           │
├─────────────────────────────────────────────────────────────┤
│  TWO LAYERS  JobProcessedMessage = effect-level (this part)  │
│              IdempotencyKey (ADR-0008) = request-level       │
│              → they compose; you want both                   │
├─────────────────────────────────────────────────────────────┤
│  THE RULE  runs ≥ twice, maybe on two nodes, must converge   │
└─────────────────────────────────────────────────────────────┘
```

## Where this leaves us

We now have a job that survives running twice — but we haven't yet closed the gap *before* the job exists: the enqueue itself can still be lost or ghosted if it isn't atomic with the state change it follows. In [Part 4](/deep-dives/the-outbox) we build the transactional outbox that makes delivery genuinely at-least-once, which is the very promise this part's idempotency was written to survive.

See the full map in [the series index](/deep-dives); the code is from [Partners.com.bd](/work/background-job-system).

---
title: "Production Patterns — Async Image Uploads (202 + Poll) and Retiring a Legacy Scheduler Without Double-Paying Anyone"
series: background-jobs
order: 7
summary: "The UX-visible payoff of the whole scaffold, and the legacy-scheduler cutover war story — a non-idempotent money job — that justifies every part's caution."
readingMinutes: 16
date: 2026-07
tags: [dotnet, hangfire, background-jobs, idempotency, reliability]
status: active
---

## Two patterns that make the whole scaffold worth it

For six parts I've been building plumbing you can't see: a worker host, a job contract, an outbox, dead-letters, retries, an allow-list, gauges. Necessary, invisible. This part is the payoff — two real patterns from [Partners.com.bd](/work/background-job-system) that put the scaffold to work, one that users can *feel* and one that would have quietly cost us money if we'd been careless.

The first: image uploads used to `await` a watermark + resize inline on the POST. On a slow mobile connection you were watching a spinner while ImageSharp burned a CPU core on a server thread you were holding open. The fix moves the pixels off the request — but the trap is that a few hundred thousand installed app builds still speak the old synchronous contract. The second is uglier: while auditing "stray Hangfire tables," I found a **live** standalone scheduler nobody owned, running three recurring jobs — one of which **credits real user balances and is not idempotent** — behind a public dashboard secured with `admin` / `123`. Retiring it is where every reliability lesson in this series gets cashed in at once.

**What you'll build:**

- A **v2 image surface** that returns `202 Accepted` + a status-polling endpoint, while **v1 stays synchronous** for old clients — plus the direct-enqueued `ImageProcessJobRunner` and the reconciler that closes its one crash window.
- A **legacy-scheduler cutover runbook** where *ordering is the safety mechanism*: the non-idempotent money job pins `Attempts = 0`, and nothing but sequencing prevents a double-credit.

---

## Pattern A — async image uploads without breaking installed apps

### The problem, precisely

The old path was: `POST /api/v1/ads/images` → validate → watermark + BlurHash + WebP variants → PUT to CDN → `200 { cdnUrl }`. Every one of those steps ran before the response byte. The watermark is CPU work (`3-bulk` in [our queue scheme](/deep-dives/the-worker-host)); the CDN PUT is IO. The user's phone held the connection open for all of it. That's the exact "wrong place" failure mode [Part 1](/deep-dives/why-background-jobs) opened with, except now the wrong place is a multipart upload on a flaky LTE connection.

Moving the work to a job is easy — you learned how in Parts 3–5. The hard part is the **contract**. A synchronous 200 that carries a `cdnUrl` is a promise a few hundred thousand installed builds already depend on. You cannot make `POST /images` return 202 tomorrow; you'll strand every phone that hasn't updated.

So we didn't. We shipped a **new `/api/v2/ads/images` surface**. v1 keeps its synchronous 200, byte-for-byte, forever (until telemetry says the old clients are gone). v2 speaks async. Same backend work, two front doors.

### The v2 controller: 202 on POST, capped batch on status

```csharp
// src/Presentation/Partners.Api/Controllers/v2/Ads/AdImagesV2Controller.cs:24-94 (abridged)
[ApiController]
[Route("api/v2/ads/images")]
[Authorize]
public sealed class AdImagesV2Controller(IMediator mediator) : ControllerBase
{
    [HttpPost]
    [EnableRateLimiting("uploads")]                       // 10/min per user (server-side image work)
    [RequestSizeLimit(MaxUploadRequestBytes)]             // 115 MB = 10 images × 10MB + headroom
    [ProducesResponseType(typeof(ApiResponse<UploadAdImagesV2Response>), 202)]
    public async Task<IActionResult> Upload([FromForm] int categoryId, [FromForm] List<IFormFile> files, CancellationToken ct)
    {
        var uploadItems = files.Select(f => new FileUploadItem
        {
            FileStream = f.OpenReadStream(), FileName = f.FileName, FileSizeBytes = f.Length
        }).ToList();

        var result = await mediator.Send(
            new UploadAdImagesV2Command { UserId = User.GetUserId(), CategoryId = categoryId, Files = uploadItems }, ct);

        // 202 preserves the async contract even when the work happened to run inline (items 'ready').
        return result.IsSuccess ? StatusCode(StatusCodes.Status202Accepted, result) : BadRequest(result);
    }

    [HttpGet("status")]
    [EnableRateLimiting("authenticated")]                 // 300/min — the poll endpoint, hit every 2s
    public async Task<IActionResult> Status([FromQuery] string? ids, CancellationToken ct)
    {
        switch (AdImageV2Contract.ParseStatusIds(ids, out var distinct))
        {
            case AdImageV2Contract.StatusIdsParse.Invalid:    // a non-GUID token → 400
                return BadRequest(ApiResponse<AdImageStatusResponse>.Fail(
                    "VALIDATION", "Query parameter 'ids' is required and must be comma-separated GUIDs.", "ids"));
            case AdImageV2Contract.StatusIdsParse.TooMany:    // over 20 DISTINCT ids → 422
                return UnprocessableEntity(ApiResponse<AdImageStatusResponse>.Fail(
                    "TOO_MANY_IDS", $"At most {AdImageV2Contract.MaxStatusIds} ids may be requested per call.", "ids"));
        }

        var result = await mediator.Send(new GetAdImageStatusQuery { UserId = User.GetUserId(), Ids = distinct }, ct);
        Response.Headers.CacheControl = "no-store";           // never cache a poll response
        return result.IsSuccess ? Ok(result) : BadRequest(result);
    }
}
```

The POST body: `202 { images:[{ pendingImageId, status:"processing", expiresAt, cdnUrl:null, blurHash:null }], statusUrl:"/api/v2/ads/images/status", retryAfterSeconds:2 }`. Three details earn their keep:

1. **The 202 is unconditional, even when the work ran inline.** There's a rollback flag (`Jobs:ImageAsyncEnabled`) that makes v2 process synchronously — but it still returns the 202 shape with items already `ready`. The client never branches on "did the server go async today?" The *shape* is the contract, not the timing.
2. **The status batch is capped at 20 distinct ids, and over-cap is a 422, not a truncation.** A phone with 10 tiles asks about 10 ids. Twenty is generous headroom. Silently trimming a 500-id request would hide a client bug; a loud 422 surfaces it.
3. **`Cache-Control: no-store` on every poll.** A poll response is the most stale-able thing in the system — cache it once and a tile shows "processing" forever.

### The runner: direct-enqueued, its own retry curve, one crash window

The watermark job does *not* go through [the outbox](/deep-dives/the-outbox). The outbox exists to make enqueue atomic with a business-DB commit. Here there's no business row to couple to — the bytes are already staged privately on `dbo.PendingImageUpload` before we enqueue, so we enqueue directly:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/Ads/ImageJobScheduler.cs:13-23
public Task ScheduleImageProcessingAsync(Guid pendingImageId, CancellationToken ct)
{
    // Primitive-id payload only — the runner re-loads the staged bytes at execution time.
    client.Enqueue<ImageProcessJobRunner>(r => r.ProcessAsync(pendingImageId, null!, CancellationToken.None));
    return Task.CompletedTask;
}
```

The runner (`ads.image-process.v1`, on `3-bulk`) overrides the process-global 5-attempt retry curve with a short, tight one — an image that fails four times in 22 seconds isn't coming back, and the user is *watching*:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/Ads/ImageProcessJobRunner.cs:51-134 (abridged)
[Queue(JobQueues.Bulk)]
[AutomaticRetry(                                    // OVERRIDES the global 5-attempt curve
    Attempts = MaxRetryAttempts,                    // = 3 (2s → 5s → 15s)
    DelaysInSeconds = new[] { 2, 5, 15 },
    OnAttemptsExceeded = AttemptsExceededAction.Fail,
    ExceptOn = new[] { typeof(PermanentJobException) })]
public Task ProcessAsync(Guid pendingImageId, PerformContext? context, CancellationToken ct) =>
    RunAsync(pendingImageId, context, ct);          // shared StagedJobRunnerBase skeleton

protected override async Task WorkAsync(Guid id, PendingImageProcessingRow row, CancellationToken ct)
{
    var preset = AdImagePresetFactory.Build(adImageOptions.Value, includeBlurHash: true);
    using var source = new MemoryStream(row.Content, writable: false);

    var processed = await imageProcessor.ProcessAsync(source, preset, ct);
    if (!processed.IsSuccess || processed.Variants.Count == 0)
        throw new PermanentJobException($"Ad image {id} could not be processed: {processed.ErrorMessage}");

    var variant = processed.Variants[0];
    await using var content = variant.Content;
    var put = await fileUpload.UploadToPathAsync(content, row.CdnPath, ct);   // deterministic key
    if (!put.IsSuccess)
        throw new InvalidOperationException($"CDN PUT failed for ad image {id}: {put.ErrorMessage}");

    var marked = await repository.MarkReadyAsync(
        id, processed.BlurHash!, variant.Width, variant.Height, content.Length, CancellationToken.None);

    if (!marked)  // 0 rows AFTER a successful PUT = the user withdrew mid-flight → delete the orphan
    {
        try { await fileUpload.DeleteAsync(row.CdnPath, CancellationToken.None); }
        catch (Exception ex) { Logger.LogWarning(ex, "orphaned CDN object cleanup failed for {PendingImageId}", id); }
    }
}
```

Method-level `[AutomaticRetry]` beats the global filter — the override rule from [Part 5](/deep-dives/when-jobs-fail). A malformed image throws `PermanentJobException` and skips retries entirely (garbage bytes won't decode on the third try either). Status lives on one column, `dbo.PendingImageUpload.ProcessingStatus` (`0 Processing / 1 Ready / 2 Failed`) — **no batch table**. The migration lands it `DEFAULT 1`, so every pre-existing row is `Ready` with no backfill.

**The one crash window.** Direct enqueue means: stage bytes, `MarkProcessing`, then `client.Enqueue`. If the process dies *between* the status write and the enqueue landing in `[HangFire]`, that row is stuck at `Processing` with no job coming for it. The outbox would have covered this; direct enqueue doesn't. So a daily reconciler sweeps it:

```sql
-- database/stored-procedures/ads/dbo.PendingImageUploadReconcileStuckProcessing.sql:23-43
UPDATE TOP (@BatchSize) dbo.PendingImageUpload
SET ProcessingStatus = 2,
    LastProcessError = N'STUCK_PROCESSING: reconciled by JobsMaintenance — row never completed watermarking (enqueue-crash window or lost worker).',
    Content          = NULL
OUTPUT inserted.PendingImageId,
       CASE WHEN inserted.CommittedAt IS NOT NULL THEN 1 ELSE 0 END AS WasCommitted,
       inserted.AllPostId
WHERE ProcessingStatus = 0
  AND UploadedAt < @Cutoff;
```

A row stuck `Processing` past the threshold becomes `Failed` — the tile flips to a retryable failure instead of spinning forever. That's the honest tradeoff for skipping the outbox: you accept a rare stuck row and you *build the sweep that finds it*.

### The full flow

The mobile UX rules that fall out of this:

- **Keep the local-file preview.** The tile already holds the picked image in memory — show *that* while `processing`. The user never stares at a blank box.
- **Poll only while a tile is `processing`.** The moment every tile is `ready` or `failed`, stop. That's why the endpoint is rate-limited at 300/min, not 10 — polling is cheap and self-terminating.
- **Publish while processing; block only on `failed`.** A user can hit "Post" with tiles mid-watermark — the commit gate only rejects `ProcessingStatus = 2`. Public rendering serves the BlurHash placeholder until `Ready`, so no unwatermarked bytes are ever publicly addressable.

---

![Async image upload — POST returns 202 immediately, the watermark runs on the bulk queue, and the app polls a status endpoint until each tile is ready.](/figures/background-job-image-pipeline.svg)

## Pattern B — retiring a legacy scheduler without double-paying anyone

### The discovery

Back in [Part 2](/deep-dives/the-worker-host) I mentioned "stray `dbo` Hangfire tables" — job-storage tables sitting in the wrong schema. The convenient story was that they were dead, left over from an experiment. They were not. They were the **live** storage of a standalone .NET 6 Hangfire app, `Schedule.partners.com.bd`, deployed on the same Plesk box, that nobody on the current team owned. It ran three recurring jobs, each a bare SP call:

- `dbo.SchedulerTask` — every 2 min, banner/promo/membership expiry.
- `dbo.SchedulerTask_JumpUp` — every minute, the daily "jump up" re-bump.
- `dbo.SchedulerTask_ExecutivePartnerBenefits` — daily, a referral-bonus accrual that does `UPDATE AspNetUsers SET CurrentBalance = CurrentBalance + <benefit>`. **It credits real money and it is not idempotent.** No run-ledger, no "already accrued today" check. The only thing between one credit and three is "the scheduler fires once."

And its dashboard was mapped at a **public** `schedule.partners.com.bd/hangfire`, secured with `admin` / `123`, hard-coded. Anyone who guessed those could press **Trigger now** on the money job and mint balances. The full write-up is in `legacy-scheduler-audit.md`; it flagged four findings each serious enough to page on. This is the audit that justifies the paranoia in every prior part.

### The port: three thin runners, verbatim SPs

The decision was to **port all three verbatim** — same SPs, same cadences — and rewrite the money SP *later*, separately. A migration is the worst possible time to change money logic; you'd be debugging a new host and new financial bugs simultaneously. And the dev worker points at a separate dev DB that doesn't even *have* these legacy tables, so a rewrite is unvalidatable until prod. Verbatim keeps behavior byte-identical to what's been paying partners for two years, while every operational win — retry control, dead-letters, metrics — lands on *our* side.

Each runner is a thin wrapper: kill-switch check, then the SP call. They ship **hard-disabled** — `defaultEnabled: false` in *code*, not just config, so a missing toggle key can never start them:

```csharp
// src/Core/Partners.Application/Common/Jobs/ILegacySchedulerRepository.cs (abridged)
/// dbo.SchedulerTask_ExecutivePartnerBenefits — daily referral-bonus accrual; CREDITS
/// AspNetUsers.CurrentBalance. Real money, NOT idempotent — running it twice double-credits.
Task AccruePartnerBenefitsAsync(CancellationToken ct);
```

```csharp
// src/Infrastructure/…/Persistence/Repositories/Jobs/LegacySchedulerRepository.cs:15-26
public Task SweepMarketplaceAsync(CancellationToken ct) =>
    SpExecuteAsync("dbo.SchedulerTask", param: null, ct, commandTimeout: 600);
public Task BumpDailyJumpUpAsync(CancellationToken ct) =>
    SpExecuteAsync("dbo.SchedulerTask_JumpUp", param: null, ct, commandTimeout: 120);
public Task AccruePartnerBenefitsAsync(CancellationToken ct) =>
    SpExecuteAsync("dbo.SchedulerTask_ExecutivePartnerBenefits", param: null, ct, commandTimeout: 600);
```

(The legacy app used `commandTimeout: 0` — infinite — so a wedged query hung the worker forever. The port caps every call.) They register at their exact legacy cadences but stay dormant:

```csharp
// src/Presentation/Partners.Worker/Jobs/RecurringJobsRegistrar.cs:94-118
manager.AddOrUpdate<LegacyMarketplaceSweepJob>(
    RecurringJobIds.LegacyMarketplaceSweep, j => j.RunAsync(CancellationToken.None), "*/2 * * * *");
manager.AddOrUpdate<LegacyJumpUpBumpJob>(
    RecurringJobIds.LegacyJumpUpBump, j => j.RunAsync(CancellationToken.None), "* * * * *");
// Executive-partner referral-bonus — daily midnight UTC = 06:00 Asia/Dhaka.
manager.AddOrUpdate<LegacyPartnerBenefitsJob>(
    RecurringJobIds.LegacyPartnerBenefits, j => j.RunAsync(CancellationToken.None), "0 0 * * *");
```

Registered-but-skipping is deliberate: the cutover is a `Jobs:Toggles` config flip, never a redeploy.

### `Attempts = 0` — the retry that must not exist

The money job pins its own retry policy, and it pins it to **zero**:

```csharp
// src/Infrastructure/…/Jobs/Recurring/LegacyPartnerBenefitsJob.cs:44-69
[Queue(JobQueues.Default)]
[SkipConcurrentExecution]                            // efficiency guard ONLY (see type doc)
// NON-idempotent money movement: OVERRIDE the process-global 5-attempt retry so a FAILED accrual
// dead-letters immediately for human reconciliation instead of blindly re-crediting balances.
[AutomaticRetry(Attempts = 0, OnAttemptsExceeded = AttemptsExceededAction.Fail)]
public async Task RunAsync(CancellationToken ct)
{
    if (!jobSystem.CurrentValue.IsJobEnabled(RecurringJobIds.LegacyPartnerBenefits, defaultEnabled: false))
    {
        logger.LogDebug("LegacyPartnerBenefits skipped — awaiting the Phase D legacy-scheduler cutover");
        return;
    }
    var start = Stopwatch.GetTimestamp();
    await scheduler.AccruePartnerBenefitsAsync(ct);
    logger.LogInformation("LegacyPartnerBenefits completed in {ElapsedMs} ms",
        (long)Stopwatch.GetElapsedTime(start).TotalMilliseconds);
}
```

This is the [Part 5](/deep-dives/when-jobs-fail) override rule at its most consequential. The global policy retries five times — correct for an idempotent email, catastrophic for a non-idempotent accrual. If this SP half-credits and then throws, a blind retry re-credits. So a failed run **dead-letters immediately** for a human. Its XML doc is explicit that exactly-once rests on **`Attempts = 0` + cutover ordering** — *not* on `[SkipConcurrentExecution]`. That distinction is the whole ballgame: the skip-concurrent lock lives in the worker's `[HangFire]` storage, and the legacy app's lock (if it even had one) lives in its `dbo` storage. **Two schedulers, two disjoint lock tables, zero coordination.** No attribute can prevent a legacy-plus-worker double fire.

### The cutover: ordering *is* the safety mechanism

Since nothing can coordinate the two storages, the only thing preventing a double-credit is stopping the old scheduler before starting ours. The sequence (design README §11, Phase D) is not a suggestion — it's the invariant:

1. **Pre-flight.** Worker healthy in prod; all three `legacy-*` jobs registered but toggled OFF; confirm the dashboard shows them scheduled-but-skipping.
2. **Retire the legacy scheduler FIRST.** Stop the `Schedule.partners.com.bd` app pool, disable its recurring jobs, lock down its `/hangfire`. Confirm it is *fully* stopped — no worker threads, dashboard unreachable. This step must precede *every* enable below.
3. **Only then, enable the two idempotent sweeps** (`legacy-marketplace-sweep`, `legacy-jumpup-bump`). These SPs are transactional and delete-based, so a near-zero overlap with the just-stopped legacy app is harmless — at worst one idempotent re-sweep.
4. **Enable the money job LAST**, only after legacy is confirmed fully stopped. Because the accrual isn't idempotent, this toggle must never flip while any chance remains that the old app fires its midnight cron.

Then you *verify* it ran exactly once, executably:

```sql
-- One accrual batch per calendar day. @WindowStart = the maintenance-window start (UTC).
SELECT COUNT(*) AS BatchCount
FROM dbo.SchedularLog
WHERE Name = N'SchedulerTask_ExecutivePartnerBenefits'
  AND ExecutionDate >= @WindowStart;
-- Expect exactly 1. 0 = a run rolled back / never fired (reconcile by hand, do NOT re-run).
-- 2 = a DOUBLE-CREDIT (legacy was still live, or someone pressed Trigger) — go to money remediation.
```

And the operator warning that belongs on a laminated card: **never press "Trigger now" or "Requeue" on the money job.** A SuperAdmin *can* (Admin is read-only — that's why [Part 6](/deep-dives/security-and-observability)'s `IsReadOnlyFunc` matters), and either button credits balances **immediately, outside the cron** — a second, unbudgeted credit. A *missed* run is reconciled in SQL, never by re-running the job. Toggling the job back off doesn't un-credit anything; a wrong credit is fixed with an explicit `CurrentBalance` adjustment keyed off the offending batch.

---

## The mistakes that page you at 3am

1. **Flipping `POST /images` to 202 in place.** You just stranded every installed app that expects a 200 with a `cdnUrl`. Stand up a *new* surface (`/v2`); let telemetry retire v1.
2. **Skipping the outbox without building the reconciler.** Direct enqueue has a stage→enqueue crash window. If you don't sweep stuck `Processing` rows, some tiles spin forever and no alert fires. The shortcut is only safe *with* the sweep.
3. **Trusting `[SkipConcurrentExecution]` to prevent a cross-app double-run.** Its lock lives in one storage. Two schedulers over two schemas share nothing. Only *stopping the old one first* prevents the overlap.
4. **Leaving the global retry on a non-idempotent money job.** Five blind retries on a half-applied credit is five chances to re-credit. Pin `Attempts = 0` and dead-letter for a human.
5. **Reacting to a missed money run by hitting Requeue.** That credits immediately, outside the cron — the exact double-pay you were trying to avoid. Reconcile in SQL.

## Cheat-sheet

```text
┌─ PATTERN A: async media ────────────────────────────────────┐
│ NEW /v2 surface → 202 + statusUrl; v1 stays synchronous     │
│ status = one column (ProcessingStatus 0/1/2), no batch table│
│ runner: direct-enqueue, id-only payload, tight retry curve  │
│ direct enqueue ⇒ MUST add a stuck-Processing reconciler     │
│ mobile: local preview, poll only while processing,          │
│         publish while processing / block only on failed     │
├─ PATTERN B: legacy cutover ─────────────────────────────────┤
│ non-idempotent money job ⇒ [AutomaticRetry(Attempts = 0)]   │
│ exactly-once = Attempts=0 + ORDERING, not a concurrency lock│
│ ORDER: stop old FIRST → idempotent sweeps → money job LAST  │
│ verify: SELECT COUNT(*)…=1 ; NEVER Trigger/Requeue money    │
└─────────────────────────────────────────────────────────────┘
```

---

## What the wrapper bought us

Seven parts ago I claimed the engine is the easy 20% and the wrapper around it is the 1% that actually keeps you employed. Here's the receipt.

Hangfire moved the image watermark off the request thread — but Hangfire didn't design the **202 + poll contract** that kept installed apps alive, didn't decide the payload is an id so no secret sits in job args ([Part 3](/deep-dives/the-job-contract)), and didn't build the reconciler that closes the direct-enqueue crash window. Hangfire will happily run a recurring job every midnight — but it has no opinion about a job that credits real money and isn't idempotent. The `Attempts = 0` override, the fail-closed `defaultEnabled: false`, the read-only dashboard that keeps Admin off the Trigger button, the cutover ordering that substitutes for a lock that *cannot exist* across two storages — none of that is in the engine. That's the [outbox](/deep-dives/the-outbox), the [dead-letters and retry overrides](/deep-dives/when-jobs-fail), the [security split and gauges](/deep-dives/security-and-observability) — the scaffold this series built.

The engine ran the jobs. The wrapper is why running them twice didn't cost us money, why a slow watermark didn't cost us a user, and why the person on call slept. That was the whole thesis, and this is where it paid.

If you're starting from Part 1: [the series index is here](/deep-dives). Go build the boring 99%. It's the part that matters.

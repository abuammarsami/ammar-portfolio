---
title: "Security & Observability — Schema-Write Is RCE, and You Can't Fix What You Can't See"
series: background-jobs
order: 6
summary: "Least-privilege SQL, an enqueue allow-list, and the one outbox gauge that tells you the whole pipeline is stalled."
readingMinutes: 15
date: 2026-07
tags: [dotnet, hangfire, security, observability, background-jobs]
status: active
---

Here is a sentence that reorganized how I think about job queues: **a job argument is a serialized method invocation, so write access to the job storage is remote code execution on the worker.**

Hangfire stores a type, a method, and its arguments, and it invokes them by reflection — that is the whole design. So the moment an attacker (or a buggy service, or a SQL-injection string that reaches the wrong table) can write a row into the `[HangFire]` schema, they can make my worker process run any method it can resolve, with any arguments they choose. The queue is not a queue. It is a code-execution surface with a `TINYINT` status column. Once you internalize that, "who can write to job storage" stops being a database-admin footnote and becomes the central security question of the whole system.

This part is two halves of the same coin. First: how [Partners.com.bd](/work/background-job-system) locks down that surface so the blast radius of a compromised component stays small. Second: how we *see* the pipeline in production — because a job system you can't measure is one you operate by prayer, and the flagship signal turns out to be a single gauge.

## What you'll build in this part

Concrete artifacts, all shipped and quoted verbatim below:

- A **four-principal SQL least-privilege split** — separate logins for the worker, the API's business lane, the API's Hangfire lane, and deploys.
- An **`EnqueueAllowListFilter`** that refuses any off-list job type *both* at creation and at execution, plus a reflection test that fails the build when someone forgets to register a runner.
- **Dashboard hardening** (the CVE-2021-41238 lesson) and an **IDs-only payload** discipline.
- An **OpenTelemetry** metrics/traces setup with a `JobsMetrics` gauge collector.
- The flagship **`outbox.oldest_pending_age`** gauge, a burn-rate alert policy, and the one-canonical-line-per-execution log discipline.

---

## The SQL least-privilege split — four principals

The naive setup gives every service one connection string with `db_owner`. That means a SQL-injection bug anywhere in the API is a straight line into the `[HangFire]` schema, and — per the anchor fact — into RCE on the worker. The fix is to split the database logins by *what each component legitimately needs*, and let the negatives (`DENY`) do the security work.

The script header states the fact it exists to defend, then names the four principals:

```sql
-- database/security/jobs-least-privilege-principals.sql:4-28
-- THE FACT THIS SCRIPT EXISTS FOR: write access to the [HangFire] schema is
-- CODE-EXECUTION-EQUIVALENT on the worker. Hangfire stores type+method+args and invokes them by
-- reflection … So the principal split is:
--   partners_worker   — full rights on [HangFire] (it IS the trusted executor …).
--   partners_api      — the API's BUSINESS lane (DefaultConnection): EXECUTE-on-SP-only, explicit
--                       DENY on [HangFire]. … dbo.JobOutboxEnqueue is its ONLY path into the job system.
--   partners_api_jobs — the API's HANGFIRE lane (HangfireConnection): CRUD on [HangFire], NO business surface.
--   deploy/DBA        — schema owner / DDL. Pipeline or SSMS only, never a runtime login.
```

Read that as a threat model, not a permissions table. Each principal is scoped to the smallest surface that lets it do its job:

**`partners_worker`** is the trusted executor. It *is* the thing that runs jobs, so it gets full rights on `[HangFire]`. But notice it gets `EXECUTE` only on the app schema — no direct table DML:

```sql
-- database/security/jobs-least-privilege-principals.sql:70-72
GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::HangFire TO partners_worker;
GRANT EXECUTE ON SCHEMA::dbo TO partners_worker;   -- SPs only: no direct DML grants on dbo tables
```

**`partners_api`** is the business lane — the connection your controllers use for everyday reads and writes. It gets `EXECUTE` on the app stored procedures and an **overriding `DENY`** on the entire Hangfire schema:

```sql
-- database/security/jobs-least-privilege-principals.sql:109-113
IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'partners_api')
BEGIN
    GRANT EXECUTE ON SCHEMA::dbo TO partners_api;
    DENY SELECT, INSERT, UPDATE, DELETE, EXECUTE ON SCHEMA::HangFire TO partners_api;  -- overriding, defence-in-depth
END
```

This is the linchpin. In SQL Server a `DENY` beats any `GRANT`, so even if some future migration accidentally grants this login broad rights, it *still* cannot touch `[HangFire]`. The only bridge from SQLi-reachable code into the job system is one stored procedure — `dbo.JobOutboxEnqueue` — which writes a row into `dbo.JobOutbox`, a plain business table, not a job. That row does nothing until the trusted dispatcher picks it up (we built that path in [Part 4](/deep-dives/the-outbox)). The API can *request* work; it cannot *forge a running job*.

The lane also `DENY`s the worker-only procedures individually — the PII-bearing ones especially:

```sql
-- database/security/jobs-least-privilege-principals.sql:159-181 (abridged — the §3a DENY list)
    -- Partner-document lane — worker-only, and the headline PII risk:
    DENY EXECUTE ON OBJECT::dbo.PartnerDocumentGetPendingByUserId TO partners_api;  -- returns raw NID VARBINARY(MAX)
    -- Outbox dispatch/maintenance — OutboxDispatcher + JobsMaintenanceJob:
    DENY EXECUTE ON OBJECT::dbo.JobOutboxClaimBatch          TO partners_api;
    DENY EXECUTE ON OBJECT::dbo.JobOutboxMarkDispatched      TO partners_api;
    DENY EXECUTE ON OBJECT::dbo.JobOutboxStatsGet            TO partners_api;   -- worker metrics collector only
```

**`partners_api_jobs`** is the awkward one, and honesty matters here. The API hosts a tiny in-process `1-critical` Hangfire server (for transactional email that must go out *now*), and *any* Hangfire server needs CRUD on `[HangFire]` — that's unavoidable. So this lane can, in principle, forge a job. We accept that, document it, and contain it: this login has **no dbo surface at all**. It can forge jobs but cannot read a single row of business data. Its power and its reach are deliberately disjoint.

**The deploy login** owns DDL and runs from the pipeline or SSMS only — never as a runtime identity. No login gets `db_owner` at runtime.

And the honest limit, which I put in the doc so nobody oversells this: **a full API *process* compromise reads both connection strings.** The split defends the SQL lane — it makes injection and least-privilege bugs survivable. It does not defend an attacker who already owns the process. Defense in depth buys you layers, not immortality.

---

![Least privilege — four SQL logins, each with its own lane; the API's business login is denied job storage, so the outbox row is its only door into jobs.](/figures/background-job-security-lanes.svg)

## Defense in depth: the enqueue allow-list

The SQL split controls *who* can write to storage. The allow-list controls *what* is allowed to run — a second, independent lock. The idea: maintain an explicit set of runner types, and refuse anything not on it, at two different moments.

One filter implements both Hangfire filter interfaces:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/EnqueueAllowListFilter.cs:39-65
public sealed class EnqueueAllowListFilter : IClientFilter, IServerFilter
{
    // Client side: gate at creation, before the job row is persisted.
    public void OnCreating(CreatingContext context) => ThrowIfNotAllowed(context.Job.Type);
    public void OnCreated(CreatedContext context) { }

    // Server side: gate at execution, catching rows inserted directly into [HangFire] storage.
    public void OnPerforming(PerformingContext context) => ThrowIfNotAllowed(context.BackgroundJob.Job.Type);
    public void OnPerformed(PerformedContext context) { }

    public static bool IsAllowed(Type jobType) => EnqueueableJobs.AllowedTypes.Contains(jobType);
    // … ThrowIfNotAllowed throws InvalidOperationException naming the missing type …
}
```

Why *both* sides? Because they defend different attacks. `OnCreating` (the `IClientFilter`) refuses an off-list type at creation — this catches a forged outbox row or a compromised enqueue path *before* it ever persists. `OnPerforming` (the `IServerFilter`) refuses at execution — this catches a row that was written *directly into `[HangFire]` storage*, bypassing the client entirely. That is exactly the RCE scenario from the top of this article: the client filter never ran because the attacker didn't use the client. The server-side throw rides the normal retry-then-dead-letter path ([Part 5](/deep-dives/when-jobs-fail)), so a forged job doesn't run — it dead-letters and pages someone.

The allow-list itself is hand-maintained and deliberately boring:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/EnqueueableJobs.cs:28-52
public static readonly IReadOnlySet<Type> AllowedTypes = new HashSet<Type>
{
    typeof(OutboxDispatcher),
    typeof(EmailJobRunner),                 // Phase B
    typeof(PartnerDocumentUploadJobRunner), // Phase B
    typeof(ImageProcessJobRunner),          // Phase C
    typeof(CvPdfJobRunner),                 // Phase C
    typeof(LegacyPartnerBenefitsJob),       // Phase D
    // … 12 types total …
};
```

Understand precisely what this bounds: **WHAT can run, not WHO enqueues it or with what arguments** — the SQL split is that control — and the granularity is *type*, not method. It's a coarse lock, and that's fine; it's a *second* lock.

The obvious failure mode is a human one: you add a new runner, wire up its DI and its `[Queue]` attribute, and forget to add it to the list. In production that surfaces as a job that dead-letters on its first execution. So the build refuses to ship it:

```csharp
// tests/Partners.Infrastructure.Tests/Jobs/EnqueueAllowListFilterTests.cs:124-147
[Fact]
public void AllowedTypes_ContainsEveryQueuedRunnerInTheJobsNamespace()
{
    var queuedRunners = typeof(EnqueueableJobs).Assembly
        .GetTypes()
        .Where(t => t is { IsClass: true, IsAbstract: false }
                    && t.Namespace is not null
                    && t.Namespace.StartsWith("Partners.Infrastructure.Jobs", StringComparison.Ordinal)
                    // No DeclaredOnly: a type that INHERITS a [Queue] method is still enqueueable …
                    && t.GetMethods(BindingFlags.Public | BindingFlags.Instance)
                        .Any(m => m.GetCustomAttribute<QueueAttribute>() is not null))
        .Distinct().ToList();

    queuedRunners.Should().NotBeEmpty();          // guard against a silent green
    queuedRunners.Should().OnlyContain(
        t => EnqueueableJobs.AllowedTypes.Contains(t),
        "every [Queue]-carrying runner must be added to EnqueueableJobs.AllowedTypes …");
}
```

The reflection sweep finds every `[Queue]`-carrying runner in the namespace and asserts each is on the list. The `NotBeEmpty()` line guards against a query that silently matches nothing (a green test that proves nothing is worse than a red one). And the *no `DeclaredOnly`* detail matters: a runner that inherits its `[Queue]` method from a base class is still enqueueable, so the test counts it too.

## Two more locks: the dashboard and the payload

**The dashboard.** CVE-2021-41238 is the lesson every Hangfire shop should have tattooed: the dashboard's default authorization allows local requests, and behind a reverse proxy "local" can mean "everyone." Never rely on the default. We pass an explicit filter and default it to read-only:

```csharp
// src/Presentation/Partners.Worker/Program.cs:206-236
app.MapHangfireDashboard("/jobs", new DashboardOptions
{
    // EXPLICIT authorization, never the implicit local-only default (CVE-2021-41238).
    Authorization = [new HangfireDashboardAuthorizationFilter()],
    // Read-only by default: Admin can observe everything but mutate nothing; only
    // SuperAdmin gets the requeue/delete/trigger buttons.
    IsReadOnlyFunc = ctx => !ctx.GetHttpContext().User.IsInRole(UserRole.SuperAdmin),
});
```

The dashboard is internal-only, cookie-authenticated (not the shared Identity), audited on mutating POSTs, and read-only unless you're a SuperAdmin. Those Requeue/Delete/Trigger buttons are dangerous enough to earn a war story in [Part 7](/deep-dives/production-patterns) — so most operators never even see them.

**The payload.** Job arguments live in storage that outlives the job, get logged, and — as we just established — are attacker-influenceable. So the rule is **IDs only; secrets are fetched at execution time and never stored in the payload.** The email runner regenerates its single-use confirmation token at send time rather than carrying it in the message — we covered exactly why in [Part 3](/deep-dives/the-job-contract). A leaked job payload should be worth nothing.

---

## You can't operate what you can't measure

Switch coins. Every lock above is invisible in production unless something tells you it's holding. A dead-lettered forged job, a stalled dispatcher, a wedged worker — you find out from a metric or you find out from an angry user.

The OpenTelemetry wiring is standard and export is OTLP-only:

```csharp
// src/Presentation/Partners.Worker/Program.cs:151-170
builder.Services.AddSingleton<Partners.Worker.Observability.JobsMetrics>();
builder.Services.AddHostedService<Partners.Worker.Observability.JobsMetricsCollector>();

builder.Services.AddOpenTelemetry()
    .ConfigureResource(r => r.AddService(serviceName: "partners-worker", …))
    .WithMetrics(m => m
        .AddMeter(JobsMetrics.MeterName)     // "Partners.Jobs"
        .AddHangfireInstrumentation()
        .AddRuntimeInstrumentation())
    .WithTracing(t => t
        .AddHangfireInstrumentation(o => o.RecordException = true));
```

The interesting part is `JobsMetrics` — a set of observable gauges that read a snapshot the collector refreshes every 15 s. Among them, one carries more operational weight than all the others combined:

```csharp
// src/Presentation/Partners.Worker/Observability/JobsMetrics.cs:26-48
meter.CreateObservableGauge("partners.jobs.servers", () => _snapshot.Servers,
    unit: "{server}", description: "Registered Hangfire servers. 0 = nothing is processing — page.");
meter.CreateObservableGauge("partners.jobs.outbox.pending", () => _snapshot.OutboxPending, …);
meter.CreateObservableGauge("partners.jobs.outbox.oldest_pending_age", () => _snapshot.OutboxOldestAgeSeconds,
    unit: "s", description: "Age of the oldest undispatched outbox row — the flagship lag signal; page at > 300s.");
meter.CreateObservableGauge("partners.jobs.collector.heartbeat_age", HeartbeatAgeSeconds,
    unit: "s", description: "Seconds since the metrics collector last completed a pass … Alert at > 90s.");
```

**`outbox.oldest_pending_age` is the flagship.** Think about what it measures: the age, in seconds, of the *oldest un-dispatched outbox row*. If that number is climbing, then somewhere between "a business transaction committed an outbox row" and "the dispatcher enqueued it into Hangfire," the pipeline is stalled — dispatcher dead, kill switch left on, storage unreachable, doesn't matter. It's a single end-to-end health gauge that doesn't care *which* component broke, only that work is aging on the floor. It's computed by one cheap query:

```sql
-- database/stored-procedures/jobs/dbo.JobOutboxStatsGet.sql:15-25
SELECT
    (SELECT COUNT(*) FROM dbo.JobOutbox WHERE Status <= 1)  AS PendingCount,
    (SELECT COUNT(*) FROM dbo.JobOutbox WHERE Status = 3)   AS DeadCount,
    (SELECT ISNULL(DATEDIFF(SECOND, MIN(OccurredUtc), SYSUTCDATETIME()), 0)
       FROM dbo.JobOutbox WHERE Status <= 1)                AS OldestPendingAgeSeconds;
```

The rest of the panel, each earning its place:

| Signal | What it tells you |
|---|---|
| Queue depth + latency p95 | Backlog and how long work waits before pickup |
| Execution duration by type | Which handlers are slowing down |
| Final-attempt outcome counters | **The SLI** — success/failure counted once, on the last attempt only |
| DLQ arrivals | Something exhausted its retries and died |
| Recurring-job last-success age | A cron that silently stopped firing |
| Server count / heartbeat age | Is anything even alive to process work |

### The heartbeat that isn't a publisher

One accuracy note, because I'd rather be correct than tidy. The design doc *aspired* to an `IHealthCheckPublisher` for the heartbeat. What actually shipped is different, and I'm describing what shipped: the liveness heartbeat is the **`partners.jobs.collector.heartbeat_age` gauge**, emitted by the `JobsMetricsCollector`. The collector refreshes the snapshot every 15 s; if it wedges, the gauge's age climbs and *that* is the page. There is no push-model `IHealthCheckPublisher` in the codebase. Separately, a pull-model `HangfireStorageHealthCheck` (a plain `IHealthCheck`, tagged `ready`) proves the host can reach `[HangFire]`:

```csharp
// src/Presentation/Partners.Worker/Health/HangfireStorageHealthCheck.cs:16-45
var stats = storage.GetMonitoringApi().GetStatistics();
// Zero registered servers is degraded, not unhealthy: storage reachable but nothing processing.
return Task.FromResult(stats.Servers == 0
    ? HealthCheckResult.Degraded("Job storage reachable but no Hangfire servers are registered.", data: data)
    : HealthCheckResult.Healthy("Job storage reachable.", data));
```

The collector itself swallows-and-logs its own failures on purpose — the *stale snapshot* is the alert, not a crash:

```csharp
// JobsMetricsCollector.cs — the catch block
// Swallow-and-log: the STALE SNAPSHOT is the alert (heartbeat-age grows), not a crash.
logger.LogWarning(ex, "Jobs metrics collection pass failed; snapshot left stale");
```

## Alerts, and the one line per execution

Metrics without alerts are dashboards nobody watches at 3am. Every alert has an **owner and a runbook** — an alert you can't act on is noise — and the thresholds are multiwindow burn-rate, not single-sample twitches:

- **outbox age > 5 min → page.** The pipeline is stalled end-to-end.
- **server count 0 / heartbeat stale → page.** Nothing is processing, or the collector is wedged.
- **DLQ arrival → ticket** (a burst pages). Something died; a human should look.

Alongside the metrics is a logging discipline borrowed from Stripe: **one canonical log line per execution.** The `JobCanonicalLogFilter` (installed as a global filter) emits a single structured line per job run — enough to grep an incident without spelunking. And the level discipline is strict, because it makes one query trustworthy: **a retryable failure logs at `Warning`; only the *final* failure logs at `Error`.** The dead-letter recorder emits exactly that one `Error` line per death:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/DeadLetter/JobDeadLetterRecorder.cs:22-77
// The ONE Error-level line per death — keeps Error 1:1 with dead-letter arrivals.
logger.LogError("JobDeadLettered {JobType} (class {FailureClass}, attempts {AttemptCount}, DLQ {DeadLetterId}, …)", …);
```

The payoff: `level:Error AND JobDeadLettered` is a perfect, noise-free count of dead-lettered jobs. Retries — which are normal and expected, since every handler runs at least twice — never inflate it. **Error stays 1:1 with the DLQ.**

---

## The mistakes

1. **Giving every service `db_owner` "for now."** That one connection string is a straight line from any SQLi bug to RCE on the worker. The `DENY` on `[HangFire]` for the business lane is the single most important line in the whole security script — it beats any accidental future `GRANT`.
2. **Trusting the Hangfire dashboard's default auth.** CVE-2021-41238: "local requests allowed" plus a reverse proxy equals "the internet is admin." Always an explicit filter, read-only by default, internal binding.
3. **Putting secrets or tokens in the job payload.** Storage outlives the job, gets logged, and is attacker-influenceable. IDs only; fetch and regenerate at execution time.
4. **Alerting on queue depth instead of outbox age.** Depth spikes are normal under load and drain on their own. `oldest_pending_age` climbing means work is *stuck*, not merely *busy* — that's the page-worthy signal.
5. **Logging retries at `Error`.** Every handler runs at least twice, so retries are routine. If they log `Error`, your "failures" dashboard cries wolf and Error stops meaning DLQ. Retryable = `Warning`; final = `Error`.

## Recap / cheat-sheet

```text
SECURITY — schema-write = RCE, so lock the surface
  partners_worker   full [HangFire]; EXECUTE-only on dbo (no table DML)
  partners_api      business lane; DENY [HangFire]; JobOutboxEnqueue = only bridge
  partners_api_jobs Hangfire CRUD; NO dbo surface (can forge, can't read data)
  deploy/DBA        DDL, pipeline-only; no db_owner at runtime
  Honest limit:     owned API *process* reads both strings — defends the lane, not the process
  Allow-list        EnqueueAllowListFilter: IClientFilter (forge at CREATE)
                    + IServerFilter (direct-write at EXECUTE); build test = completeness
  Dashboard         explicit filter, read-only default, internal-only (CVE-2021-41238)
  Payload           IDs only; secrets fetched at execution

OBSERVABILITY — you can't operate what you can't measure
  FLAGSHIP  outbox.oldest_pending_age  → page > 300s (whole-pipeline health)
  also      queue depth/p95 · duration-by-type · final-attempt SLI counters
            DLQ arrivals · recurring last-success age · server count
  Heartbeat collector heartbeat_age GAUGE (not IHealthCheckPublisher)
            + pull HangfireStorageHealthCheck (IHealthCheck, tagged ready)
  Alerts    outbox>5m → page · servers=0/heartbeat stale → page · DLQ → ticket
  Logs      1 canonical line/execution; Warning=retry, Error=final (Error 1:1 DLQ)
```

## Where this leaves us

The system is now locked down and lit up: a bounded blast radius, and a gauge that tells me the whole pipeline's health in one number. In [Part 7](/deep-dives/production-patterns) we put it all to work — the async image pipeline (202 + status polling) and the legacy-scheduler cutover war story, including the non-idempotent money job that made me very glad those Requeue buttons were locked behind SuperAdmin.

See the full arc in [the series index](/deep-dives).

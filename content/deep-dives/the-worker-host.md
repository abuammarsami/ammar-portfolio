---
title: "The Worker Host — a Dedicated Service, Not a Thread in Your API"
series: background-jobs
order: 2
summary: "Standing up a standalone Hangfire worker, its own SQL schema, three queues, two servers, and a drain ladder that survives a deploy."
readingMinutes: 14
date: 2026-07
tags: [dotnet, hangfire, background-jobs, reliability, sql-server]
status: active
---

## The 2:14pm deploy that ate 40 emails

We shipped a routine API hotfix at 2:14pm. IIS recycled the app pool, the way it does on every deploy. Somewhere in that recycle, ~40 registration-verification emails that were mid-send — awaiting an SMTP round trip on a request thread — evaporated. No exception, no dead-letter, no log line worth the name. The work had lived *inside* the API process, so when the process went, the work went with it.

That is the whole argument for this part. A background job that runs in your API is not a background job — it is a foreground job wearing a disguise. It competes with request threads for the thread pool. It dies on every deploy. You can't scale it independently, you can't secure it independently, and you can't even *see* it independently. In [Part 1](/deep-dives/why-background-jobs) I made the case that the engine is plumbing and the wrapper is the 1%. This part is the first plank of that wrapper: a dedicated `Partners.Worker` Windows Service that owns the job engine, while the API keeps only a tiny in-process server for the one queue that genuinely needs sub-second latency.

## What you'll build in this part

A standalone worker host — a real `Microsoft.NET.Sdk.Web` project that installs as a Windows Service, runs the Hangfire servers, serves the dashboard and health endpoints, and drains gracefully instead of guillotining in-flight jobs. Concretely:

- A `Program.cs` that registers as a Windows Service, sets an honest shutdown timeout, and exits non-zero on a fatal so the Service Control Manager (SCM) restarts it.
- A **dedicated `[HangFire]` SQL schema** — its own permission boundary, self-migrating on boot, deliberately *not* the legacy scheduler's `dbo` tables.
- **Three numeric queues** and **two `BackgroundJobServer`s** — an IO pool and a CPU pool — split by workload.
- An internal-only dashboard behind cookie auth, read-only by default.
- Split live/ready health endpoints and a nested **drain ladder** that lets a deploy finish its work before it lets go.

Everything below is the real shipped wiring from `Partners.Worker`. No pseudocode.

## Why the job belongs in its own process

Think of your API process as a busy restaurant kitchen at dinner rush. Request threads are the line cooks turning tickets around in seconds. A background job — resize forty images, render a PDF, wait 30 seconds on a flaky SMTP server — is a cook who wanders off to slowly braise something for an hour, occupying a station the whole time. On a bad night the braising cook starves the line, and every diner's ticket gets slower. Worse: when the kitchen closes for the night (a deploy), the braise is thrown out half-cooked.

Moving jobs to their own process is hiring a second kitchen. It has its own staff (thread pool), its own scaling knob (worker count, or a whole second box), its own security posture (a different SQL login, a different Windows identity), and — critically — its own lifecycle. You can redeploy the API forty times a day and the worker never notices; you can restart the worker on its own schedule and let it drain first.

The one exception is latency-critical work. A password-reset email must go out *now*, while the user stares at the "check your email" screen. That work is enqueued **directly**, skipping the outbox — precisely because the outbox's up-to-60-second dispatch tick (we build it in [Part 4](/deep-dives/the-outbox)) is the wrong latency for someone watching a screen. So the API keeps a **tiny Hangfire server bound to `1-critical` only**, on its own least-privilege SQL principal, so critical work is picked up in-process the instant it's enqueued instead of waiting on the worker to be up and undrained. Everything else lives in the worker. Here is the two-process shape:

![System architecture — the API commits business state and an outbox row in one SQL transaction; a dedicated worker claims rows (READPAST + lease) and runs jobs across IO/CPU Hangfire servers.](/figures/background-job-system-architecture.svg)

## Building the host

The worker is a web project — it needs the HTTP stack for the dashboard and health endpoints — that *also* knows how to run as a Windows Service. The first two things `Program.cs` gets right are subtle and both bite you in production if you skip them:

```csharp
// src/Presentation/Partners.Worker/Program.cs:24-55
var builder = WebApplication.CreateBuilder(new WebApplicationOptions
{
    Args = args,
    // MANDATORY for a Windows Service host: under SCM the process CWD is
    // C:\Windows\System32 … ContentRootPath = AppContext.BaseDirectory
    ContentRootPath = AppContext.BaseDirectory
});

// The worker deploys as a Windows Service (never IIS …). AddWindowsService is a no-op
// outside an actual service context, so `dotnet run` and CI test hosts behave normally.
builder.Services.AddWindowsService(options => options.ServiceName = "PartnersWorker");

builder.Services.Configure<HostOptions>(o =>
{
    o.ShutdownTimeout = TimeSpan.FromSeconds(135);
    // Two Hangfire servers … Concurrent stop keeps the ladder honest.
    o.ServicesStopConcurrently = true;
});
```

`ContentRootPath = AppContext.BaseDirectory` is not optional. When the SCM launches a service, the process working directory is `C:\Windows\System32`, not your install folder — so `appsettings.json` and everything relative resolves to the wrong place. Pinning the content root to the binary's directory fixes it. `AddWindowsService` is a no-op outside a real service context, which is why the same binary still runs under `dotnet run` and in CI without special-casing.

`HostOptions.ShutdownTimeout = 135s` is the outermost rung of the drain ladder — more on that below. `ServicesStopConcurrently = true` lets the two Hangfire servers stop in parallel rather than serially, so the total drain window doesn't quietly double.

Finally, the fatal-error path. Windows SCM has a failure-recovery feature — "restart the service on crash" — but it only fires on a **non-zero exit**:

```csharp
// src/Presentation/Partners.Worker/Program.cs:240-251
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Partners Worker terminated unexpectedly");
    // A non-zero exit is REQUIRED for Windows SCM failure-recovery actions … SCM treats a
    // clean exit as intentional and will not restart the service.
    Environment.ExitCode = 1;
}
finally
{
    Log.CloseAndFlush();
}
```

If you let an unhandled exception unwind to a clean exit, SCM assumes you *meant* to stop and leaves the service dead. `ExitCode = 1` is what turns "the worker crashed at 3am" into "the worker crashed and was back in 20 seconds."

## Hangfire storage: a schema of its own

Hangfire stores jobs in SQL tables. By default it drops them in `dbo`. We deliberately put them in a **dedicated `[HangFire]` schema** instead:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/HangfireServiceCollectionExtensions.cs:143
public const string SchemaName = "HangFire";      // named schema = its own permission boundary
```

A named schema is a permission boundary. It lets us grant the worker's SQL login CRUD on `[HangFire].*` and *nothing else*, and deny every other login access to it — the full four-principal split is [Part 6](/deep-dives/security-and-observability)'s story, but the schema is what makes it expressible. The anchor fact that makes this non-negotiable: **write access to job storage is remote code execution on the worker** (Hangfire deserializes and invokes what's in those tables). You do not want that surface sharing a permission scope with your business tables.

There's a trap here worth flagging loudly: **the Hangfire tables already sitting in `dbo` are NOT ours.** They are the live storage of a legacy standalone scheduler app (Schedule.partners.com.bd) running its own Hangfire instance against the same database. They look like stray dead tables. They are not. Dropping them would kill a running production scheduler — including a job that credits real money. We retire them only in the Phase D cutover, which is [Part 7](/deep-dives/production-patterns)'s war story. For now: our schema is `[HangFire]`, theirs is `dbo`, and the two never touch.

The storage options themselves:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/HangfireServiceCollectionExtensions.cs:103-138
config
    .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
    .UseSimpleAssemblyNameTypeSerializer()   // AssemblyName only → version bumps don't orphan jobs
    .UseRecommendedSerializerSettings()      // NOT TypeNameHandling.All/Auto — that's Json.NET RCE food
    .UseSqlServerStorage(connectionString, new SqlServerStorageOptions
    {
        SchemaName = SchemaName,
        PrepareSchemaIfNecessary = true,     // the ONE self-migration exception to manual-apply SQL
        QueuePollInterval = TimeSpan.Zero,   // ~200ms effective long-poll fetch
        // a live worker re-signals FetchedAt every timeout/5 → only process death makes a
        // running job re-fetchable (~5 min). That IS the at-least-once contract.
        SlidingInvisibilityTimeout = TimeSpan.FromMinutes(5),
        UseRecommendedIsolationLevel = true,
        DisableGlobalLocks = true
    });
```

Three lines earn their keep. `PrepareSchemaIfNecessary = true` lets Hangfire self-migrate its schema on first boot — the single sanctioned exception to our otherwise manual-apply SQL convention (the app tables all ship as reviewed migration scripts). `QueuePollInterval = TimeSpan.Zero` switches SQL storage into effective long-polling, ~200ms latency instead of a fixed poll interval. And `SlidingInvisibilityTimeout = 5 min` is the beating heart of the at-least-once contract: a live worker re-stamps `FetchedAt` periodically while it holds a job, so a job only becomes re-fetchable after the *process dies* and stops re-signalling. That means "every handler runs at least twice" is a design fact, not a bug — which is exactly why [Part 3](/deep-dives/the-job-contract) makes idempotency mandatory.

## Three queues and two servers

Hangfire's SQL Server storage dequeues queues in **alphanumeric order**, ignoring the order you list them in code. That single implementation detail is why our queue names carry numeric prefixes:

```csharp
// src/Infrastructure/Partners.Infrastructure/Jobs/JobQueues.cs:13-34
public static class JobQueues
{
    // The numeric prefixes are load-bearing: Hangfire's SQL Server storage dequeues queues in
    // ALPHANUMERIC order, ignoring the order of the Queues array. "1-" < "2-" < "3-" …
    public const string Critical = "1-critical";  // txn email, notifications (also served by API)
    public const string Default  = "2-default";   // PDFs, single-image jobs, dispatcher, sweeps
    public const string Bulk     = "3-bulk";       // multi-image batches, partner-doc bundles

    public static readonly string[] IoQueues  = [Critical, Default];
    public static readonly string[] CpuQueues = [Bulk];
}
```

Name them `critical` / `default` / `bulk` and `bulk` sorts first — your batch image jobs would starve your transactional email. `1-` / `2-` / `3-` makes priority a property of the name.

Now the two servers. IO-bound work (SMTP waits, CDN PUTs, PDF streaming, the dispatcher, sweeps) can run at high concurrency because the threads mostly *wait* — 20 workers is fine, they're not burning CPU. CPU-bound work (ImageSharp resizing, QuestPDF rendering) pins a core each, so more workers than cores just thrashes the scheduler. Two servers, two workloads, two sizing rules:

```csharp
// src/Presentation/Partners.Worker/Program.cs:107-141
var ioWorkers = builder.Configuration.GetValue("Hangfire:IoWorkerCount", 20);
var cpuWorkers = builder.Configuration.GetValue("Hangfire:CpuWorkerCount", 0);
if (cpuWorkers <= 0) cpuWorkers = Math.Max(2, Environment.ProcessorCount);
var serverShutdown = TimeSpan.FromSeconds(
    builder.Configuration.GetValue("Hangfire:ServerShutdownTimeoutSeconds", 120));

builder.Services.AddHangfireServer(options =>
{
    options.ServerName = $"{Environment.MachineName}:worker-io".ToLowerInvariant();
    options.Queues = JobQueues.IoQueues;      // [1-critical, 2-default]
    options.WorkerCount = ioWorkers;
    options.ShutdownTimeout = serverShutdown;
});
builder.Services.AddHangfireServer(options =>
{
    options.ServerName = $"{Environment.MachineName}:worker-cpu".ToLowerInvariant();
    options.Queues = JobQueues.CpuQueues;     // [3-bulk]
    options.WorkerCount = cpuWorkers;
    options.ShutdownTimeout = serverShutdown;
});
```

The CPU pool defaults to `Environment.ProcessorCount` (floor of 2); the IO pool defaults to 20. Both are config-overridable so you can tune per box without a rebuild. The distinct `ServerName`s (`machine:worker-io`, `machine:worker-cpu`) matter for the dashboard and for heartbeat metrics — each server registers and heartbeats independently.

![Inside the worker — two Hangfire servers split IO vs CPU across three priority queues, plus the dispatcher, dashboard, telemetry, and a nested shutdown-drain ladder.](/figures/background-job-worker-internals.svg)

## The dashboard: wired now, hardened later

The dashboard is Hangfire's operational window — queues, running jobs, retries, the DLQ. It is also, if you get the auth wrong, an unauthenticated RCE console (that's the CVE-2021-41238 lesson, unpacked in [Part 6](/deep-dives/security-and-observability)). Here is the honest wiring; the deep threat model is Part 6's job, not this one.

```csharp
// src/Presentation/Partners.Worker/Program.cs:206-236
app.MapDashboardAuth();

app.MapHangfireDashboard("/jobs", new DashboardOptions
{
    // EXPLICIT authorization, never the implicit local-only default (CVE-2021-41238).
    Authorization = [new HangfireDashboardAuthorizationFilter()],
    // Read-only by default: Admin can observe everything but mutate nothing; only
    // SuperAdmin gets the requeue/delete/trigger buttons.
    IsReadOnlyFunc = ctx => !ctx.GetHttpContext().User.IsInRole(UserRole.SuperAdmin),
    DashboardTitle = "Partners Jobs",
    AppPath = null
});
```

Three deliberate choices. We pass an **explicit** `Authorization` filter — never Hangfire's implicit local-requests-only default, which is the thing the CVE punished. `IsReadOnlyFunc` makes the dashboard **read-only by default**: an Admin can watch everything and touch nothing; only a SuperAdmin sees the requeue/delete/trigger buttons (this is what stops someone from manually re-firing the non-idempotent money job in Part 7). And the filter itself pins authorization to the dashboard's own cookie scheme, fail-closed:

```csharp
// src/Presentation/Partners.Worker/Dashboard/HangfireDashboardAuthorizationFilter.cs:17-30
public bool Authorize(DashboardContext context)
{
    var user = context.GetHttpContext().User;

    // The scheme check pins this gate to the DASHBOARD cookie specifically … Fail-closed
    // on future change.
    return user.Identity is { IsAuthenticated: true, AuthenticationType: DashboardAuthEndpoints.Scheme }
           && (user.IsInRole(UserRole.SuperAdmin) || user.IsInRole(UserRole.Admin));
}
```

The cookie authenticates against the shared Identity store (same users, same roles as the main app), the endpoint is bound internal-only, and the scheme check means a future auth change can't accidentally let a different cookie through — the default is deny.

## Health and the graceful drain ladder

Two health endpoints, split on purpose:

```csharp
// src/Presentation/Partners.Worker/Program.cs (health block)
app.MapHealthChecks("/healthz/live", new HealthCheckOptions
{
    Predicate = _ => false // liveness = process is up and serving; no dependency checks
});
app.MapHealthChecks("/healthz/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = (ctx, report) =>   // status word ONLY (unauthenticated endpoint)
    {
        ctx.Response.ContentType = "text/plain";
        return ctx.Response.WriteAsync(report.Status.ToString());
    }
});
```

**Liveness** runs no dependency checks — its only claim is "the process is up and answering." **Readiness** runs the checks tagged `ready` (SQL reachable, storage reachable, servers registered) and returns a single status word, because an unauthenticated endpoint should leak nothing about internals. Splitting them stops the classic mistake of a restart-loop: if liveness checked SQL and SQL blipped, the orchestrator would kill a perfectly healthy process for a transient dependency fault.

Now the part that actually saved those 40 emails: the **drain ladder**. Shutdown is a set of nested timeouts, each rung strictly larger than the one inside it, so an in-flight job gets a chance to finish before anyone forcibly lets go:

```text
in-flight job grace  <  Hangfire server ShutdownTimeout (120s)  <  HostOptions.ShutdownTimeout (135s)  <  Windows SCM kill timeout
```

Hangfire's server `ShutdownTimeout` **defaults to 15 seconds** — and 15 seconds is a lie for a job that's mid-PDF-render or waiting on an SMTP handshake. We raise it to 120s. Then `HostOptions.ShutdownTimeout` (135s) has to sit *above* the server timeout, or the host tears down the servers before they've finished draining. And the SCM's own kill timeout has to sit above *that*, or Windows guillotines the whole process before the host is done. Get the ordering wrong — any inner rung larger than an outer one — and the graceful drain isn't graceful; the outer timeout fires first and you're back to eating in-flight work. On shutdown, a job that catches the cancellation rethrows `OperationCanceledException`, which Hangfire treats as a requeue, not a failure — combined with the 5-minute sliding-invisibility re-fetch, that's the real safety net.

## The mistakes

**1. Running jobs in the API "just for now."** There is no "just for now." The first deploy that recycles the app pool mid-job proves the point, and by then you've shipped the coupling everywhere. Stand the worker up first, even empty.

**2. Letting Hangfire land in `dbo`.** Without a dedicated schema you can't express least-privilege, and — in our case — you'd be sharing a namespace with a *different* live application's Hangfire tables. A named schema is a five-character change that unlocks the entire Part 6 security model.

**3. Naming queues without numeric prefixes.** SQL storage sorts alphanumerically. `critical` / `default` / `bulk` silently prioritizes `bulk`. Your transactional email starves behind a batch image resize and you won't know why.

**4. One server for everything.** A single pool sized for IO thrashes on CPU work; sized for CPU it wastes IO concurrency. Two servers — high-worker IO, core-count CPU — is the whole point of splitting by workload.

**5. Trusting the default 15-second drain.** Hangfire's default `ShutdownTimeout` is 15s and the SCM will happily kill you. Build the ladder — job grace < server < host < SCM — or accept that every deploy is a small data-loss event.

## Recap / cheat-sheet

```text
┌─ PARTNERS.WORKER — HOST WIRING ───────────────────────────────────┐
│ PROJECT   Microsoft.NET.Sdk.Web, installs as Windows Service      │
│ Program   ContentRootPath = AppContext.BaseDirectory  (SCM CWD!)  │
│           AddWindowsService("PartnersWorker")                     │
│           ExitCode = 1 on fatal  → SCM auto-restart               │
│ STORAGE   [HangFire] schema (NOT dbo — that's the legacy app)     │
│           PrepareSchemaIfNecessary  → self-migrate on boot        │
│           SlidingInvisibilityTimeout = 5m  → at-least-once        │
│ QUEUES    1-critical < 2-default < 3-bulk  (alphanumeric sort!)   │
│ SERVERS   IO  → [1-critical,2-default], ~20 workers               │
│           CPU → [3-bulk], ProcessorCount workers                  │
│ DASHBOARD /jobs, explicit auth filter, IsReadOnlyFunc default     │
│ HEALTH    /healthz/live (no deps) · /healthz/ready (tagged deps)  │
│ DRAIN     job < server 120s < host 135s < SCM   (nested ladder)   │
└───────────────────────────────────────────────────────────────────┘
```

## Where this leaves us

The host is standing, the servers are draining cleanly, and jobs are queued — but Hangfire will run every one of them *at least twice*, and a deploy mid-flight guarantees it. Next we make each handler safe to run twice: the job contract, the first-line kill switch, and the idempotency marker, in [Part 3](/deep-dives/the-job-contract). See the whole arc in [the series index](/deep-dives).

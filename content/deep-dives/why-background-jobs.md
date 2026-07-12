---
title: "Why Your `BackgroundService` Isn't Enough — and What a Real Job System Looks Like"
series: background-jobs
order: 1
summary: "A tour of the 2026 options for .NET background work — and why choosing the engine is the easy 20% while the reliability wrapper around it is the real job."
readingMinutes: 12
date: 2026-07
tags: [dotnet, hangfire, background-jobs, reliability, distributed-systems]
status: active
---

## Three production defects, one root cause

A user hit **Register**. The API created their account, committed the row, then tried to send the verification email inline — on the request thread. SMTP was having a bad minute. The send threw. The exception bubbled up and the endpoint returned a **500**. From the user's side: registration failed. From the database's side: the account existed, half-born, unverifiable. That is a partial commit, and it is the kind of bug that generates support tickets for weeks because the two halves of the truth disagree.

That was one of three. The same "just await it inline" instinct also gave us an **SMTP timeout of ~100 seconds** — the .NET default when you never set one — holding a request thread hostage every time the mail server hung. And partner registration did three sequential CDN uploads on the request path; when registration failed after upload two, the bytes already pushed to the CDN became **orphans nobody would ever delete**. Three defects, one root cause: latency-bound and failure-prone work was running in the wrong place, coupled to an HTTP request that had no business waiting for it.

The other half of the story was the *scheduled* work — payment reconciliation, image cleanup, promotion expiry — each a hand-rolled `BackgroundService` with a `while (true) { … await Task.Delay(…) }` polling loop. No dashboard. No uniform retry. No dead-letter. No metric anywhere telling us whether a loop had quietly died. This is the story of replacing all of it. This part is the map; [Part 2](/deep-dives/the-worker-host) onward is the build.

## What you'll take away from this part

No code to type yet — this is the on-ramp. By the end you'll be able to:

- Say precisely **what a background job is** and why inline `await` and `Task.Delay` loops are not one.
- Place the **2026 options** — raw `BackgroundService`, a hand-rolled SQL poll table, Quartz.NET, cloud-native functions, and a durable engine like Hangfire — and know when each is right.
- Understand **why this project chose Hangfire free core on SQL Server** over all of them.
- Internalize the thesis that carries the whole series: **the engine is plumbing; the wrapper is the 1%.**
- Read the **system architecture diagram** you'll spend the next six parts building.

## What a "background job" actually is

A background job is a **unit of work that outlives the request that asked for it**. The HTTP handler's job is to accept the intent, record it durably, and return. Something else — later, elsewhere, on its own thread pool — does the slow or failure-prone part. "Send the welcome email," "watermark this image," "expire yesterday's promotions" are all jobs. The defining property is *decoupling*: the caller doesn't wait, and the work survives if the caller (or the whole process) dies mid-flight.

That last clause is what a raw `BackgroundService` + `Task.Delay` loop quietly fails. Its "queue" is memory. Deploy the app, recycle the IIS pool, or crash, and every in-flight and pending item is gone — no retry, no record that it existed. `await`-ing the work inline is even worse: there's no queue at all, just a request thread you've turned into a synchronous worker, blocking a connection and coupling the user's success to a mail server's mood.

A *real* job system fixes exactly this. The intent is written to **durable storage** the instant it's accepted. A separate process picks it up, retries on failure with a backoff curve, and — when it finally can't succeed — sets it aside somewhere a human will see it, instead of swallowing it. Everything else in this series is elaboration on that one sentence.

## The 2026 ladder of options

There is no single right answer; there's a ladder, and you climb it until the rung matches your durability and operability needs. Honestly, each rung:

**1. Raw `IHostedService` / `BackgroundService` + `Task.Delay`.** Zero dependencies, ships with .NET, perfect for a truly ephemeral in-memory tick (flush a cache, poll a feature flag). But the queue is process memory: no durability, no retry, no dashboard, no dead-letter. The moment work *must not be lost*, you're going to hand-build all four — badly. This is the rung we're climbing *off* of.

**2. A hand-rolled SQL polling table.** You add a `Jobs` table, `INSERT` intents, and a loop that `SELECT`s and processes them. Now you have durability — but you've also signed up to write claim logic (`UPDLOCK`/`READPAST` so two workers don't grab the same row), leasing for crash recovery, retry/backoff, a dead-letter path, and a UI. That's a job engine. You will get the concurrency SQL subtly wrong at least once. (Ironically, [Part 4](/deep-dives/the-outbox) builds *exactly* this table — but as a narrow *hand-off* buffer in front of a real engine, not as the engine itself. The distinction matters.)

**3. Quartz.NET.** A mature, battle-tested **scheduler**. If your problem is cron — "run this at 02:00," "every 15 minutes" — Quartz is excellent. But it's a scheduler, not a **queue**: it has no first-class notion of "enqueue this one-off unit now, retry it, dead-letter it." We needed queue semantics far more than we needed cron, and bolting a work queue onto a scheduler is the wrong direction.

**4. Cloud-native (Azure Functions / AWS Lambda + SQS/Step Functions).** Genuinely great — managed scaling, managed retries, managed DLQs — *if you're already all-in on that cloud and can carry the infra*. We deploy to a single Windows/Plesk box against one SQL Server. Adopting a serverless queue would mean new infrastructure, new networking, new bills, and new failure modes for a single-box, single-team system. Wrong tool for this shop.

**5. A durable job engine on your existing DB (Hangfire).** Persistent storage, automatic retries, a built-in dashboard, one-off *and* recurring jobs — and, crucially, it stores its state in **SQL Server you already run**. No broker, no cluster, no new box. This is the rung that fits.

### Why Hangfire free core on SQL Server

The decision, straight from **ADR-0016**:

> "Engine: Hangfire 1.8.23 free core on SQL Server storage. 2026 alternatives were re-verified: TickerQ (immature), Quartz.NET (no queue semantics), Wolverine (best outbox idea — adopted; no free dashboard), MassTransit v9 (commercial, broker abstraction we don't need), Temporal (cluster ops we can't carry). Everything needed is in the LGPL core."

Concretely, Hangfire won on four counts:

- **No new infrastructure.** Storage is a schema in the SQL Server we already operate. No Redis, no broker, no container, no second box.
- **Durable by construction.** Jobs live in SQL, not memory. A worker crash mid-job is a re-fetch, not a loss.
- **A dashboard for free.** Queues, retries, failures, recurring schedules — all visible without us building a UI.
- **Retries built in.** A configurable backoff curve ships in the core; we don't hand-roll exponential backoff.

The rejected alternatives are as instructive as the pick: in-process-only hosting (rejected — CPU-bound work would share threads with HTTP *exactly under load*), `TransactionScope`-wrapped enqueue (rejected — it escalates to MSDTC; the *why* is [Part 4](/deep-dives/the-outbox)), reusing some stray Hangfire tables already in the DB (rejected — unknown schema version, wrong permission boundary), and message brokers (rejected — single consumer, single team, single box). We explicitly took **only the free LGPL core** — Pro Batches and Ace Throttling are paid features we replace with fan-out plus a status row and `System.Threading.RateLimiting` respectively.

## The thesis: the engine is plumbing; the wrapper is the 1%

Here's the load-bearing idea of this entire series. Picking Hangfire was the easy 20%. Anyone can `AddHangfire()` and call `Enqueue`. What separates a demo from a system you'd trust with real money and real user data is the **wrapper** you build around the engine — the disciplines the engine does *not* give you:

| The wrapper adds | Because the engine alone… | Built in |
|---|---|---|
| **Idempotency + kill switches** | retries mean *every handler runs at least twice*, possibly on two nodes at once | [Part 3](/deep-dives/the-job-contract) |
| **Atomic enqueue (outbox)** | "enqueue then commit" either drops the job or creates a ghost when one half fails | [Part 4](/deep-dives/the-outbox) |
| **Failure classification + dead-letter** | blind retries hammer permanent failures forever, and silent deaths page nobody | [Part 5](/deep-dives/when-jobs-fail) |
| **Security + observability** | write access to job storage is remote code execution, and unmeasured work is invisible when it breaks | [Part 6](/deep-dives/security-and-observability) |
| **Rehearsed cutover + production patterns** | a non-idempotent money job migrated live is how you double-credit real balances | [Part 7](/deep-dives/production-patterns) |

The design doc says it in one breath:

> **Hangfire is plumbing. The top-1% layer is the wrapper:** every job idempotent and keyed, enqueue atomic with the state change it follows, failures classified (never retry the unretryable), nothing dies silently (DLQ + two alert channels), everything measured against an SLO, and the whole thing kill-switchable and rehearsed before cutover.

Every part after this one builds one plank of that wrapper. Keep the table above open; it's the series' spine.

## The architecture, end to end

Here's the shape. The API writes state **and** the intent to enqueue in one SQL transaction, into the existing database. A **separate worker process** — a Windows Service, not the API — drains the outbox into Hangfire and runs the jobs, with two server instances so CPU-heavy image work never starves the IO-bound email/CDN work.

![System architecture — the API commits business state and an outbox row in one SQL transaction; a dedicated worker claims rows (READPAST + lease) and runs jobs across IO/CPU Hangfire servers.](/figures/background-job-system-architecture.svg)

The pieces to notice now — each gets its own part later:

- The **outbox** (`dbo.JobOutbox`) is written *inside the business transaction*, so the job can't exist without the state change, or vice versa. That's the atomic-enqueue guarantee of [Part 4](/deep-dives/the-outbox).
- The **dedicated `[HangFire]` schema** with its own login is a permission boundary, not decoration — because writing to it is code execution ([Part 6](/deep-dives/security-and-observability)).
- **Two servers, three numeric queues** (`1-critical`, `2-default`, `3-bulk` — numeric because SQL storage dequeues alphanumerically) keep latency-sensitive email off the same threads as core-burning image work. That split, and the worker host itself, is [Part 2](/deep-dives/the-worker-host).
- The **dead-letter table** and **OTel gauges** are how nothing dies silently and everything is measured ([Part 5](/deep-dives/when-jobs-fail), [Part 6](/deep-dives/security-and-observability)).

One thing the system deliberately does **not** do: it doesn't rebuild what Hangfire ships. Scheduling, retries, and the dashboard are *wrapped*, not rewritten. No Redis, no containers, no message broker, no changes to any business rule — every migrated job keeps its exact semantics. The wrapper adds discipline around the engine; it doesn't reinvent it.

## The build order (the next six parts)

The series is the migration, in the order we actually shipped it:

1. **This part** — the problem, the landscape, the thesis, the map.
2. **[The worker host](/deep-dives/the-worker-host)** — a dedicated Windows Service separate from the API; the `[HangFire]` schema; three queues; two servers; the hardened dashboard; graceful drain.
3. **[The job contract + idempotency](/deep-dives/the-job-contract)** — the message/runner/binding shape, the first-line kill switch, and making "runs at least twice" safe.
4. **[The outbox](/deep-dives/the-outbox)** — atomic enqueue, the claim SP, the dispatcher, and why *not* `TransactionScope`.
5. **[Failure handling](/deep-dives/when-jobs-fail)** — transient vs permanent, retries, dead-letter, alerts, circuit breakers, the timeout ladder.
6. **[Security + observability](/deep-dives/security-and-observability)** — the four-login SQL split, dashboard hardening, IDs-only payloads, OTel metrics, the flagship outbox-age gauge.
7. **[Production patterns](/deep-dives/production-patterns)** — the async image pipeline and the legacy-scheduler cutover war story (including the non-idempotent money job).

See the full index at [the series index](/deep-dives); the war stories throughout are from [Partners.com.bd](/work/background-job-system).

## The mistakes this part exists to prevent

**1. Treating "add Hangfire" as the finish line.** `AddHangfire()` plus `Enqueue` is a *demo*. It has no idempotency, no atomic enqueue, no failure classification, no security boundary. Ship that and you've moved the same three defects into a background thread where they're *harder* to see.

**2. Reaching for a broker or a cloud queue by reflex.** RabbitMQ, Kafka, SQS — all excellent when you have multiple consumers, multiple teams, or already-managed infra. For a single-box, single-team system they add infrastructure, cost, and failure modes to solve a problem your existing SQL Server already solves. Match the rung to the shop.

**3. Picking a scheduler when you need a queue.** Quartz.NET is a fine scheduler and a poor work queue. If your workload is one-off "do this now, durably, with retries," a cron library will fight you the whole way.

**4. Keeping the in-memory loop "just for now."** A `BackgroundService` + `Task.Delay` loop has no durability, and "temporary" infrastructure that silently loses work has a way of becoming permanent — until the day it loses the wrong thing.

## Cheat-sheet

```text
BACKGROUND JOB = work that outlives the request, in durable storage,
                 retried on failure, dead-lettered when it can't succeed.

THE LADDER (climb until the rung fits):
  1. BackgroundService + Task.Delay .... in-memory tick only; NO durability
  2. hand-rolled SQL poll table ........ you rebuild a whole engine (badly)
  3. Quartz.NET ........................ scheduler, not a queue
  4. Azure Functions / AWS ............. great IF already cloud-native
  5. Hangfire on SQL Server ............ durable + dashboard + retries,
                                         reuses your DB — THIS PROJECT

THE THESIS:  engine = plumbing (the 20%)
             wrapper = the 1% ->  idempotency + kill switches   (Part 3)
                                  atomic enqueue / outbox        (Part 4)
                                  failure class + dead-letter    (Part 5)
                                  security + observability       (Part 6)
                                  rehearsed cutover              (Part 7)
```

## Where this leaves us

We have the map: a durable engine chosen for a single-box shop, and a five-plank wrapper that turns it into something you'd trust with real money. Next we build the foundation it all stands on — a dedicated worker host, separate from the API, with its own schema, queues, servers, and a dashboard that can't get you fired. That's [Part 2](/deep-dives/the-worker-host).

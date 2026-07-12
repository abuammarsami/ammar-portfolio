---
title: Background Job System — Dedicated Worker, Outbox, Dead-Letter Queue
date: 2026-07
tags: [dotnet, hangfire, distributed-systems, reliability, sqlserver]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
layout: case-study
---

# Background Job System — Dedicated Worker, Outbox, Dead-Letter Queue

**Summary:** Designed and built the background-job subsystem for the Partners.com.bd marketplace
backend (.NET, ASP.NET Core, SQL Server) — a dedicated Hangfire worker with an atomic-enqueue
outbox, a dead-letter queue, idempotent handlers, least-privilege SQL isolation, and
OpenTelemetry-based observability. The single place all async work now lives.

**Problem:** Async work was scattered and fragile. Some ran on hand-rolled `BackgroundService`
polling loops; latency-heavy work (email, image watermarking, PDF generation, document uploads)
was awaited inline on HTTP request threads. There was no dashboard, no uniform retry, no
dead-letter, and no metrics — and it was causing real defects: a registration flow that could
return 500 with a half-created account, an unbounded SMTP hang holding request threads, and a
CDN orphan-file leak on failed uploads. A separate legacy scheduler app owned three recurring
jobs, one of which credited real user balances and was not idempotent.

**Approach:** Stood up a dedicated `Partners.Worker` Windows Service (separate host from the API,
so job load can never starve request threads) running Hangfire on a locked-down SQL schema, with
three priority queues split across IO- and CPU-bound servers (Fig. 1). The correctness layer is the point:
every job is idempotent and keyed (each handler is assumed to run at least twice, possibly
concurrently on two nodes), and every enqueue is written to a transactional **outbox** inside the
same SQL transaction as the state change it follows — so an enqueue can never commit without its
business data, or vice versa (Fig. 2). Failures are classified (transient vs. permanent), retried on a
single owning layer, and dead-lettered with full context plus dual-channel alerts when they
exhaust (Fig. 3). Security is treated as first-class: write access to the job store is remote code
execution, so the worker, the API, and the deploy pipeline each get their own least-privilege SQL
principal, and only an allow-listed set of job types can ever be created or executed. The whole
thing is kill-switchable per job type and instrumented with OpenTelemetry (the flagship signal is
the age of the oldest un-dispatched outbox row — the end-to-end health gauge). I also delivered a
202-plus-status-polling async image pipeline and a rehearsed cutover that retired the legacy
scheduler without ever double-crediting a balance.

**Impact:** Consolidated all async work behind one observable, secure, idempotent subsystem and
eliminated a class of production defects (registration partial-commit, unbounded SMTP timeout, CDN
orphan leak). Replaced three hand-rolled polling loops and a standalone scheduler app with uniform,
dashboarded, dead-lettered jobs. Shipped incrementally across independently-releasable phases with
zero business-rule changes, behind hot-reloadable feature flags, and backed by ~1,100 passing tests
including live-SQL integration coverage.

**Tech stack:** .NET, ASP.NET Core, C#, Hangfire (SQL Server storage), Dapper + stored procedures,
SQL Server, OpenTelemetry → Prometheus/Grafana, Polly, MailKit, Windows Service host

**Links:** (sole-engineer build for a production marketplace — walk-through on request)

**Media:**
![Fig. 1 — system architecture: the API commits business state and an outbox row in one SQL transaction; a dedicated Windows-Service worker claims rows (READPAST + lease) and runs jobs across IO/CPU Hangfire servers, with a read-only dashboard and OpenTelemetry export](/figures/background-job-system-architecture.svg)
![Fig. 2 — the transactional outbox: state and enqueue-intent commit atomically, then a dispatcher relays each row to Hangfire and marks it dispatched — a crash re-claims the row, making delivery at-least-once](/figures/background-job-system-outbox.svg)
![Fig. 3 — failure lifecycle: classify at the provider boundary, delete permanent failures without retry, back off transient ones over five retries, then dead-letter the exhausted job and alert on arrival](/figures/background-job-system-failure.svg)

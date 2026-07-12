---
slug: background-jobs
title: "Background Jobs From Scratch"
tagline: "From “why your BackgroundService isn’t enough” to a money-moving production cutover — building a job system that’s idempotent, atomically enqueued, dead-lettered, observable, and secure."
featured: true
status: active
---

Every language ships a job engine you can install in an afternoon. It gives you scheduling, a retry button, and a dashboard — and none of the correctness. This series is about the correctness: the wrapper that makes a job safe to run twice, atomic with the database change it follows, impossible to lose, and honest when it fails. It's built on .NET, Hangfire, and SQL Server, but the patterns are engine-agnostic — and every part is grounded in the real code that runs it.

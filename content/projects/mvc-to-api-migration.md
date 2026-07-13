---
title: MVC → API Strangler Migration — Retiring a Monolith Without Going Dark
date: 2026-05
tags: [dotnet, clean-architecture, mediatr, migration, sqlserver]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
layout: case-study
---

# MVC → API Strangler Migration — Retiring a Monolith Without Going Dark

**Summary:** Migrated the Partners.com.bd marketplace off a legacy five-layer `OnlineShop`
MVC monolith onto a new .NET Clean-Architecture core (ASP.NET Core, MediatR, Dapper + stored
procedures) using the strangler-fig pattern. The new JSON API for the Flutter apps is built
directly on the core, where a single `_mediator.Send(...)` reaches a handler that is the use
case; the strangler step is to rewire each surviving Razor controller to call that same seam,
one endpoint at a time, so the old pages keep serving live traffic and their indexed URLs while
the data path underneath them moves. Migration is gated by a layer-by-layer parity audit — not a
big-bang rewrite.

**Problem:** The old `OnlineShop` MVC app is a five-layer monolith where the service layer is
pure one-line delegation and all logic is crammed into repositories. It filters ads with
`NVARCHAR` route strings (whitespace-stripped by regex, with hardcoded `'all'`/`'bangladesh'`
sentinels), pays two DB round trips per listing page and three-to-four per detail page (including
a hidden N+1 `ShopName` lookup inside a repository), increments the view counter with a
read-then-write race inside a transaction that wraps the read, runs detail SPs at
`commandTimeout: 0`, blocks on async with `.Result`, wraps every action in
`Task.Run(() => View(...))`, and has no server-side validation at all — `pageIndex = -1000`
reaches the stored procedure untouched. It works, ranks on Google, and takes money, which is
exactly why it can't simply be switched off.

**Approach:** Strangle the data path, not the UI. The MediatR handler becomes the use case —
`LoggingBehavior → ValidationBehavior → Handler` — with the repository interface in the
Application layer and Dapper/SP execution in Infrastructure, fully async with default timeouts.
That handler is already reached by the new API controller via `_mediator.Send()` for mobile; the
strangler step rewires each surviving MVC controller to call the same `_mediator.Send()` and map
the returned DTO back onto its Razor `ViewModel`, so the web page renders unchanged and its SEO
URL is preserved. The ad domain is sliced per category (`Vehicles/Properties/Electronics/Lifestyle/Jobs`),
each with its own repository interface, query, validator, immutable DTO, and stored procedure;
one SP per category replaces the single fat `Get_AllAdsPage_AllTypeOfAds`, using integer FK
filters, `OFFSET/FETCH` instead of temp tables, no read transaction, and one call that returns
items + promoted sections + count. Click counts increment atomically on the primary key. Each
endpoint crosses the seam only after a parity audit proves the new path reproduces the old
behavior.

**Impact:** Detail-page round trips dropped from three-to-four to one (~67–75% fewer), listing
pages from two to one (~50%); the click-count race, the read-wrapping transactions and temp
tables, the `commandTimeout: 0` pool hazard, and the `.Result`/`Task.Run` anti-patterns are all
gone, and server-side validation exists for the first time. The decorative service layer is
deleted. The migration is honestly **in flight**: a layer-by-layer audit ranked fifteen defects
in the old path and — crucially — caught two paid promotion tiers (Hurry Up, Jump Up) that had a
filter parameter but no result set and would have silently vanished in a "looks done" migration.
Still owed per that audit: the two missing boost sections, detail DTOs that some Razor pages need
widened (bridged by a mapping adapter today), the create-flow upload UX, and an `AllPosts.Price`
`NVARCHAR → DECIMAL` schema migration. Google AdSense stays UI-only and the DB-driven display-ad
subsystem stays its own feature group — neither is dragged into the marketplace ad API.

**Tech stack:** .NET, ASP.NET Core, C#, MediatR, FluentValidation, Dapper + stored procedures,
SQL Server, ASP.NET MVC (legacy `OnlineShop`), Razor, Clean Architecture

**Links:** (sole-engineer migration of a production marketplace — walk-through on request)

**Media:**
![Fig. 1 — the strangler seam: the new JSON API controller already calls one _mediator.Send() into a single Application core, whose pipeline runs LoggingBehavior then ValidationBehavior then the handler, down through a repository interface to a Dapper stored-procedure call; the surviving MVC Razor controller is being rewired to the same seam — one business core, reached from two shells](/figures/migration-strangler-seam.svg)
![Fig. 2 — one ad-detail request, old vs new: the old MVC path takes three-to-four DB round trips (resolve slug, fetch by CategoryTablePostId, field visibility, plus a hidden N+1 ShopName lookup) through a pass-through service layer, while the new path routes both shells through one handler and one stored procedure for a single round trip](/figures/migration-request-lifecycle.svg)
![Fig. 3 — the promotion parity gap the audit caught: five paid boost tiers exist (Show Up, Top Post, Between, Hurry Up, Jump Up); the new listing SPs accept a PromotionTypeId filter for all five but only materialize three result sets, so Hurry Up and Jump Up had no query handler and would have silently disappeared in a migration that felt complete](/figures/migration-promotion-parity.svg)
![Fig. 4 — layer collapse: the old five-layer monolith (Razor, controller, pass-through service, all-logic repository, Dapper/SP) with the service layer marked as dead indirection, against the new three-layer slice (thin shell, MediatR handler as the use case, Dapper/SP) — validation moves into the pipeline and the pass-through layer is deleted](/figures/migration-layer-collapse.svg)

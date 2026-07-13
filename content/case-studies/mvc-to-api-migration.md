---
name: mvc-to-api-migration
title: "MVC → API Strangler Migration"
type: case-study
status: active
updated: 2026-07-13
headings:
  problem: "A monolith where the service layer did nothing and the repository did everything"
  bigIdea: "Strangle the data path — don’t rewrite the shell"
  howItWorks: "One MediatR core, reached by a thin API and the old Razor controllers alike"
  followAJob: "Follow one ad-detail request through the strangler seam"
  decisions: "Where the migration earned its keep"
  warStoryKicker: "The war story · the parity audit"
  warStory: "The audit that caught two paid boosts quietly going missing"
  impact: "Round trips halved, a class of races deleted — one core, two shells"
---

## Tagline

Retiring a five-layer MVC monolith one seam at a time — the old Razor pages keep serving live traffic while a new Clean-Architecture core is grown in underneath them, endpoint by endpoint, with a layer-by-layer parity audit as the gate for calling anything "migrated."

## Role

Sole engineer of Partners.com.bd — I design, build, and run the whole platform end to end: the Flutter mobile apps, the .NET Clean-Architecture API, and the migration off the legacy `OnlineShop` MVC monolith. This case study is that migration: how a live marketplace moves from a view-centric monolith to a contract-centric core without a big-bang rewrite and without going dark.

## In one minute

You cannot stop a running marketplace to rewrite it. So you do the opposite of a rewrite: you grow a new system *around* the old one and let it strangle the old one branch by branch — the [strangler-fig pattern](https://martinfowler.com/bliki/StranglerFigApplication.html).

Concretely: the new JSON API — the one the Flutter apps talk to — is built directly on a fresh Clean-Architecture core, where a single `_mediator.Send(...)` reaches a MediatR handler that *is* the use case. The old system points at that same core: each Razor controller calls that same `_mediator.Send(...)` and maps the result back onto its view — so the page and its SEO-friendly URL stay exactly as they are while the data path underneath them runs on the new core. The end state is one business core reached from two shells — the mobile API and the web's Razor controllers — with a parity audit gating every endpoint's crossover so the new path provably reproduces the old behavior.

## Stats

- 5 → 3 | layers, the dead pass-through service deleted
- 3–4 → 1 | DB round trips per ad-detail page
- 2 → 1 | DB round trips per listing page
- 15 | ranked defects catalogued in the old ad path
- string → int | filter keys, index-seekable at last

## The problem

The legacy `OnlineShop` MVC app is a five-layer monolith with one layer that earns nothing at all. A request flows *Razor view → area controller → service → repository → Dapper/SP → SQL*, but the service layer is literal one-line delegation:

```csharp
public async Task<ServiceResponse<PostViewModel>> AllPost(...)
    => await _homeRepository.AllPost(...);
```

No validation, no business rules, no transformation — pure indirection. All the real logic is crammed into the repository, and the controller is view-centric: it builds `ViewBag`s, pagers, and category UI state. Filtering is done with **strings** — the route text *is* the filter value (`Ads/Dhaka/VehicleService`), so the repository strips whitespace with regex and the SP has hardcoded sentinel detection (`IF @Category = 'all' SET @Category = NULL`). It is a system that works, ranks on Google, and takes money — and is also full of the exact defects a monolith accretes when the service layer is decoration and the SQL is where everyone actually edits.

## Incidents

### An ad-detail page cost four database round trips

*symptom → cause*

Opening one vehicle detail page fired: (1) resolve the route slug to IDs, (2) fetch the vehicle by `CategoryTablePostId`, (3) fetch subcategory field-visibility for the view — and, hidden *inside* the repository, (4) a synchronous `GetValidShopNameForRoute` lookup, a textbook N+1. The detail SP also ran with `commandTimeout: 0` — an unbounded wait that ties up a pooled connection indefinitely under a slow query.

### The click counter had a race built into the SQL

*symptom → cause*

The old detail SP incremented views with a subquery-read-then-write — `SET Count = (SELECT Count ...) + 1` — wrapped in a transaction that also held the read. Two concurrent views read the same value and one increment is lost, and the transaction escalates locks around a pure read the whole time.

### A typo in a category name silently returned zero ads

*symptom → cause*

Filters were `NVARCHAR` comparisons against denormalized columns (`DistrictName`, `Category`, `SubCategoryName`). No foreign-key index could be used, whitespace and casing mattered, and a mistyped category didn't error — it just returned an empty page. There was no server-side validation anywhere: `pageIndex = -1000` or a 10 KB search string reached the stored procedure untouched.

## The big idea

A rewrite is the tempting move and the wrong one: you cannot take a marketplace offline for six months, and a parallel greenfield app that has to reach feature-parity before *any* value ships is how migrations die. The strangler thesis is different — **migrate the data path, not the UI, and route both the old shell and the new one through a single core.**

So the design collapses to one seam. The MediatR **handler is the use case** — validation runs in the pipeline before it, the repository does only data access after it, and there are no pass-through layers in between. The thin new API controller reaches that handler with `_mediator.Send(query)` for the mobile apps, and each *surviving* MVC controller calls the same `_mediator.Send(query)` and maps the result back onto its Razor `ViewModel`, **one endpoint at a time**. The result is one business core, two shells, the old five-layer path retired — with a parity audit confirming each endpoint's crossover before it's declared done.

## The wrapper

- The strangler seam | The new API controller calls `_mediator.Send(...)` into one Application core and returns JSON; each MVC controller calls the same seam and maps the DTO back onto its Razor `ViewModel`. Migrating an endpoint is rewiring a controller, not rewriting a page.
- Handler *is* the use case | MediatR vertical slices replace the pass-through service layer entirely. `LoggingBehavior → ValidationBehavior → Handler`; the handler orchestrates, the repository interface (declared in Application) does only data access.
- Per-category vertical slices | `Features/Ads/{Vehicles,Properties,Electronics,Lifestyle,Jobs}`, each with its own repository interface, query, validator, DTO, and SP. A Vehicle handler never sees a Jobs method; Jobs gets `MinSalary/MaxSalary` while the rest use `MinPrice/MaxPrice`.
- One SP per category | Each replaces a slice of the single fat `Get_AllAdsPage_AllTypeOfAds`. Integer FK filters, `OFFSET/FETCH` instead of temp tables, no transaction around reads, items + promoted sections + count returned in one call.
- Immutable DTOs | One shared sealed `AdListingItemDto` with `bool` flags replaces four mutable ViewModels with `int` flags — three near-identical promoted-section classes plus the 55-property main listing model. Detail DTOs are flat records with lookups pre-resolved by the SP — no manual image-list building in C#.
- Validation in the pipeline | FluentValidation runs via `ValidationBehavior` before any handler: `Page ≥ 1`, `PageSize ∈ [1,100]`, `MaxPrice ≥ MinPrice`, `SearchText ≤ 200`. The old controllers validated nothing.
- Atomic click increment | `UPDATE AllPosts SET ClickCount = ISNULL(ClickCount,0)+1 WHERE Id = @AllPostId` — a single statement on the primary key, outside any transaction, replacing the read-then-write race.
- Shared read model, on purpose | Both old and new query the denormalized `AllPosts` projection. The migration changes the *access path*, not the storage — re-modelling `AllPosts` is a separate, riskier migration deliberately left for later.

## How it works

At the center is one Application core and a rule: no controller writes data-access logic anymore. A request — from either shell — becomes a MediatR query or command. The pipeline runs `LoggingBehavior`, then `ValidationBehavior` (which fails fast with structured 400s before the handler ever executes), then the handler. The handler is the whole use case: it calls a repository *interface* that lives in the Application layer, and the Infrastructure implementation behind it does only Dapper + stored-procedure execution — fully async, `CancellationToken` threaded through, default 30-second timeouts. It returns an `ApiResponse<T>` with pagination metadata. The new API controller serializes that to JSON; the old MVC controller maps it to a `ViewModel` and hands it to Razor. The seam is the same `_mediator.Send()` in both — which is exactly what lets one endpoint at a time cross over without the other endpoints noticing.

## Follow a job

### 1. The request arrives at one of two front doors

*two shells*

Mobile hits `GET /api/v1/ads/vehicles/{id}` with a numeric id. The web hits `/ads/vehicle/{routePath}` — an SEO slug that must be preserved, because those URLs are indexed and ranking. Same underlying ad, two entry points.

### 2. The web resolves its slug — an edge-only concern

*edge-only*

The MVC controller still resolves the route slug to an `AllPostId` and still fetches subcategory field-visibility for the Razor view. These are genuinely presentation concerns, so they stay at the web edge and are deliberately *not* pushed into the API core — the mobile app handles field visibility itself.

### 3. Both shells call the same handler

*one core*

The API controller issues `_mediator.Send(new GetVehicleAdDetailQuery(allPostId))`; the MVC controller issues the very same call. The validation behavior runs; the handler takes over. There is no second business implementation to keep in sync — that is the whole point of the seam.

### 4. One stored procedure does everything

*one query*

`dbo.VehicleAdGetDetail(@AllPostId)` atomically increments the click count on the primary key, joins `AllPosts → Vehicles → AspNetUsers → MembershipProfile`, resolves every lookup name, and returns a flat, display-ready row. One round trip replaces the old three-to-four.

### 5. Each shell renders in its own idiom

*shell-specific*

The API returns `ApiResponse<VehicleAdDetailDto>` as JSON. The MVC controller maps that same DTO onto the old `VehicleAdDetailsViewModel` so the existing Razor page renders unchanged — the migration is invisible to the visitor and to Google, which is the entire point.

## Architect decisions

### Rewire the controllers, don't rewrite the views

*chose: MVC controllers delegate to `_mediator.Send()` · over: a big-bang Razor-to-SPA rewrite*

A rewrite has to reach full parity before it ships anything; the strangler ships value per endpoint and keeps the live site — and its SEO — intact the whole way. The old Razor page stays; only its data path moves. Each seam is a small, reversible change instead of one enormous switch-over.

### Integer FK filters over string matching

*chose: `DistrictId` / `SubCategoryId` / `ThanaId` · over: `NVARCHAR` `DistrictName` / `Category`*

Integer equality is index-seekable, deterministic, and typo-proof; the regex whitespace-stripping and the `'bangladesh'`/`'all'` sentinel detection simply disappear. A wrong id is a validation error, not a silently empty page.

### One SP per category over one fat cross-category SP

*chose: per-category vertical slices · over: `Get_AllAdsPage_AllTypeOfAds`*

A single SP handling all five categories couples everything to everything. Slicing per category means each can be owned, tested, and even extracted independently, and category-specific shape (Jobs' salary range) stops leaking into the others.

### Keep AllPosts as the read model — for now

*chose: query the denormalized projection from both paths · over: normalizing storage during the migration*

The migration's job is the access path; re-modelling the read-optimized `AllPosts` table is a distinct, higher-risk migration. So `Price` stays `NVARCHAR` (the new SPs `TRY_CAST` it) — a deliberate scoping line that keeps storage changes in their own migration rather than smuggling them into this one.

## The war story

The dangerous part of a migration isn't the code you write — it's the moment you *believe* the new path matches the old one. So before calling the ad system migrated, I audited it layer by layer: old MVC vs new API, UI down to SQL, writing down what was correct, what was intentionally simplified, and what was actually missing. The audit confirmed the architecture direction — and then it caught the thing a "looks done" migration ships by accident.

The old system supports **five** paid promotion tiers: Show Up, Top Post, Between, Hurry Up, and Jump Up. The new listing procedures accept a `@PromotionTypeId` filter for all five — but the response only materializes **three** result sets (`ShowUpAds`, `TopPostAds`, `BetweenAds`), and there was no query path for Hurry Up or Jump Up at all. The filter contract had been generalized; the response shape had only been built for the three visible sections. A migration that felt finished would have **silently dropped two revenue-generating promotion tiers** — customers paying for a boost that never rendered.

The audit produced two artifacts. One is a ranked catalog of fifteen defects in the *old* ad path — string-based filtering at the top, down through the click-count race, the read-wrapping transactions, and the N+1 lookups — each tagged with where the new design fixes it. The other, and the one that mattered most, is a parity finding on the *new* system that the audit caught before it shipped: two boost tiers with a filter param but no result set — a revenue feature flagged at the gate, before a single customer could pay for a boost that wouldn't render. That is the discipline the pattern demands — no endpoint crosses the strangler seam until parity is proven, not assumed. The vine hasn't strangled a branch until you've checked the branch is actually dead.

## Impact

The measured wins are round trips and correctness, with a corresponding estimated latency drop. Detail pages went from three-to-four round trips to one (a ~67–75% reduction); listing pages from two to one (~50%). The click-count race is gone (a single atomic increment on the PK), lock contention from read-wrapping transactions and temp tables is gone, the `commandTimeout: 0` connection-pool hazard is gone (default 30 s), and the `.Result` blocking and `Task.Run(() => View())` deadlock/allocation anti-patterns are replaced by real async throughout. The decorative service layer is deleted, and server-side validation exists for the first time.

And the scope is drawn as deliberately as the wins. The display-ad boundary is a design line, not an omission: Google AdSense stays UI-only and the DB-driven display-ad subsystem keeps to its own feature group — neither is dragged into the marketplace ad API, because conflating four different "ad" concepts is exactly the coupling this migration exists to undo. Every endpoint that crosses the seam does so behind a parity audit, so what runs on the new core provably matches what the old path served.

## Going deeper

The migration is documented, not just performed: a deep-dive of the old MVC ad system (marketplace vs boost vs display vs AdSense — four "ad" concepts the monolith conflated), an old-vs-new architecture comparison that ranks fifteen defects by severity with the fix location for each, and a layer-by-layer parity audit that gates every endpoint's crossover. The design is deliberately unglamorous where it counts — one core, two shells, one SP per category, one seam per endpoint — and the methodology is the point: documented end to end, audited layer by layer, and gated per endpoint, so no crossover is declared done until the parity audit proves the new path reproduces the old one. That is how a live, revenue-taking marketplace moves off its monolith without a big-bang rewrite and without going dark.

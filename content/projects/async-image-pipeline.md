---
title: Async Image Pipeline — Upload-First UX, Server-Owned Lifecycle, Bounded CDN Cost
date: 2026-05
tags: [dotnet, flutter, distributed-systems, cdn, reliability]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
layout: case-study
---

# Async Image Pipeline — Upload-First UX, Server-Owned Lifecycle, Bounded CDN Cost

**Summary:** Designed and built the ad-image pipeline for the Partners.com.bd marketplace across
both ends — a Flutter app and a .NET API. Photos upload the moment they're picked (per-photo
progress, retry just the failed one), and a server-owned lifecycle — a `dbo.PendingImageUpload`
staging row, a draft-driven heartbeat TTL, a commit step, and a background sweeper — guarantees
that anything abandoned is cleaned off BunnyCDN, no matter what the client does. Shipped across five
coordinated phases and three hardening rounds; running in dry-run, with the production delete window
as the last gate.

**Problem:** Upload-first is the mobile UX users expect (unreliable networks, immediate feedback,
multi-session drafts), but it creates orphan images — photos uploaded then never attached to an ad,
costing CDN storage forever. There are three orphan classes, where most solutions handle only one:
(A) true abandons (uploaded, app closed, no draft), (B) stale drafts (saved, never returned to), and
(C) removed-during-compose. The mobile app keeps drafts locally (Hive, 1.5s debounced auto-save), so
the server has no visibility into them — ruling out any naive "delete after N hours," which would
erase photos a user is still curating. And the client can't be trusted to clean up: it can be killed,
uninstalled, offline, or mid-device-switch at exactly the moment cleanup matters.

**Approach:** Invert ownership — the image's lifecycle becomes a server-owned state machine and the
client only makes requests against it. Every upload inserts a tracked staging row (opaque
`PendingImageId`, owner, CDN path, `ExpiresAt = NOW + 7d`). While a draft is alive, each auto-save
posts a keep-alive that pushes `ExpiresAt = LEAST(NOW + 7d, UploadedAt + 15d)` — monotonic, so the
live draft tells the server the photos are still wanted, with a 15-day hard cap bounding storage.
Ad-create resolves the ids for ownership + freshness, inlines the URLs, and flips `CommittedAt` (any
bad id → `IMAGE_INVALID` 422, ad not created); discard sets `DiscardedAt = ExpiresAt = NOW` for
instant reaping. An `ImageCleanupWorker` runs every 30 minutes behind a Redis `SETNX` lock, deletes
expired/discarded rows from the CDN with bounded concurrency, dead-letters at an attempt cap, and
hard-deletes after an audit window. A shipped server backstop adds magic-byte validation
(JPEG/PNG/WebP, derives `Content-Type`) and explicit per-endpoint request-body limits (which killed
the 100 MB-Vehicle `413`); server-side EXIF/GPS stripping ships for profile/cover photos with the ad
path to follow, and edge-resized delivery variants are wired client-side but await the CDN Optimizer
being switched on (ADR-0010).

**Impact:** CDN cost is structurally bounded (an orphan is gone within the hard cap + one sweep), all
three orphan classes are handled, and on the upload path the multi-image `413` class is eliminated
and hostile uploads are rejected by magic-byte validation — both shipped. (Server-side EXIF stripping
is live for profile/cover photos with the ad path decided next; edge delivery variants await the CDN
Optimizer being switched on.) Built both-ends over five phases under 149 server + 17 Flutter tests,
through three hardening rounds that surfaced 50+ findings — every Critical/High/Medium fixed —
including a Critical where the sweeper derived the delete path from the public URL, hit a `404`,
treated it as success, and would have leaked the real file forever (fixed by carrying the storage
path separately). Honest status: the sweeper runs in **dry-run** (logs what it would delete, deletes
nothing); the mandatory 7-day production observation window hasn't started; the manual SQL deploy (1
table, 1 type, 10 SPs) is pending; push notifications are deferred to v2 (query written, FCM/APNs
not); full ImageSharp re-encode is deferred behind an unchanged contract. A killswitch stops all
deletes within 30 minutes with data intact.

**Tech stack:** .NET, ASP.NET Core, C#, MediatR, Dapper + stored procedures, SQL Server, Redis
(distributed lock), BunnyCDN (storage + edge Optimizer), BackgroundService / IHostedService, Serilog,
Flutter, Hive (mobile drafts)

**Links:** (sole-engineer, both-ends build for a production marketplace — walk-through on request)

**Media:**
![Fig. 1 — the image lifecycle state machine: a PendingImageUpload row moves from Uploaded to one of Committed (terminal, safe — the sweeper never touches it), Discarded, or Expired; the mobile drives the happy transitions (upload, heartbeat, commit, discard) while the server owns the guarantee — expired or discarded rows are swept to Deleted and then hard-deleted after an audit window, with no client cooperation required](/figures/image-lifecycle-machine.svg)
![Fig. 2 — the both-ends flow: the Flutter app uploads each photo as it is picked to the Partners.Api, which validates the magic bytes (deriving Content-Type from them), stores on BunnyCDN, and inserts a tracked row; the draft heartbeats to extend the TTL, discards removed photos, and commits on submit — while a separate 30-minute sweeper behind a Redis lock deletes anything expired or discarded from the CDN, guaranteed](/figures/image-both-ends-flow.svg)
![Fig. 3 — the cleanup that couldn't delete: the sweeper reconstructed the storage path from the public URL, so when the base URL carried a path prefix it issued DELETE against a non-existent path; BunnyCDN returned 404, the delete method treated 404 as idempotent success, the row was marked Deleted, and the real file leaked forever — fixed by carrying the storage path separately from the URL, and found in a second PR-review round — the dry-run gate logs would-delete paths as the standing safety net before any real deletion](/figures/image-leak-bug.svg)
![Fig. 4 — the heartbeat TTL timeline: an upload sets ExpiresAt to day 7; each draft save pushes it forward to NOW plus 7 days, capped at UploadedAt plus 15 days, so a daily editor gets the full 15-day window; after the hard cap the image must be re-uploaded, and the 30-minute sweeper reaps it — a monotonic, bounded, defensible retention policy](/figures/image-heartbeat-ttl.svg)

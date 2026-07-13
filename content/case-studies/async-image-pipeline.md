---
name: async-image-pipeline
title: "Async Image Pipeline"
type: case-study
status: active
updated: 2026-07-13
headings:
  problem: "Upload-first is the right UX — and it quietly leaks money"
  bigIdea: "Make the image's lifecycle a server-owned state machine, not a client promise"
  howItWorks: "One staging table, one heartbeat, one sweeper that always wins"
  followAJob: "Follow ten photos from picker to permanent — or to swept"
  decisions: "Where the lifecycle earned its complexity"
  warStoryKicker: "The war story · the cleanup that couldn't delete"
  warStory: "A 404 that meant 'leaked forever'"
  impact: "Bounded CDN cost, hardened uploads, and a sweeper that always wins"
---

## Tagline

An upload-first image pipeline built across a Flutter app and a .NET API: photos upload the moment you pick them (per-photo progress, retry just the broken one), and a server-owned lifecycle — a tracked staging row, a draft-driven heartbeat TTL, and a background sweeper — guarantees that anything abandoned is cleaned off the CDN, no matter what the client does.

## Role

Sole engineer of Partners.com.bd — I design, build, and run both ends of this: the Flutter upload/draft experience and the .NET lifecycle, sweeper, and CDN integration. Built across five coordinated phases and three hardening rounds.

## In one minute

When you add a photo to an ad, it uploads immediately — you get a thumbnail and a progress bar, and if photo #9 of 10 fails you retry just that one, not all nine. That's *upload-first*, and it's the UX users expect. The catch: if you then abandon the form — close the app, get distracted, never post — that photo sits on the CDN forever, costing storage with nothing to show for it. And you can't trust the app to clean up after itself: it might be killed, uninstalled, or the user just switches phones.

So the server owns the image's whole lifecycle. Every upload becomes a tracked row with a 7-day expiry. While your draft is alive, each auto-save sends a heartbeat that pushes the expiry forward — up to a 15-day hard cap. When you post the ad, the images are committed and the sweeper leaves them alone. And every 30 minutes a background sweeper deletes anything that expired or was discarded — guaranteed, regardless of what the app did. It's built across mobile and backend over five phases, hardened across three review rounds, and covered by ~166 tests.

## Stats

- 3 | orphan classes handled (most designs handle one)
- 7 → 15 | day TTL, a live draft's heartbeat extends it
- 149 + 17 | server + Flutter tests
- 50+ | review findings fixed across 3 hardening rounds
- 30 min | sweep cadence, one instance via a Redis lock

## The problem

The legacy MVC app uploaded photos *with* the final submit — nothing hits storage until you tap "Post Ad." That's safe from orphans but a poor mobile experience: a 10-photo upload that fails on photo #9 after five minutes of form-filling means redoing all nine, with no progress feedback until submit. The mobile app needs *upload-first* — photos upload as they're picked — because mobile networks are unreliable, users expect immediate feedback, and a draft can span multiple sessions across days.

But upload-first creates orphans, and there are **three distinct classes**, where most prior-art solutions only address the first: **(A) true abandons** — uploaded, app closed, never even saved as a draft; **(B) stale drafts** — saved as a draft, never returned to; and **(C) removed-during-compose** — uploaded five, removed two from the grid, submitted three. The mobile app keeps its drafts *locally* (Hive, 1.5-second debounced auto-save), so the server has zero visibility into them — which rules out any naive "delete after 24 hours," because that would erase photos a user is still curating in a saved draft.

## Incidents

### Abandoned photos accumulate on the CDN forever

*symptom → cause*

With upload-first, a photo is on the CDN the instant it's picked. If the user then closes the app without saving a draft (class A), nothing ever attaches that image to an ad — and CDN storage is billed per-GB-stored and per-GB-served. Orphans accumulate without bound; the cost line only goes up.

### A saved draft's photos can't be naively expired

*symptom → cause*

The obvious fix — "delete anything not committed within N hours" — destroys class B. A user who saved a draft and plans to finish it tomorrow would come back to missing photos, because the server has no visibility into the local Hive draft that still references them.

### The client can't be trusted to clean up

*symptom → cause*

"On form-cancel, the app deletes its uploads" fails at exactly the moment it matters: the app is killed mid-flow, or uninstalled, or the user switches devices, or the network drops between "abandon" and the DELETE call. Client-driven cleanup is a single mode of failure guarding an unbounded cost — and some discards (logout) need to invalidate *all* of a user's pending photos at once, which is easy to forget and easy to misimplement.

## The big idea

Upload-first is the right call for the UX — the mistake is letting the *client* own what happens to an abandoned image. So the whole design is one inversion: **the image's lifecycle becomes a server-owned state machine, and the client can only make requests against it.**

Every upload inserts a tracked staging row with a time-to-live. A *live draft* extends that TTL by sending heartbeats as it auto-saves — so the server learns "these photos are still wanted" without ever seeing the local draft — while a hard cap keeps storage bounded. Committing an ad binds its images and takes them out of the sweeper's reach; discarding marks them for immediate reaping. And a background sweeper deletes anything expired or discarded on a fixed cadence, *guaranteed*, whether or not the app is running. The one-line thesis: **the client can request, but only the server can guarantee.**

## The wrapper

- Upload-first, per-photo | `POST /api/v1/ads/images` uploads each photo as it's picked — thumbnail and progress in seconds, retry just the one that failed. The ad submit then references ids, not bytes.
- Server-side staging row | Every upload inserts a `dbo.PendingImageUpload` row — an opaque `PendingImageId`, the owner, the CDN path, and `ExpiresAt = NOW + 7 days`. It's the server's record of an image attached to nothing yet.
- Heartbeat TTL | While a draft is open, each 1.5-second-debounced auto-save posts its ids to a keep-alive endpoint → `ExpiresAt = LEAST(NOW + 7d, UploadedAt + 15d)`. Monotonic — it can only push expiry forward. Active drafts keep their photos; idle ones age out.
- Commit on submit | Ad-create resolves the ids (owned? not expired, discarded, or already committed?), inlines the URLs into the ad row, and flips `CommittedAt` so the sweeper ignores them. Any bad id → `IMAGE_INVALID` 422 and the ad is *not* created.
- Discard, don't wait | Removing a photo, discarding a draft, or logging out marks `DiscardedAt = ExpiresAt = NOW`, so the sweeper reaps it on the next tick instead of after a 7-day wait.
- The sweeper | An `ImageCleanupWorker` runs every 30 minutes behind a Redis `SETNX` lock (one instance sweeps), fetches expired/discarded rows in batches, deletes from BunnyCDN with bounded concurrency; a failed delete increments an attempt counter and dead-letters at the cap, and soft-deleted rows are hard-deleted after an audit window.
- Server backstop | The server never trusts the client: magic-byte sniffing (JPEG/PNG/WebP — rejects `INVALID_FILE`, derives `Content-Type` from the bytes, never trusts the extension) and explicit per-endpoint request-body limits that killed the 100 MB-Vehicle `413` class. The same backstop design (ADR-0010) adds server-side EXIF/GPS metadata stripping before an object reaches the CDN and edge-resized delivery variants from one stored original via the CDN Optimizer — no extra storage, no pre-generation.

## How it works

A `PendingImageUpload` row is a little state machine, and the two sides own different parts of it. The **mobile** drives the happy transitions: it uploads (row created, `Uploaded`), heartbeats while the draft lives (TTL slides forward), discards what's removed (`Discarded`), and commits on submit (`Committed` — terminal and safe, the sweeper never touches it again). The **server** owns the guarantee: whatever the client does or fails to do, a row that crosses its `ExpiresAt` or gets discarded moves to `Expired`, then the sweeper deletes the CDN object and marks it `Deleted`, and an audit window later it's hard-deleted. The whole point of the split is that the terminal "safe" state (`Committed`) is reachable only through the server's own validation, and the terminal "cleaned" state is reachable *without any client cooperation at all*.

## Follow a job

### 1. Pick a photo — it uploads now

*upload-first*

`POST /api/v1/ads/images` validates the magic bytes (deriving `Content-Type` from them, not the extension), pushes the object to BunnyCDN, inserts a tracked row with `ExpiresAt = NOW + 7d`, and returns `(pendingImageId, cdnUrl, expiresAt)`. You see a thumbnail and a progress bar immediately; a failed photo is retried on its own.

### 2. Keep editing — the draft breathes

*heartbeat*

Every 1.5-second-debounced auto-save fires a keep-alive with the draft's image ids. `ExpiresAt` slides forward to `NOW + 7d`, capped at `UploadedAt + 15d`. A user who edits daily gets the full 15-day window; an idle draft simply ages toward expiry.

### 3. Remove two from the grid — discard

*class C*

Pulling a photo out of the picker posts a discard; the row's `DiscardedAt` and `ExpiresAt` are set to now, so the sweeper reaps it on the next tick rather than making it wait out the TTL.

### 4. Post the ad — commit the remaining eight

*bound*

Ad-create resolves all eight ids for ownership and freshness in one shot. If any is expired or not owned, the whole thing fails with `IMAGE_INVALID` 422 and no ad is created; otherwise the URLs inline into the ad and `CommittedAt` flips — the images are now permanent and out of the sweeper's reach.

### 5. Abandon instead — the sweeper wins

*guaranteed*

If you never post, the row expires at its wall — up to the 15-day cap for a draft you kept editing (or immediately, if you discarded it). The 30-minute sweeper deletes the CDN object and marks the row — no client cooperation, no unbounded cost, no leak. This is the branch the whole system exists to make certain.

## Architect decisions

### Server-owned lifecycle, not client-driven cleanup

*chose: a staging table + a sweeper the server guarantees · over: the mobile app calling DELETE on abandon*

The client is unreliable at exactly the moment cleanup matters — killed, uninstalled, offline, or mid-device-switch. Making it responsible for cleanup is a single point of failure guarding an unbounded cost. The server owns the guarantee; the client only ever makes best-effort requests that the server treats as hints.

### A heartbeat-extended TTL, not a fixed expiry

*chose: `LEAST(NOW + 7d, UploadedAt + 15d)` pushed by each draft save · over: a blind "delete after N hours"*

The server can't see the local Hive draft, so the live draft *tells* it the photos are still wanted, by heart-beating on every auto-save — while a 15-day hard cap keeps storage bounded and gives a policy you can defend in the terms of service. A fixed timer would either delete active drafts or never bound cost.

### Lightweight server backstop + edge delivery, not full re-encode

*chose: magic-byte validation + EXIF strip + CDN-Optimizer variants · over: server-side ImageSharp decode-resize-encode*

Stripping metadata is a narrow, streaming-friendly touch of the bytes; resizing at the edge from a single stored original costs no extra storage; a full server transcode would duplicate work the client and the edge already do and break the streaming upload path. The upload contract stays unchanged, so a full transcode can be layered in later if abuse ever warrants it.

### Pass an opaque id to ad-create, not a URL

*chose: a server-issued `PendingImageId` re-validated on every op · over: the client handing back raw CDN URLs*

A URL is spoofable and carries no ownership; the id lets the server enforce *who* owns the image and whether it's still valid at commit time — and is useless on its own, because every operation re-checks the `UserId` server-side, so a leaked id is not an IDOR.

## The war story

The entire system exists to stop images leaking onto the CDN — so the most instructive bug is the one, caught in a second review round, that would have made it leak *silently, forever*. The sweeper worked out which object to delete by reconstructing the storage path from the image's **public URL**. But a CDN's public URL and its storage path stop being the same string the moment the base URL carries a path prefix — so the sweeper issued its `DELETE` against a path that didn't exist. BunnyCDN answered `404`. And the delete method treated `404` as **success** — which is *correct* in isolation, because "already gone" should be idempotent and not retried. So the sweeper logged a clean delete, marked the row `Deleted`, and moved on… while the real file sat on the CDN untouched, now with no tracking row pointing at it: an unrecoverable orphan, the exact failure the system was built to prevent, wearing the costume of success.

The fix was to stop deriving the delete path from the public URL at all — the upload result now carries the storage path *separately* from the URL, so the sweeper deletes the thing it actually stored. And it's exactly what the **dry-run mode** is built for: the sweeper can log every path it *would* delete without deleting anything, so a whole class of bug like this is caught against real data before a single byte is removed. The mobile side had the mirror-image hazard — drift between the parallel id / url / expiry arrays could show a photo as *fresh* in the picker while the entity flagged it *expired*, a contradiction with no clean recovery. The hardening principle there was **fail closed**: on any array drift or unparseable timestamp, treat the image as gone and make the user re-upload, rather than ever render stale state as safe.

## Impact

CDN cost is structurally bounded — an orphan is guaranteed gone within the hard cap plus one sweep interval — and all three orphan classes are handled, not just the easy one. On the upload side the server never trusts the client: the 100 MB multi-image `413` class is eliminated by explicit per-endpoint body limits, and magic-byte validation rejects hostile uploads at the boundary — deriving `Content-Type` from the bytes rather than a spoofable extension. It's built across both ends over five coordinated phases, under 149 server and 17 Flutter tests, and it went through three hardening rounds that surfaced 50+ findings — every Critical, High, and Medium fixed, including the leak-as-success Critical above.

And because deletion is irreversible, the design is deliberately conservative around it. The sweeper carries a **dry-run mode** that logs every path it *would* delete without touching the CDN — a safety valve for validating the delete set against real data — and a **killswitch**: flip it and deletes stop within 30 minutes, with the CDN files and the tracking rows both intact. The lifecycle rows are auditable end to end, soft-deleted before they're hard-deleted, so "what happened to image X" is always answerable. That combination — a guaranteed cleanup on one side, a hard cap you can put in the terms of service, and a set of brakes on the other — is what makes an irreversible operation safe to automate.

## Going deeper

The whole thing is documented, not just built: two ADRs (upload-first with TTL orphan cleanup; server validation, EXIF stripping, and edge delivery variants), a full implementation plan carrying the staging table, all ten stored procedures, the worked heartbeat math, and three documented hardening rounds with every fix traced to its finding. The design is conservative exactly where it must be — a staging table you can audit, a dry-run and a killswitch guarding an irreversible delete, and a hard cap you can put in the terms of service. It leans on the mobile draft system (Hive, 1.5-second debounce) on one end and the CDN's edge optimizer on the other, and the same staging pattern generalizes to any upload-before-commit flow — CV uploads, onboarding avatars — because the hard part was never the upload; it was owning what happens to a file nobody committed.

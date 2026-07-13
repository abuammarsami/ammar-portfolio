---
name: cv-builder
title: "Professional Profile & CV Builder"
type: case-study
status: active
updated: 2026-07-13
headings:
  problem: "A CV rendered in the browser, from data the client owned"
  bigIdea: "One server-side renderer is the single source of truth — for the CV and the paywall"
  howItWorks: "Structured profile in, one QuestPDF generator, identical PDF out"
  followAJob: "Follow one “Download My CV” from tap to PDF"
  decisions: "Where the CV builder earned its rigor"
  warStoryKicker: "The war story · the CV generator as an SSRF probe"
  warStory: "The avatar fetch that could have probed the internal network"
  impact: "One renderer, every client, and a paywall that can’t be guessed"
---

## Tagline

A structured professional-profile editor plus a server-side CV generator that is the single source of truth for six pixel-identical designs across web and mobile — with the paywall enforced inside the renderer instead of the UI, and the one place it touches the network hardened against SSRF.

## Role

Sole engineer of Partners.com.bd — I design, build, and run both ends: the Flutter profile editor and CV UI, and the .NET professional-profile domain, the QuestPDF generator, and the paid gate. This is the "Download My CV" feature, rebuilt from a client-side browser hack into a server-owned single source of truth.

## In one minute

A "Download My CV" feature sounds trivial — until you notice where the trust sits. In the legacy web app, the CV was assembled and rendered **in the browser** with a client-side PDF library, from the user's professional-profile data, and the paywall (six designs, but only the first is free) was a matter of which buttons the UI greyed out. Two problems fall straight out of that: the client owns the rendering, so web and a future mobile app would drift into two different CVs; and the paywall is UI-deep, so anyone who reads the page source can unlock all six designs for free.

The rebuild inverts both. The CV becomes structured data behind a real editor — four profile domains with full CRUD — and the PDF is generated **server-side** by one QuestPDF renderer that is the single source of truth for all six designs, consumed identically by the web app and the Flutter app. The paywall moves into the renderer: ask for a design you haven't paid for and the server refuses, no matter what the client shows. And because the generator embeds your avatar, it fetches one URL — which is the one place a CV builder can be quietly turned into a network-probing tool, so that fetch is locked down hard.

## Stats

- 1 | server-side renderer, the single source of truth
- 6 | ATS-clean designs, one gated paywall
- 4 | profile domains with full CRUD (legacy had insert + delete)
- 664 + 40 + 70 | app · infra · mobile tests
- 52 BDT | Professional Profile unlock, on the generic ledger

## The problem

The legacy MVC dashboard's "Download My CV" opened a six-design modal and rendered a PDF **client-side** with `html2pdf.js` from the user's professional-profile data — the header plus four lists: academic qualifications, employment history, skills/languages, and projects/theses. A free user got Design 1; buying the "Professional Profile" for 52 BDT unlocked the other five. But that data had only insert-and-delete stored procedures (no edit), the templates were early-2020s two-column Bootstrap with flat hex colours and PNG decorations, and the paywall lived entirely in the UI. The new API and mobile app had *none* of it — no profile endpoints, no CV generation — so this was a from-scratch rebuild with a rule attached: don't copy the client-side approach.

## Incidents

### The paywall was only skin-deep

*symptom → cause*

Six designs, one free — but the gate was the UI grey-ing out five buttons. Nothing on the server stopped a client from requesting design 3 directly; the paywall was a suggestion, not an enforcement, and reading the page source was enough to bypass it.

### Web and mobile would render two different CVs

*symptom → cause*

With the PDF assembled in the browser by a client-side library, a future mobile app would have to re-implement the same six templates in a different stack — and they'd drift. There was no single definition of "what Design 3 looks like," so "the CV" would quietly become "the web CV" and "the app CV."

### The professional data couldn't be edited

*symptom → cause*

The legacy tables had insert-and-delete stored procedures only — no update. Fixing a typo in a job title meant deleting the whole entry and re-adding it, which is exactly the kind of friction that makes a profile feature quietly go stale.

## The big idea

The instinct that fixes all three problems is one move: **make the server the single source of truth for the rendered artifact, not just the data.** A CV isn't really a document — it's a *projection* of structured profile data through a chosen template, and if that projection lives in the browser, you've handed the client both the rendering and the paywall.

So the design pulls the projection server-side. One generator, behind an `ICvDocumentGenerator` interface, owns all six templates; the web app and the mobile app both call it and get byte-identical PDFs. The paid gate moves into that same generator — a locked design is refused where the bytes are made, not where the buttons are drawn. And the profile data gets a real editor: four domains, full CRUD, every write owner-scoped. The CV stops being a browser trick and becomes a property of the server.

## The wrapper

- One renderer, the SSOT | A single QuestPDF generator behind `ICvDocumentGenerator` (Application interface, Infrastructure impl) owns every template. Web and mobile both call it, so "Design 3" has exactly one definition and the clients never re-render anything.
- Server-enforced gate | The paywall lives in `GenerateCv`: `design != 1 && !IsProfessionalProfile → CV_DESIGN_LOCKED` (403). `GetCvDesigns` returns a per-design `isUnlocked` flag for *display only* — the enforcement is where the bytes are produced, so guessing a design number gets you a refusal, not a free CV.
- Structured profile, full CRUD | Four domains — academic qualifications, employment history, skills/languages, projects/theses — each with add / edit / delete, every write scoped `WHERE Id = @Id AND UserId = @UserId`, and `NOT_FOUND` covering both "missing" and "not owned" so there's no enumeration oracle.
- One aggregation query | `dbo.UserCvDataGetByUserId` returns the profile header plus the four lists in five result sets — one round trip feeds both the on-screen preview and the PDF generator.
- Templates as a design system | The generator is a thin dispatcher; each design is one `ICvTemplate` class over a shared `CvRenderModel` (the render-ready view derived once), a `CvTheme` palette, and font-safe `CvComponents` — accent-dot bullets are *drawn*, not an icon font, so a missing glyph can never render as a "tofu" box.
- Resilient by construction | The embedded avatar is best-effort: any fetch failure — timeout, broken circuit, a non-image body — degrades to a drawn initials circle rather than 500-ing the download. A broken CDN photo can't take the CV with it.
- On the money ledger | The 52-BDT unlock runs on the generic `dbo.Payment` platform (bundle-balance inline or bKash checkout) and flips `IsProfessionalProfile` — the same self-healing settlement path every other paid feature uses, not a bespoke payment flow.

## How it works

The profile is structured data; the CV is a projection of it. A request for `cv/download?design={n}` lands in `GenerateCv`, which first checks the gate against the server-trusted `IsProfessionalProfile` flag, then pulls everything in one aggregation query and hands it to the generator. The generator builds a `CvRenderModel` once — full name, initials, the Skill/Language and Project/Thesis splits, the contact lines — so the templates only *lay out*, never re-derive. It dispatches to one of six `ICvTemplate` classes by design number (falling back to the ATS-clean Classic rather than ever emitting a blank), resolves the palette from `CvTheme`, fetches the avatar through a hardened path (or draws initials), and renders the PDF **off the request thread**. The web app and the mobile app hit the same endpoint and get the same bytes — which is the entire point of moving the projection to the server.

## Follow a job

### 1. Tap “Download My CV” with a design chosen

*one endpoint*

The Flutter app (or the web dashboard) calls `GET /api/v1/users/me/cv/download?design=3`. The design number is the only choice the client makes; everything else is the server's.

### 2. The gate is checked where the bytes are made

*server-enforced*

`GenerateCv` reads the server-trusted `IsProfessionalProfile` flag. Design 1 is always allowed; 2–6 require an active Professional Profile — otherwise `403 CV_DESIGN_LOCKED`, which the client turns into an upsell. There is no design number that talks its way past this.

### 3. One query pulls the whole profile

*one round trip*

`dbo.UserCvDataGetByUserId` returns the profile header plus the four lists in five result sets. The same payload drives the on-screen preview, so preview and PDF can never disagree.

### 4. The render model is built once, then a template lays it out

*derive once*

A `CvRenderModel` computes the full name, initials, the type-split lists, and the contact lines a single time; the chosen `ICvTemplate` only positions them, painting its accent rail via the page background so the colour band repeats on every page of a multi-page CV.

### 5. The avatar is fetched safely, then the PDF renders off-thread

*hardened + off-thread*

The embedded photo is fetched only if its URL is an absolute HTTPS address on the configured CDN host, and the bytes are magic-byte-sniffed before they touch the renderer; anything else degrades to a drawn initials circle. QuestPDF renders off the request thread and streams back a binary `%PDF`, which the mobile app opens or shares.

## Architect decisions

### Render server-side, not in the browser

*chose: one QuestPDF generator behind `ICvDocumentGenerator` · over: the legacy client-side `html2pdf`*

A client-side renderer means the paywall is UI-deep and every client re-implements the templates. Moving the projection server-side gives one definition of each design, byte-identical output across web and mobile, and a gate that lives where the bytes are made. It also makes the templates testable — a `%PDF` smoke per design over full *and* near-empty data catches layout exceptions the browser would only reveal in production.

### Enforce the gate in the generator, expose only a display flag

*chose: `CV_DESIGN_LOCKED` in `GenerateCv` · over: greying out buttons and trusting the client*

`GetCvDesigns` returns `isUnlocked` per design for the UI to render, but the actual refusal happens in the generator against the server-trusted flag. Display and enforcement are deliberately separated so the client can be honest about what's locked without being *trusted* about it.

### One render model, six thin templates

*chose: a shared `CvRenderModel` + `CvTheme` + `CvComponents`, one class per design · over: six self-contained templates each deriving their own data*

Deriving the view once and letting templates only lay out keeps the six designs consistent and cheap to add to, and concentrates the font-safety (drawn bullets, no icon font) and the avatar/initials logic in shared components. A design becomes a layout file, not a re-derivation.

### Degrade the avatar, never fail the download

*chose: best-effort photo → drawn initials on any failure · over: letting a photo fetch throw*

The one external dependency in the whole path is the avatar URL, and a CV download must never 500 because a CDN photo is broken, slow, or not an image. Any failure — timeout, tripped circuit breaker, non-image body — falls through to an initials circle, so the artifact the user paid for always renders.

## The war story

The most dangerous line in a "Download My CV" feature isn't in the templates — it's the one that fetches your profile photo. To embed the avatar, the generator makes an outbound HTTP request to a URL that traces back to a user-controllable field (the legacy `AspNetUsers.Image`). Left open, that's a textbook **server-side request forgery**: a user sets their "photo" to `http://169.254.169.254/…` or an internal service address, asks the server to render their CV, and the server dutifully fetches that internal address from *inside* the network — and worse, tries to embed whatever bytes come back into a PDF. A CV generator had quietly become a network-probing tool with an image-exfiltration side channel.

A high-effort multi-agent review is what surfaced it, and the fix is layered. The fetch now only proceeds for an **absolute HTTPS URL whose host is the configured CDN host** — a relative or legacy or internal URL never leaves the box; it degrades to initials. The returned bytes are **magic-byte sniffed** (JPEG/PNG/GIF/WebP/BMP) before they reach QuestPDF, so a non-image 200 body can't throw inside the renderer or smuggle non-image content in. And the whole fetch sits behind a resilience pipeline whose timeouts and circuit-breaker trips are *all* caught — genuine caller cancellation still propagates, but every other failure degrades gracefully. The same review pass tightened the neighbours: the design gate and the generator share one `CvDesigns` enum as the source of truth, guarded so that any future gap between designs-listed and designs-built returns a clear `409 CV_DESIGN_COMING_SOON` rather than silently falling back to a mislabeled Design 1; the type-name discriminators are validated against their canonical pair so an entry can't persist and then vanish from the CV; and the `IsProfessionalProfile` bit is `COALESCE`-d so a NULL row can't throw. The feature that looked like "make a PDF" turned out to be a small pile of trust boundaries, and the review found the one that mattered.

## Impact

"The CV" now has exactly one definition. Six ATS-clean designs render server-side from one QuestPDF generator that the web app and the Flutter app both call, so there is no "web CV" versus "app CV" — there is one artifact, produced in one place, byte-for-byte. The paywall is real: the gate is enforced in the generator against a server-trusted flag, so the free tier is Design 1 and the other five genuinely require the 52-BDT Professional Profile — which runs on the shared payment ledger rather than a bespoke flow. The professional data finally has a proper editor: four domains with full add/edit/delete, every write owner-scoped. And the one network touchpoint is hardened — SSRF-guarded, magic-byte-checked, resilience-wrapped — so the artifact always renders and the generator can't be turned against the network it runs in. All of it is covered by 664 application, 40 infrastructure, and 70 mobile tests, including a `%PDF` smoke for every design over full and near-empty data so a missing section can't crash a download in production.

## Going deeper

The whole feature is documented as a parity port with a checklist, not a vibe: the legacy business rule (Design 1 free; 52 BDT unlocks the rest) is preserved exactly, but every trust decision the browser used to make is moved server-side and written down — the gate in the generator, the SSRF and image guards on the avatar fetch, the ownership scope on every write, the enumeration-safe `NOT_FOUND`. The design system is deliberately small — one render model, one theme table, one set of font-safe components, six layout files — so a seventh design is a class, not a rewrite, and the licensing (QuestPDF Community, free under the revenue threshold) is tracked as a real constraint. It leans on the generic `dbo.Payment` platform for the unlock, so the CV feature inherits the same self-healing settlement guarantees as every other paid thing on the marketplace — which is the quiet advantage of having built the boring, correct ledger first.

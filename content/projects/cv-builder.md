---
title: Professional Profile & CV Builder — One Server-Side Renderer, Six Designs, One Gate
date: 2026-06
tags: [dotnet, flutter, pdf, security, sqlserver]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
layout: case-study
---

# Professional Profile & CV Builder — One Server-Side Renderer, Six Designs, One Gate

**Summary:** Rebuilt the Partners.com.bd "Download My CV" feature from a client-side browser hack
into a server-owned single source of truth, across a Flutter app and a .NET API. A structured
professional-profile editor (four domains, full CRUD) feeds one server-side QuestPDF generator that
renders six professional designs identically for web and mobile; the six-design paywall is enforced
*inside the renderer* against a server-trusted flag, not in the UI; and the one place the generator
touches the network — the avatar fetch — is hardened against SSRF. The 52-BDT unlock runs on the
generic `dbo.Payment` ledger.

**Problem:** The legacy MVC dashboard rendered the CV **client-side** with `html2pdf.js` from the
user's professional-profile data (a header plus four lists — academic qualifications, employment
history, skills/languages, projects/theses); a free user got Design 1 and a 52-BDT "Professional
Profile" unlocked the other five. Three flaws fall out of that: the paywall was UI-deep (nothing
server-side stopped a client requesting a locked design), a future mobile app would re-implement the
templates and drift into a second, different CV, and the data had insert-and-delete stored procedures
only — no edit. The new API and mobile app had none of the feature. Per project rule, the client-side
approach was not to be copied.

**Approach:** Make the server the single source of truth for the rendered artifact, not just the
data. One QuestPDF generator behind `ICvDocumentGenerator` (Application interface, Infrastructure
impl) owns all six templates; web and mobile both call it and get byte-identical PDFs. The generator
is a thin dispatcher over a shared `CvRenderModel` (the render-ready view derived once), a `CvTheme`
palette table, and font-safe `CvComponents` (accent-dot bullets are drawn, not an icon font — no
"tofu" glyphs), with one `ICvTemplate` class per design and a Classic fallback rather than a blank.
The paywall moves into `GenerateCv` (`design != 1 && !IsProfessionalProfile → CV_DESIGN_LOCKED`
403); `GetCvDesigns` exposes a per-design `isUnlocked` flag for display only. The four profile domains
get full add/edit/delete, every write scoped `WHERE Id = @Id AND UserId = @UserId` with
enumeration-safe `NOT_FOUND`; one aggregation SP `dbo.UserCvDataGetByUserId` (five result sets) feeds
both preview and generator. The embedded avatar is best-effort and hardened — fetched only for an
absolute HTTPS URL on the configured CDN host, magic-byte sniffed, resilience-wrapped — and degrades
to a drawn initials circle on any failure. The 52-BDT unlock is built on the generic `dbo.Payment`
platform (bundle inline or bKash), flipping `IsProfessionalProfile`.

**Impact:** "The CV" has one definition — six designs rendered server-side by one generator that web
and mobile both consume, byte-for-byte, so there is no web-versus-app drift. The paywall is enforced
where the bytes are made, so a guessed design number gets a `403`, not a free CV, and the free tier
is genuinely Design 1. The professional data has a proper editor (four domains, full CRUD,
owner-scoped writes). The one network touchpoint is SSRF-guarded, magic-byte-checked, and
resilience-wrapped, so the generator can't be turned into a network probe and a broken CDN photo can
never 500 the download (it degrades to initials). Covered by 664 application + 40 infrastructure
tests (with the Flutter app under its own suite), including a `%PDF` smoke for every design over full
and near-empty data. Built on the
generic payment ledger, so the CV unlock inherits the same self-healing settlement guarantees as
every other paid feature.

**Tech stack:** .NET, ASP.NET Core, C#, MediatR, Dapper + stored procedures, SQL Server, QuestPDF
(server-side PDF), HybridCache, bKash / generic payment ledger, Flutter, xUnit

**Links:** (sole-engineer, both-ends build for a production marketplace — walk-through on request)

**Media:**
![Fig. 1 — one renderer, every client: four structured profile domains feed a single aggregation query, then one server-side QuestPDF generator — a thin dispatcher over a shared render model, a theme table, and font-safe components, with six ICvTemplate classes — produces byte-identical PDFs for the web app and the Flutter app, so a design has exactly one definition](/figures/cv-ssot-renderer.svg)
![Fig. 2 — from tap to PDF: a Download-My-CV request with a chosen design hits GenerateCv, which enforces the paywall against the server-trusted IsProfessionalProfile flag (design 1 free, 2–6 need Pro else CV_DESIGN_LOCKED), pulls the whole profile in one five-result-set query, builds the render model once, dispatches to a template, fetches the avatar through a hardened path or draws initials, and renders the PDF off the request thread](/figures/cv-download-flow.svg)
![Fig. 3 — the CV generator as an SSRF probe: to embed the avatar the server fetches a URL that traces back to a user-controllable field, so an internal address could be probed and its bytes embedded — fixed by only fetching absolute HTTPS URLs on the configured CDN host, magic-byte sniffing the response, and catching every resilience-pipeline failure, degrading to a drawn initials circle](/figures/cv-ssrf-guard.svg)
![Fig. 4 — six designs, one gate: the six CV designs each with their own accent palette (Classic, Sidebar Left/Right, Two-Column, Header Banner, Minimal), Design 1 free and 2–6 behind the 52-BDT Professional Profile gate enforced in the generator — while the client only ever receives an isUnlocked display flag](/figures/cv-designs-gate.svg)

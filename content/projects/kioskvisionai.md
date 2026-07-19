---
title: KioskVisionAI
date: 2025-06
tags: [dotnet, azure-functions, dotnet-aspire, vision-ai, event-driven, devops]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
---

# KioskVisionAI

**Summary:** A serverless visual-QA platform that watches a fleet of donation kiosks: it
screenshots every device on a schedule, runs Azure AI Vision over each frame, and — when it
finds a fault — restarts the kiosk and alerts the responsible operator, all without anyone
standing in front of the screen. Built as a .NET 9 Azure Functions app, orchestrated by .NET
Aspire, deployed to Azure Container Apps via `azd`.

**Problem:** Donation kiosks deployed across 60+ U.S. mosques fail silently — a frozen browser,
a "Webpage not available" screen, or a display that switched off means lost donations until a
volunteer physically notices, sometimes days later. Support needed eyes on every device, and a
hand back on the reset button, without traveling to the site.

**Approach:** A timer-triggered function (`KioskImageAnalysisFunction`) reads the fleet registry,
pushes a screenshot command to each kiosk through the KLR device API, downloads the frame, and
uploads it to Azure Blob Storage under `{Company}/{KioskId} - {Location}/{timestamp}.jpg` with
rich metadata (company, kiosk id, location, priority, status, last-check) — a queryable, auditable
**visual history of the whole fleet**. Azure AI Vision then inspects the frame. Today the shipped
detector is OCR (`VisualFeatures.Read`): any line containing `"Webpage not available"` marks the
kiosk faulted. Crucially the detection stage is a **pluggable seam** — the same
screenshot → analyze → act loop is built to extend to richer Vision AI checks (flagging
inappropriate or defaced content on a public screen, classifying screen state, auto-correcting the
display), so "is this screen healthy and appropriate?" becomes one gate for every device.

A fault isn't just logged — the system **self-heals**: it issues a restart command back to the
kiosk (KLR push type 2; reboot 201; screenshot 3) and enqueues an Azure Storage Queue message. A
separate queue-triggered `EmailNotificationFunction` consumes it, enriches it with live device
detail, and emails the operator — decoupling detection from notification so each retries and scales
on its own. A second timer function restarts kiosks that report online-but-screen-off, guarded by a
20-minute cancellation window and per-kiosk try/catch so one bad device never halts the sweep.
Scheduling is **timezone-aware and domain-aware**: a full sweep runs every Friday (Jumu'ah, the
peak donation day) and every four hours otherwise, in Eastern time. Error flow uses `FluentResults`
railway-style throughout; Aspire supplies orchestration, OpenTelemetry, and service discovery, and
`azd` generated the GitHub Actions delivery pipeline into Container Apps. (Cosmos DB persistence of
analysis results and Key Vault for secrets are the designed next steps.)

**Impact:** Kiosk faults that used to surface days later — as a confused congregation and missed
donations — now trigger an automatic restart and an operator alert within a scheduled sweep, across
200+ kiosks in 60+ organizations, with zero on-site visits for the common failures. The
metadata-tagged screenshot archive turns an invisible fleet into a searchable record, and the
Vision-AI detection seam means new checks ship as one analyzer, not a new system.

**Tech stack:** .NET 9, Azure Functions (isolated worker, v4), .NET Aspire, Azure Blob Storage,
Azure Storage Queues, Azure AI Vision (Image Analysis / OCR), OpenTelemetry, FluentResults,
Azure Developer CLI (azd), Azure Container Apps, GitHub Actions

**Links:** (private/work project — ask me for a walkthrough)

**Media:**
![Fig. 1 — the self-healing loop: a timer function screenshots each kiosk via the KLR API into metadata-tagged Blob storage, Azure AI Vision inspects the frame, and a fault fires a restart command plus a queue message that a separate mailer function turns into an operator alert — all orchestrated by .NET Aspire and shipped to Container Apps by azd](/figures/kioskvisionai-aspire-graph.svg)

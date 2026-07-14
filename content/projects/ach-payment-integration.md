---
title: ACH Payment Integration — One-time & Recurring
date: 2025-01
tags: [stripe, authorize-net, payments, dotnet]
featured: true
category: engineering
links:
  github: null
  live: null
status: active
---

# ACH Payment Integration — One-time & Recurring

**Summary:** Secure ACH, Apple Pay, and Google Pay payment workflows for donation kiosks
and recurring billing across Stripe and Authorize.Net.

**Problem:** U.S. mosque clients needed low-fee recurring donations (ACH beats card fees
substantially for large recurring gifts) plus modern wallet checkout — across two payment
processors, without compromising compliance or reliability.

**Approach:** Implemented ACH workflows on both Stripe and Authorize.Net APIs for
one-time and recurring transactions covering schools, events, and memberships. Added
Apple Pay and Google Pay through Stripe Payment Intents with tokenized wallet flows.
Hardened the pipeline for retries, webhooks, and reconciliation, and built the
operations layer around it: payment reporting and alerting, automated failed-payment
alerts, and scheduled donation summaries to admins and configured roles.

**Impact:** The wallet + ACH stack I built end to end runs inside a donation platform
moving **millions of dollars in annual volume for 20,000+ users** — secure recurring
revenue for every client, faster mobile checkout, and improved donation conversion
across one-time and recurring payments.

**Tech stack:** .NET Core, Stripe API (Payment Intents, ACH), Authorize.Net API,
SQL Server, webhooks

**Links:** (private/work project — ask me for a walkthrough)

**Media:**

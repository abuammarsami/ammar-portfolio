---
title: "ADR-0005: Vercel hosting with Web Analytics"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
deciders: [Md. Abu Ammar]
tags: [adr, hosting]
supersedes: null
superseded-by: null
related:
  - adr-0001-nextjs-static-rendering.md
---

# ADR-0005: Vercel hosting

**Status:** accepted · **Date:** 2026-07-04

## Context

Static site, Next.js, custom domain later, owner is job-hunting (wants to know when
recruiters visit). Zero-ops requirement.

## Decision

Vercel free tier: git-push deploys, preview deployments per branch, cookieless Web
Analytics, first-class Next.js support.

## Options considered

- **Cloudflare Pages** — great, but Next feature parity requires adapters.
- **GitHub Pages** — forces `output: export`, losing OG image generation and redirects.
- **Azure Static Web Apps** — on-brand with owner's Azure skills but more setup, less Next-native.

## Consequences

- (+) Zero-ops, previews for every change, analytics for recruiter visits.
- (−) Platform coupling (acceptable: the site is standard Next, portable in an afternoon).

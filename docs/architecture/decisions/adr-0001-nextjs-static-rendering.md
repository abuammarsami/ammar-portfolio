---
title: "ADR-0001: Next.js (App Router) with full static prerendering on Vercel"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
deciders: [Md. Abu Ammar]
tags: [adr, framework, rendering]
supersedes: null
superseded-by: null
related:
  - ../overview.md
  - adr-0005-vercel-hosting.md
---

# ADR-0001: Next.js (App Router) with full static prerendering

**Status:** accepted · **Date:** 2026-07-04

## Context

A personal portfolio: ~7 routes, content from markdown, one interactive canvas island.
Needs Lighthouse ≥95, SEO (job hunting), OG images, and markdown-only maintenance.
Latest-version policy: install newest stable of everything (Next 16 at build time).

## Decision

Next.js (latest, App Router, TypeScript strict). Every route is statically prerendered
(`force-static`) and served as CDN HTML from Vercel. We do **not** use `output: "export"`.

## Options considered

- **Astro** — better raw-static ergonomics, but the interactive quantum sim island +
  React ecosystem typing story is smoother in Next; RSC already gives zero client JS on content pages.
- **`output: "export"`** — saves nothing on Vercel, loses `opengraph-image.tsx`, `next/image`, redirects.
- **SvelteKit** — excellent, but no experience overlap with the owner's stack and no benefit here.

## Consequences

- (+) Zero-JS content pages via RSC; built-in metadata/OG/sitemap conventions; first-class Vercel.
- (−) Framework weight in dev tooling; must guard first-load JS budget (<130 kB) deliberately.

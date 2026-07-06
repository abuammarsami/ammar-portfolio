---
title: "Launch Checklist — custom domain, indexing, Scholar"
type: guide
status: active
owner: Md. Abu Ammar
created: 2026-07-06
last-reviewed: 2026-07-06
tags: [guide, launch, seo, scholar]
related:
  - local-development.md
  - ../architecture/decisions/adr-0005-vercel-hosting.md
  - ../architecture/decisions/adr-0008-research-library.md
---

# Launch checklist

Ordered on purpose: **the domain must be final before Google Scholar sees any
`citation_pdf_url`** — Scholar treats moved PDFs as new documents, so changing
the domain after indexing splits citations.

## 1. Custom domain (user action)

1. Buy the domain (any registrar).
2. Vercel → project → **Settings → Domains** → add it; follow the DNS
   instructions (A/ALIAS or CNAME). Keep the `*.vercel.app` URL — Vercel
   auto-redirects it to the primary domain.
3. Vercel → **Settings → Environment Variables** → set
   `NEXT_PUBLIC_SITE_URL=https://<domain>` for **Production**.
4. Redeploy (any push to main, or "Redeploy" in the dashboard) — `SITE_URL`
   is read at build time.

## 2. Verify every SITE_URL consumer

After the redeploy, `curl` (or open) each of these on the new domain and
check the URLs inside them point at the new domain, not vercel.app:

- [ ] `/sitemap.xml` and `/robots.txt`
- [ ] `<link rel="canonical">` on `/`, one project, one paper
- [ ] OG image URLs in page `<head>` (`og:image`, `twitter:image`)
- [ ] JSON-LD `url` fields (Person on `/`, project pages, paper pages)
- [ ] `citation_pdf_url` metas on papers with PDFs
- [ ] `/.well-known/agent-card.json` (A2A endpoints)
- [ ] `/llms.txt`, `/llms-full.txt`, `/resume.json`, `/colophon.json`
- [ ] `/api/mcp` (tool descriptors carry absolute URLs)

## 3. Search indexing

1. [Google Search Console](https://search.google.com/search-console): add the
   domain property, verify via DNS, submit `/sitemap.xml`.
2. Spot-check structured data with the
   [Rich Results test](https://search.google.com/test/rich-results) on `/`,
   one `/work/<slug>`, one `/research/<slug>`.
3. `/for/*` pitch pages must stay out: they are `noindex` and excluded from
   the sitemap (ADR-0011) — verify one if any exist.

## 4. Google Scholar (user action; after PDFs + domain)

Prerequisites already in place: `citation_*` Highwire metas on every paper
page, `citation_pdf_url` for papers with `pdf: true` (curated copies under
`public/papers/`, ADR-0008).

1. Create/claim the [Scholar profile](https://scholar.google.com/citations)
   with a verifiable email.
2. Add the thesis and directed-research papers manually if Scholar hasn't
   crawled them; point at the `/research/<slug>` pages.
3. Expectation-setting: Scholar's crawl of personal sites is best-effort and
   can take weeks. The metas + public PDFs are prerequisites, not a
   guarantee. Institutional repository copies (NSU library, arXiv where
   eligible) index far more reliably — link them from the paper pages if
   they exist.

## 5. Post-launch

- [ ] Vercel Web Analytics: confirm events flow on the new domain (ADR-0005).
- [ ] Re-run Lighthouse on the production domain (all ≥ 95, A11y/SEO/BP 100).
- [ ] Update the README / GitHub profile links to the new domain.

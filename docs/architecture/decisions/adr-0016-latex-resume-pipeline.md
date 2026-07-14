---
title: "ADR-0016: Single-repo LaTeX resume pipeline with CI-built PDF and verifiable provenance"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-14
last-reviewed: 2026-07-14
deciders: [Md. Abu Ammar]
tags: [adr, resume, ci, latex, provenance]
supersedes: null
superseded-by: null
related:
  - adr-0005-vercel-hosting.md
  - adr-0009-agent-operable-web-surfaces.md
---

# ADR-0016: Single-repo LaTeX resume pipeline with CI-built PDF and verifiable provenance

**Status:** accepted · **Date:** 2026-07-14

## Context

`public/resume.pdf` was a hand-exported file dropped into the repo whenever the
resume changed. That invites drift on three axes: the PDF vs. the site's `/cv`
content, the PDF vs. whatever source document produced it (which lived outside
the repo entirely), and the human-readable PDF vs. the machine-readable
`/resume.json` that agents consume (ADR-0009). There was also no way for a
recruiter holding a downloaded copy to check it against the canonical build.

## Decision

1. **`latex-resume/` in this repo is the canonical resume source** (`.tex`).
   The PDF is never edited or exported by hand.
2. **CI compiles it.** `.github/workflows/build-resume.yml` is path-filtered to
   `latex-resume/**` and compiles via `xu-cheng/latex-action@v3`, then
   bot-commits ONLY `public/resume.pdf` + `public/resume-manifest.json`. The
   workflow is loop-safe: its path filter ignores `public/`, so its own commit
   never retriggers it.
3. **Provenance is enforced, not promised.** The manifest records the build
   version (short hash, also printed in the PDF footer), commit, timestamp,
   sha256, and size. The `/verify` page renders it
   (`src/lib/resume-manifest.ts` + `src/app/verify/page.tsx`), and a sha256
   drift test (`src/lib/resume-manifest.test.ts`) fails the suite if the PDF is
   ever hand-replaced without a matching manifest.
4. **The PDF is agent-readable.** The build curls the deployed `/resume.json`
   (JSON Resume) and embeds it as a PDF attachment (extractable with
   `pdfdetach -saveall resume.pdf`), plus XMP metadata — one PDF serves both
   humans and agents.
5. **No runtime dependency added** (rule #3 compatible by construction): LaTeX
   tooling is CI-only, and the drift test uses `node:crypto`.

## Alternatives considered

- **Separate resume repo with Overleaf GitHub Sync** — rejected: Overleaf
  GitHub sync requires a premium plan the owner doesn't have, and a cross-repo
  bot commit needs a PAT with write access to this repo (secret management and
  security surface for no benefit over a path-filtered single-repo workflow).
- **Keep editing in Overleaf and manually exporting the PDF** — rejected: that
  is exactly the drift this ADR exists to eliminate.

## Consequences

- `public/resume.pdf` and `public/resume-manifest.json` become **bot-owned
  files** — hand edits are forbidden and are caught by the drift test.
- Resume edits are plain-text PRs in `latex-resume/`, reviewable like code.
- The embedded JSON Resume is only as fresh as the last Vercel deploy at the
  time the CI build curled `/resume.json` — a content change deployed after
  the last resume build isn't inside the PDF until `latex-resume/` next
  changes (acceptable: the PDF footer hash + `/verify` date make the vintage
  explicit).

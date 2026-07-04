---
title: "ADR-0003: Visual identity — preprint typography, entangled-pair accents, STIX/Plex"
type: adr
status: accepted
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
deciders: [Md. Abu Ammar]
tags: [adr, design]
supersedes: null
superseded-by: null
related:
  - ../../reference/design-tokens.md
  - adr-0004-hero-2d-canvas-over-webgl.md
---

# ADR-0003: Visual identity

**Status:** accepted · **Date:** 2026-07-04

## Context

Requirement: must not read as an AI-generated template, and must carry the owner's actual
identity — quantum ML research + ML engineering + backend rigor — for two audiences
(recruiters and professors). Four motifs were requested; unfused they'd be four gimmicks.

## Decision

**Base = research-paper minimalism. Signature = one quantum interactive (hero only).
Accents = monospace metadata. Neural motifs = real labeled figures only** (never ambient
node-graph backgrounds — the #1 AI-portfolio tell).

- Fonts: **STIX Two Text** (serif; the STM scientific-publishing typeface) for headings/prose,
  **IBM Plex Sans** for UI, **IBM Plex Mono** for metadata/terminal. Plex is IBM Quantum's
  typeface; the owner ran circuits on IBMQ — the pairing is biographical.
- Palette (dark default): `--bg #0B0D12`, `--surface #12151D`, `--ink #E9E7E0`,
  `--muted #8A8F9C`, accents `--q0 #5FC9BF` (|0⟩ teal) and `--q1 #9D8CFF` (|1⟩ violet).
  Light mode = print-paper `#FBFAF7`.
- **Entangled-pair interaction motif:** the two accents always respond as a correlated pair
  (hover a card → its border takes `--q0` while its paired tag takes `--q1`; link underlines
  render as a two-color superposition that collapses to one on click).
- §-numbered sections on case-study pages only; "Fig. N" captions; BibTeX cite blocks;
  footer rendered as a shell prompt.

## Options considered

- Single-motif designs (pure terminal, pure paper) — each serves one audience, not both.
- Computer Modern webfont — authentic LaTeX but poor screen hinting; STIX is the professional answer.

## Consequences

- (+) Distinctive, biographical, systematic; motifs have exclusive territories so nothing competes.
- (−) Custom typography/tokens demand discipline — enforced via `globals.css` as single source.

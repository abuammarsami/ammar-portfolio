---
title: "Design Tokens"
type: reference
status: active
owner: Md. Abu Ammar
created: 2026-07-04
last-reviewed: 2026-07-04
tags: [reference, design]
related:
  - ../architecture/decisions/adr-0003-visual-identity.md
---

# Design Tokens

Single source of truth is `src/styles/globals.css` (`@theme` + `[data-theme]` blocks).
This doc explains intent; the CSS is the implementation.

## Color

| Token | Dark (default) | Light | Role |
|---|---|---|---|
| `--color-bg` | `#0B0D12` | `#FBFAF7` | page ground (blue-black night / print paper) |
| `--color-surface` | `#12151D` | `#F1EFE9` | cards, code blocks |
| `--color-ink` | `#E9E7E0` | `#16181D` | body text (warm paper-white / near-black) |
| `--color-muted` | `#8A8F9C` | `#6B7080` | metadata, captions |
| `--color-q0` | `#5FC9BF` | `#0E7C72` | \|0⟩ accent (teal) — entangled pair A |
| `--color-q1` | `#9D8CFF` | `#5F49C9` | \|1⟩ accent (violet) — entangled pair B |

**Entangled-pair rule:** `--q0` and `--q1` are always used as a correlated pair in
interactions (hover/focus states shift paired elements to opposite accents). Never
introduce a third accent.

## Type

| Family | Token | Used for |
|---|---|---|
| STIX Two Text | `--font-serif` | headings, long-form prose (preprint voice) |
| IBM Plex Sans | `--font-sans` | UI, nav, labels |
| IBM Plex Mono | `--font-mono` | dates, tags, BibTeX, terminal footer, epoch counters |

Loaded via `next/font` with metric-adjusted fallbacks → CLS 0.

## Spacing / rules

- Hairline rules: `1px solid color-mix(in srgb, var(--color-muted) 25%, transparent)`.
- §-numbered headings and "Fig. N" captions appear on case-study pages only.

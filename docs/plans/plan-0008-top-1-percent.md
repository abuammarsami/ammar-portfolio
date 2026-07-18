---
title: "Plan 0008: The path to top-1% — trust-breaker fixes, AI reliability, and flagship bets"
type: plan
status: draft
owner: Md. Abu Ammar
created: 2026-07-18
last-reviewed: 2026-07-18
tags: [plan, ui-ux, ai, evals, agent, performance, r-and-d]
related:
  - plan-0004-agent-operable-site.md
  - plan-0005-living-portfolio.md
  - plan-0007-next-generation-ideas.md
  - ../architecture/decisions/adr-0006-learn-webgl-scope.md
  - ../architecture/decisions/adr-0007-agent-layer.md
  - ../architecture/decisions/adr-0011-published-output-honesty.md
  - ../guides/pending-user-actions.md
---

# Plan 0008 — the path to top-1%

R&D synthesis from three parallel investigations (2026-07-18): a code-grounded UI/UX + AI
audit, a chat-reliability diagnosis, and an external study of what actually impresses senior
Anthropic/Google engineers in 2026. Goal: move the site from "top ~3–5%, clearly crafted" to
"this person is exceptional."

> **Verdict.** The substrate is already right — single-source design tokens, a unit-tested
> dependency-free quantum sim, CI-enforced per-route JS budgets, honesty contracts on every
> published model output (ADR-0011), provenance-stamped resume. What separates *impressive* from
> *exceptional* is a small number of **broken promises** (visible spots that claim interactivity
> or liveness they don't deliver) and a few **under-exploited flagship surfaces**. The
> trust-breakers are cheap to fix and are the highest-leverage work. Everything additive here is
> content or a native-platform swap — **no new runtime dependency without an ADR** (CLAUDE.md §5).

**The governing constraint for anything on `/`:** the homepage sits at **~199/200 kB** of its
eager JS budget (`scripts/check-budgets.mjs`). Any new homepage client feature MUST be a lazy
`next/dynamic` chunk bound to an existing island. WebGL stays under `learn/**` +
`quantum/three/**` (ADR-0006). Content only from `content/*.md`.

---

## 0. Shipped this session (already in the working tree, uncommitted)

- **KioskVisionAI page rewritten** for accuracy + depth (`content/projects/kioskvisionai.md` +
  redrawn `public/figures/kioskvisionai-aspire-graph.svg`) — corrected from "microservices" to a
  serverless Azure Functions self-healing OCR *visual-QA platform*; Vision-AI framed as a
  pluggable detection stage (OCR = v1).
- **Mosque Search flagship case-study created** (`content/projects/mosque-search.md` +
  `content/case-studies/mosque-search.md` + 3 SVG figures) — "semantic-quality relevance with zero
  ML", honest that it's classical IR (FuzzySharp + DisMax), with the real exact-match war story.
- **Chat rate-limit mitigated** (`src/lib/agent/chat-loop.ts`): `maxHops` 3→2, `TOOL_RESULT_MAX`
  8000→3000 (≈25–40% fewer tokens/question under the free-tier 8k-TPM ceiling), and an **honest
  cooldown** that reads the provider's real `retry-after` header instead of a hard-coded "15s".
  +7 tests. This reduces 429 frequency but does not eliminate it — see §3 for the durable fix.
- **Clipboard defect fixed** (`src/components/quantum/composer.tsx`): the `share()` copy-link
  write was unguarded and threw on insecure-context/denied permission; now try/caught to match
  `interview-mode.tsx`.

All gates green: typecheck + lint clean, **176 tests**, production build + budgets OK, both
`/work` routes prerender.

---

## 1. Tier 1 — quick wins (S, low risk). Remove the trust-breakers first.

A sharp reviewer hits these in the first two minutes and quietly downgrades the whole site.
Almost all are content-only or a few lines. **Highest leverage in the plan.**

| # | Fix | Where | Effort |
|---|-----|-------|--------|
| 1 | **Bloch sphere says "drag me" but isn't draggable.** Copy implies orbit control; `bloch-stage.tsx` has no `OrbitControls`/pointer handlers (canvas is `aria-hidden`, slow auto-rotate only). Fix copy now ("watch it rotate / move the sliders"); add real drag later (§3, item 14). | `content/learn/01-qubit.md:26`, L3 | S (copy) |
| 2 | **Lesson prose over-promises motion the demo never shows.** e.g. `04-measurement.md:26` says shots "flash and snap to a pole" but `lessons.tsx` lerps smoothly; `:37-38` instructs "measure there and watch both arrows snap" but `EntanglementLesson` has no measure button (dead instruction); `02-superposition.md:20-21` and `06-quanvolution.md:27-28` similar. Edit markdown to describe what actually renders (or ticket the demo upgrade). | `content/learn/*.md` | S each |
| 3 | **Mobile shows NO hero.** `page.tsx:93` wraps the canvas *and its `CircuitStatic` fallback* in `hidden md:block`, so phones get nothing — yet the engineer subheading still says "drag the data points." Render `CircuitStatic` (server SVG, zero JS) on mobile. | `src/app/page.tsx:93` | S |
| 4 | ✅ **Unguarded clipboard write** — fixed this session. | `composer.tsx` | done |
| 5 | **Nav label/route mismatch.** Nav renders "writing" pointing at `/deep-dives`; ADR-0015 defers the `/deep-dives → /writing` rename + redirect as "the recommended next refactor." Do the rename (add redirect) or accept as a known smell. | `src/components/ui/nav.tsx:8` | S–M |
| 6 | **WebGL Bloch stage has no loading state.** `bloch-3d.tsx` `dynamic(…, { ssr:false })` has no `loading:` prop → blank gap while the three.js chunk fetches. The composer got a skeleton (`composer-loader.tsx`); the Bloch stage didn't. | `src/components/quantum/three/bloch-3d.tsx` | S |
| 7 | **Surface the perf story as a credibility flex.** The `/colophon` per-route budget bars and `/verify` sha256 provenance are rare and impressive but buried in the footer. Add a one-line "measured, not claimed" strip near the home footer / About dossier that deep-links to both. | `content/*`, footer | S |

---

## 2. Tier 2 — medium bets (M). Meaningful polish, within all constraints.

- **8. Enforce citations in chat the way `/pitch` and `/fit` already do.** `/api/chat` only *asks*
  the model to cite (`chat/route.ts:31-34`); `/pitch` (`pitch.ts:39-55`) and `/fit`
  (`fit-prompt.ts:37-44`) mechanically validate internal-path citations + require "Honest gaps."
  Post-validate chat claims carry an `isInternalPath` anchor (machinery already in
  `chat-actions.ts`) and render them as deep-link chips. Turns "trust me" into checkable — the
  site's whole ethos. *(External research ranks a grounded, citation-checked chat as the single
  highest-signal AI feature for this audience.)*
- **9. Kill the invisible chat latency.** The loop runs up to 2 non-streamed tool hops before any
  token streams; the UI shows nothing meanwhile. Emit lightweight "searching publications…"
  activity events during hops (`chat-loop.ts` → `interview-mode.tsx`).
- **10. Quanvolution grid keyboard/touch-usable.** `quanvolution-demo.tsx` cells are
  `<button tabIndex={-1} aria-hidden>` with only `onPointerDown/Enter` — keyboard/SR users can't
  use L6 and touch drag-paint is broken. Also a Lighthouse-A11y-100 compliance risk.
- **11. WebGL robustness on `/learn`** (spirit of ADR-0006): no error boundary around `<Canvas>`
  (lost context is unrecoverable); `frameloop="always"` + per-frame bloom with no off-screen pause
  (battery drain — the 2D hero pauses, the 3D stage doesn't); `key={active}` recreates the GL
  context every scroll step and mobile mounts up to 3 live contexts, contradicting the
  "single context" contract. Keep `/learn` ≤350 kB, Lighthouse ≥95.
- **12. SVG Bloch fallback drops the φ (phase) dimension** (`bloch-svg.tsx` uses only x,z) — so
  reduced-motion/no-WebGL users, the accessible path, lose the entire point of L1/L2. Add a
  y-projection or numeric phase readout.
- **13. Ranked retrieval without breaking the no-RAG ADR.** `search_publications` and WebMCP
  `searchCorpusSections` are literal `.includes(q)` — "distributed transactions" won't match
  "event-driven saga." A **build-time synonym/stem expansion + term-frequency ranking** over the
  existing corpus stays zero-runtime-dep (ADR-0007 rejects vector DBs) and fixes most misses.

---

## 3. Tier 3 — flagship bets (L, need an ADR / approval). Highest ceiling.

Ranked by impact-to-effort for the "exceptional" impression. Most map to `plan-0007` Bucket B.

- **14. Make the Bloch sphere genuinely interactive** (drag-to-orbit + drag-the-arrow to set
  θ/φ). Closes the #1 trust gap (item 1) and turns L1–L3 from "watch" to "manipulate." drei
  `OrbitControls` is already in-scope under ADR-0006. **Single highest-visibility flagship fix.**
- **15. Turn the parameter-shift rule into a live widget.** `05-variational.md:20-23` explains the
  ±π/2 gradient trick in prose; the L5 canvas never shows the two shifted evaluations or the
  gradient. A "turn the dial ±π/2 → see ⟨Z⟩(+)/⟨Z⟩(−) → gradient descends" widget would be the
  standout demo on the site and is 100% powered by the existing tested `statevector.ts`.
- **16. "Chat with this codebase" — the most on-brand AI feature not yet built.** The repo itself
  (hand-rolled MCP JSON-RPC, closed-grammar autopilot, zero-dep streaming) is the portfolio's best
  artifact, but no tool exposes it. A read-only `get_source` / `explain_implementation` MCP tool
  over a curated source allowlist lets a recruiter's agent inspect *how* the AI layer is built.
  Uniquely credible for an "AI-native" portfolio; new tool via the existing shared `TOOLS` layer,
  no new dep.
- **17. Eval-backed chat + published eval harness** *(external research's #1 recommendation)*.
  Publish ~20–40 held-out questions about the work, each with a rubric, an LLM-judge verdict
  calibrated against your own labels, transcripts you've read, and a groundedness/refusal check —
  rendered as a Distill-style table. This is *the* Anthropic interview competency
  ([evals guide](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)) rendered
  as a live artifact. Pairs with item 8. Needs an ADR under the ADR-0011 output-honesty contract.
- **18. Prompt-injection-safe agent design write-up + live red-team demo.** The site exposes
  MCP/WebMCP tools + chat — an attack surface. A short write-up of the trust-boundary/allow-list/
  output-constraint defenses, plus a box where a visitor pastes an injection and watches the layers
  catch it. Indirect prompt injection is **OWASP's #1 LLM threat in 2026**; almost no portfolio
  demonstrates a defense hands-on, and it's directly mission-adjacent for an Anthropic audience.
- **19. Bucket-B frontier features** (from `plan-0007`, ranked): **"Roast me"** adversarial
  red-team (the twin plays a skeptical staff engineer and honestly names weaknesses — a weak model
  *can't* do this, so it proves model quality) and **proof-carrying claims** (every headline stat
  links to a re-derivation from real code/data — extends the colophon "receipts" ethos). Both need
  an ADR under ADR-0011.
- **20. Close the `/hire` funnel + wire the manifesto.** `/hire` dead-ends at `mailto:`;
  `content/essays/your-career-as-an-api.md` is written but unrouted (per `pending-user-actions.md`).
  Wire the essay as a `/writing` entry + add a real booking/deposit CTA (Stripe/Calendly = new deps
  → ADR + your accounts).

---

## 4. Chat reliability — the durable fix (beyond this session's mitigation)

Root cause: **Groq free tier ≈ 8,000 tokens/minute**; the system prompt + tool schemas ride every
loop hop, so one tool-using question spends a large multiple of that and 429s. The same
`GROQ_API_KEY` is shared across `/api/chat`, `/api/fit`, `/api/pitch`, `/api/tour`, so any
concurrent visitor (or the autopilot tour) compounds the bucket. This session cut per-question
spend; the two durable fixes need your decision:

- **A. Route through Vercel AI Gateway with a fallback chain (recommended).** The Gateway is
  OpenAI-compatible, so the hand-rolled `fetch` loop is unchanged — swap the URL/key and add a
  `models` fallback (Groq 429 → transparently retries another provider). Gives unified credits,
  higher effective limits, and observability. **Needs:** an `AI_GATEWAY_API_KEY` in Vercel + an ADR
  superseding ADR-0007's "direct Groq free-tier" decision (provider wiring change). Keep a
  `process.env.AI_GATEWAY_URL ?? groqUrl` fallback so behavior is unchanged until the key is set.
- **B. Pre-cache the fixed starter questions (biggest UX win, zero token cost).** The 4 `STARTERS`
  in `interview-mode.tsx` are what most visitors click and the main 429 source; their answers are
  effectively static. Serve them from a build-time/`unstable_cache` map keyed on a content hash
  before touching Groq. Combine with a small FAQ map. Removes most upstream calls entirely.
- **C. Client auto-retry on 429.** Now that the server returns the honest cooldown, have
  `interview-mode.tsx` auto-retry once after that delay with a "one moment…" state instead of just
  printing the error. (Watch the `/` budget — keep it minimal, bound to the existing island.)

Recommended: **B + C** immediately (no new infra), then **A** for durable reliability with an ADR.

---

## 5. External themes that govern the above (what this audience rewards)

From the study of Anthropic/Google-senior signal (sources below):
- **Verifiable depth over feature count.** Every hard number linked to a checkable source (CI
  badge, build artifact, manifest) — extend the `/verify` + `check-budgets` ethos site-wide (items
  7, 19).
- **Self-critique as a first-class section.** A short unflinching "Limitations & what I'd change"
  on each case study is the single most-cited thing senior engineers reward, and it's nearly free
  (pure `content/*.md`).
- **Writing that teaches (incl. null results).** One Bret-Victor/Distill-grade explorable essay on
  the quantum work (reusing `statevector.ts`), and a terse dated "working notes / research log."
  Anthropic explicitly hires people who "like writing up results, even when they're null."
- **Interaction craft in the invisible details.** High-frequency actions (command palette, menus)
  should appear *instantly, no animation*; keyboard-first with visible focus; interruptible motion.
  This is the vocabulary of the design engineers this audience venerates (Rauno Freiberg, Emil
  Kowalski). One gimmick undoes ten tasteful details — the CLAUDE.md anti-gimmick rules already
  bank this.
- **Native platform motion.** Prefer the **View Transitions API** + **CSS scroll-driven
  animations** (compositor, zero-KB JS) over JS motion where possible — the exact intersection of
  craft and the JS budget.
- **Frontier agent surfaces, honestly.** Move WebMCP to the native `navigator.modelContext` API
  with the widget as fallback; add a single `/.well-known/ai-catalog.json` (Agentic Resource
  Discovery). *But say plainly on the page that agent-surfaces have near-zero referral payoff today
  — you do them for correctness/demonstration.* That candor is itself the senior signal.

**Explicitly do NOT:** add an ungrounded "ask me anything" bot (a negative signal — the value is
entirely grounding + evals + refusal); chase AI-SEO citation optimization (near-zero payoff); let
quantity creep in (3–5 deep, self-critiqued artifacts beat a wall of repos).

---

## Recommended sequence

1. **This week:** Tier 1 items 1–3, 5–7 (cheap, remove the trust-breakers) + chat fix B (starter
   cache) + C (auto-retry).
2. **Next:** item 8 (chat citations) + a self-critique block on each case study (§5) — lean into
   the honesty brand you already own.
3. **Flagship #1:** item 14 (interactive Bloch) *or* 15 (parameter-shift widget) — the "wow"
   upgrade to `/learn`.
4. **Flagship #2 (AI-native differentiator):** item 16 (chat-with-codebase) → item 17 (eval
   harness) → item 18 (prompt-injection demo). Each new runtime dep or published-model-output
   surface gets an ADR (CLAUDE.md §5, ADR-0011).

## Sources
- [Demystifying evals for AI agents — Anthropic](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
- [Anthropic Applied AI Engineer interview analysis](https://getperspective.ai/blog/anthropic-applied-ai-engineer-interview-process-frontier-lab-2026)
- [Invisible Details of Interaction Design — Rauno Freiberg](https://rauno.me/craft/interaction-design) · [Devouring Details — Emil Kowalski](https://devouringdetails.com/)
- [Join the WebMCP origin trial — Chrome](https://developer.chrome.com/blog/ai-webmcp-origin-trial) · [How to make your website agent-ready](https://suganthan.com/blog/how-to-make-website-agent-ready/)
- [Prompt Injection: OWASP #1 LLM threat 2026](https://www.kunalganglani.com/blog/prompt-injection-2026-owasp-llm-vulnerability) · [12-layer defense framework](https://www.digitalapplied.com/blog/prompt-injection-defense-12-layer-framework-2026)
- [View Transitions & scroll-driven animation, 2026](https://www.frontendhorizon.com/blog/view-transitions-api-and-css-scroll-driven-animations-the-browser-wins-of-2026)
- [Explorable Explanations — Bret Victor](https://worrydream.com/ExplorableExplanations/) · [Distill: Interactive Articles](https://distill.pub/2020/communicating-with-interactive-articles/)
- [Software Engineer Portfolios 2026 — sitebuilderreport](https://www.sitebuilderreport.com/inspiration/software-engineer-portfolios)

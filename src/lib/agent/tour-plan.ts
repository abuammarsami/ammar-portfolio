import { clampHeroX } from "@/lib/agent/hero-bridge";
import { isLens } from "@/lib/agent/lens";
import type { TourStep } from "@/lib/agent/tour-script";
import { PAGES } from "@/lib/agent/webmcp-tools";

/**
 * Dynamic autopilot (plan-0006): the model PLANS a tour, but only this
 * validator decides what runs. Every step is rebuilt field-by-field against
 * a closed grammar — allowlisted tools with per-tool argument shapes,
 * allowlisted cursor targets, clamped dwell times, capped captions. Anything
 * off-grammar rejects the whole plan and the static tour runs instead, so
 * the demo can never break and the model can never steer beyond the demo's
 * own vocabulary. Client-safe: revalidated in the browser before running.
 */

export const INTEREST_MIN = 4;
export const INTEREST_MAX = 200;

export function validateInterest(raw: unknown): raw is string {
  return typeof raw === "string" && raw.trim().length >= INTEREST_MIN && raw.length <= INTEREST_MAX;
}

/** The cursor may only point at page landmarks — never model-authored selectors. */
export const TOUR_TARGETS = new Set(["nav", "canvas", "main", "footer"]);

const CAPTION_MAX = 160;
const DWELL_MIN = 1800;
const DWELL_MAX = 6000;
const DWELL_DEFAULT = 3200;
export const PLAN_STEPS_MAX = 9; // 8 planned + the appended outro

const safeQuery = (v: unknown): string | null =>
  typeof v === "string" && /^[a-z0-9 .-]{1,64}$/i.test(v.trim()) ? v.trim() : null;

/** Per-tool argument grammar: returns cleaned args, or null to reject the plan. */
const PLAN_TOOLS: Record<string, (args: Record<string, unknown>) => Record<string, unknown> | null> = {
  query_portfolio: (a) => {
    const query = safeQuery(a.query);
    return query ? { query } : null;
  },
  get_paper: (a) =>
    typeof a.slug === "string" && /^[a-z0-9-]{1,64}$/.test(a.slug) ? { slug: a.slug } : null,
  navigate_to: (a) => (typeof a.page === "string" && a.page in PAGES ? { page: a.page } : null),
  run_quantum_demo: (a) => {
    const x0 = typeof a.x0 === "number" && Number.isFinite(a.x0) ? clampHeroX(a.x0) : null;
    const x1 = typeof a.x1 === "number" && Number.isFinite(a.x1) ? clampHeroX(a.x1) : null;
    return x0 !== null && x1 !== null ? { x0, x1 } : null;
  },
  set_lens: (a) => (isLens(a.lens) ? { lens: a.lens } : null),
  get_resume_summary: () => ({}),
};

/** The tour always lands on-message, whatever the model planned. */
export const TOUR_OUTRO: TourStep = {
  caption: "End of tour — the portfolio, operating itself. Point your own agent at /api/mcp and interview it properly.",
  dwellMs: 4200,
};

function validateStep(raw: unknown): TourStep | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;

  if (typeof s.caption !== "string") return null;
  const caption = s.caption.replace(/\s+/g, " ").trim();
  if (caption.length === 0 || caption.length > CAPTION_MAX || caption.startsWith("@@")) return null;

  const step: TourStep = {
    caption,
    dwellMs: Math.min(DWELL_MAX, Math.max(DWELL_MIN, typeof s.dwellMs === "number" ? s.dwellMs : DWELL_DEFAULT)),
  };

  if (typeof s.target === "string" && TOUR_TARGETS.has(s.target)) step.target = s.target;

  if (s.tool !== undefined) {
    const t = s.tool as { name?: unknown; args?: unknown } | null;
    if (!t || typeof t.name !== "string") return null;
    const grammar = PLAN_TOOLS[t.name];
    if (!grammar) return null;
    const rawArgs = t.args && typeof t.args === "object" && !Array.isArray(t.args) ? (t.args as Record<string, unknown>) : {};
    const args = grammar(rawArgs);
    if (args === null) return null;
    step.tool = { name: t.name, args };
    if (t.name === "run_quantum_demo") {
      step.waitForHero = true;
      step.showResult = true;
      step.target = "canvas";
    }
  }
  return step;
}

/**
 * Model output (`{steps:[...]}` or a bare array) → runnable TourStep[], or
 * null. Strict: one off-grammar step rejects the whole plan. Never throws.
 */
export function validateTourPlan(raw: unknown): TourStep[] | null {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const list = Array.isArray(raw) ? raw : ((raw as { steps?: unknown } | null)?.steps ?? null);
  if (!Array.isArray(list) || list.length < 2 || list.length > PLAN_STEPS_MAX) return null;
  const steps: TourStep[] = [];
  for (const item of list) {
    const step = validateStep(item);
    if (!step) return null;
    steps.push(step);
  }
  return steps;
}

export function buildTourSystemPrompt(profile: string): string {
  return [
    "You plan a guided autopilot tour of Md. Abu Ammar's portfolio site: a synthetic cursor performs your steps live in the visitor's browser while captions narrate. The visitor told you what they want to see; pick the most relevant material from the profile below.",
    'Respond with ONLY a JSON object: {"steps": [{"caption": "...", "tool": {"name": "...", "args": {...}}, "dwellMs": 3200}]}',
    "",
    "3 to 7 steps. Rules:",
    `- caption: first person as the site's own agent, <=150 chars, concrete (name real projects/papers/numbers from the profile).`,
    "- The FIRST step should have no tool — an opening line tailored to the visitor's interest.",
    "- tool is optional per step; allowed tools and args, exactly:",
    '  query_portfolio {"query": "<keyword>"} — search the corpus',
    '  get_paper {"slug": "<paper-slug from the profile>"} — fetch a paper',
    `  navigate_to {"page": "<${Object.keys(PAGES).join(" | ")}>"} — drive the browser to a page`,
    '  run_quantum_demo {"x0": <number>, "x1": <number, in [-1.57, 1.57]>} — retrain the live homepage quantum classifier (use at most once, only after navigate_to home)',
    '  set_lens {"lens": "recruiter" | "professor" | "engineer"} — re-weight the site for an audience',
    "  get_resume_summary {} — fetch the machine-readable summary",
    "- dwellMs: 2000-5000, longer for captions worth reading.",
    "- Only slugs, pages, and facts that appear in the profile. Never invent.",
    "",
    "--- PROFILE ---",
    profile,
  ].join("\n");
}

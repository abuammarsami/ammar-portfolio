/**
 * The fit-report engine's pure core (ADR-0009): brief validation and the
 * grounded system prompt. Honesty is the contract — the report must map
 * requirements to real evidence with site-path citations and must always
 * include what he has NOT done.
 */

export const BRIEF_MIN = 40;
export const BRIEF_MAX = 4000;

export type FitAudience = "recruiter" | "professor";

export function validateBrief(brief: unknown): brief is string {
  return typeof brief === "string" && brief.trim().length >= BRIEF_MIN && brief.length <= BRIEF_MAX;
}

export function normalizeAudience(audience: unknown): FitAudience {
  return audience === "professor" ? "professor" : "recruiter";
}

export function buildFitSystemPrompt(corpus: string, audience: FitAudience): string {
  const briefKind = audience === "professor" ? "research topic or lab description" : "job description";
  const angle =
    audience === "professor"
      ? "Judge research fit: methods experience, publications, evidence of independent work, gaps in the research background."
      : "Judge role fit: production experience, stack overlap, scale handled, gaps against the requirements.";
  return [
    `You are the fit-report engine for Md. Abu Ammar's portfolio. A ${audience} pasted a ${briefKind}. ${angle}`,
    "Using ONLY the corpus below, write a markdown report with EXACTLY these four sections:",
    "",
    "## Fit summary",
    "2–3 plain sentences.",
    "",
    "## Requirement by requirement",
    "One bullet per requirement you extract from the brief, formatted as:",
    "**requirement** — evidence from the corpus, citing site paths like /work/kioskvisionai or /research/quantum-machine-learning-thesis — strength: strong | partial | none.",
    "",
    "## Honest gaps",
    "REQUIRED and never empty unless the fit is truly perfect: what the brief asks for that he has NOT demonstrably done. Do not soften. If evidence is absent from the corpus, that is a gap.",
    "",
    "## Verdict",
    "One plain-spoken paragraph: recommend or don't, and for what kind of role/collaboration.",
    "",
    "Rules: never invent projects, employers, numbers, papers, or skills; cite at least one site path for every 'strong' claim; keep the whole report under 600 words; do not use the first person as if you were him.",
    "",
    "--- CORPUS ---",
    corpus,
  ].join("\n");
}

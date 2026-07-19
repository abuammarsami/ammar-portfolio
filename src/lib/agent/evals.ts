import { isInternalPath } from "./chat-actions";

/**
 * The published eval scorer (ADR-0019, plan-0008 §3 item 17). Anthropic's own
 * hiring bar treats evals — held-out questions with rubrics, groundedness, and
 * refusal checks — as a first-class competency. This turns the "Ask Ammar" chat
 * from "trust me" into a checkable artifact: a deterministic, dependency-free
 * scorer over the agent's answers, rendered as a Distill-style table at /evals.
 *
 * Deliberately NOT an LLM-as-judge for the core verdict: the scoring is a pure
 * function so the same case always scores the same way, in CI, in a test, and on
 * the page. (An optional model judge can layer on top in the harness; the
 * published pass/fail is the deterministic one.)
 */

export type EvalCategory = "grounded" | "refusal";

/** One held-out case: a question plus the rubric a correct answer must satisfy. */
export type EvalCase = {
  id: string;
  category: EvalCategory;
  question: string;
  /** Every phrase must appear in the answer (case-insensitive substring). */
  mustInclude: string[];
  /** No phrase may appear — catches fabrication / wrong claims. */
  mustExclude: string[];
  /** Internal routes the answer should cite (at least one), e.g. /work/kioskvisionai. */
  expectPaths: string[];
  note?: string;
};

export type Verdict = {
  id: string;
  category: EvalCategory;
  /** Every internal-looking path the answer cited is a real site route. */
  grounded: boolean;
  /** All mustInclude present, no mustExclude present, and any expected path cited. */
  rubricPass: boolean;
  /** For refusal cases: the answer actually declined instead of inventing an answer. */
  refusalPass: boolean;
  citedPaths: string[];
  fabricatedPaths: string[];
  pass: boolean;
  reasons: string[];
};

/** Split a `;`-separated rubric cell into trimmed, non-empty phrases. */
function cell(list: string): string[] {
  return list
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse the `## Cases` markdown pipe table into typed cases. Columns:
 * `id | category | question | must_include | must_exclude | expect_paths`.
 * List cells are `;`-separated. Header and `---` separator rows are skipped.
 */
export function parseEvalCases(table: string): EvalCase[] {
  const rows = table
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|"));
  const cases: EvalCase[] = [];
  for (const row of rows) {
    const cols = row
      .slice(1, row.endsWith("|") ? -1 : undefined)
      .split("|")
      .map((c) => c.trim());
    const [id, category, question, mustInclude = "", mustExclude = "", expectPaths = ""] = cols;
    if (!id || id.toLowerCase() === "id") continue; // header row
    if (/^-+$/.test(id)) continue; // separator row
    if (category !== "grounded" && category !== "refusal") continue;
    cases.push({
      id,
      category,
      question: question ?? "",
      mustInclude: cell(mustInclude),
      mustExclude: cell(mustExclude),
      expectPaths: cell(expectPaths),
    });
  }
  return cases;
}

// the leading (?<![A-Za-z0-9]) keeps "CI/CD", "and/or", "km/h" from yielding a
// bogus "/CD"; the isInternalPath filter below keeps only real route *shapes*.
const PATH_RE = /(?<![A-Za-z0-9])\/[a-z0-9][a-z0-9/#-]*/gi;

/**
 * Pull the internal *page* routes an answer cites. Only tokens matching a real
 * route shape (isInternalPath — top page, or /work|/research/<slug>) count as
 * citations; prose fragments ("CI/CD") and non-page assets ("/llms.txt") are
 * not route claims and are ignored, so they never read as hallucinations.
 */
export function extractInternalPaths(answer: string): string[] {
  const found = answer.match(PATH_RE) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of found) {
    // trim trailing punctuation the sentence may have glued on
    const p = raw.replace(/[.,;:)\]]+$/, "");
    if (p.length > 1 && isInternalPath(p) && !seen.has(p)) {
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

const REFUSAL_RE =
  /\b(don'?t|do not|doesn'?t|isn'?t|won'?t|will not|refuse|decline|not sure|can'?t confirm|cannot confirm|no (?:public )?record|not (?:in|part of|listed|something)|couldn'?t find|reach out|email him|contact him|i don'?t have|not available)\b/i;

/**
 * Score one answer against its case, deterministically. `knownPaths` (optional)
 * is the real route set — a cited path is *fabricated* when it fails the
 * internal-path format check, or is a well-formed detail route (/work/x,
 * /research/x) whose slug isn't in `knownPaths`. Top-level pages always pass.
 */
export function scoreAnswer(c: EvalCase, answer: string, knownPaths?: ReadonlySet<string>): Verdict {
  const text = answer.toLowerCase();
  const reasons: string[] = [];

  // every citedPath already passes isInternalPath (a real route shape). With a
  // known-route set, a /work|/research detail route whose slug isn't real is a
  // fabrication; top-level pages are trusted. No set → shape is all we can check.
  const citedPaths = extractInternalPaths(answer);
  const fabricatedPaths = knownPaths
    ? citedPaths.filter((p) => {
        const base = p.split("#")[0]!;
        return /^\/(work|research)\//.test(base) && !knownPaths.has(base);
      })
    : [];
  const grounded = fabricatedPaths.length === 0;
  if (!grounded) reasons.push(`cites unknown route(s): ${fabricatedPaths.join(", ")}`);

  const missingInclude = c.mustInclude.filter((p) => !text.includes(p.toLowerCase()));
  const hitExclude = c.mustExclude.filter((p) => text.includes(p.toLowerCase()));
  const missingPath = c.expectPaths.length > 0 && !c.expectPaths.some((p) => citedPaths.includes(p));
  const rubricPass = missingInclude.length === 0 && hitExclude.length === 0 && !missingPath;
  if (missingInclude.length) reasons.push(`missing required: ${missingInclude.join(", ")}`);
  if (hitExclude.length) reasons.push(`present but forbidden: ${hitExclude.join(", ")}`);
  if (missingPath) reasons.push(`did not cite an expected route: ${c.expectPaths.join(" | ")}`);

  const refusalPass = c.category !== "refusal" || REFUSAL_RE.test(answer);
  if (c.category === "refusal" && !refusalPass) reasons.push("did not refuse a question it cannot ground");

  const pass = grounded && rubricPass && refusalPass;
  return { id: c.id, category: c.category, grounded, rubricPass, refusalPass, citedPaths, fabricatedPaths, pass, reasons };
}

export type EvalSummary = {
  total: number;
  passed: number;
  passRate: number; // 0..1
  grounded: number; // count grounded
  byCategory: Record<EvalCategory, { total: number; passed: number }>;
};

/** Aggregate a set of verdicts into a headline pass rate + per-category split. */
export function summarize(verdicts: Verdict[]): EvalSummary {
  const byCategory: Record<EvalCategory, { total: number; passed: number }> = {
    grounded: { total: 0, passed: 0 },
    refusal: { total: 0, passed: 0 },
  };
  let passed = 0;
  let grounded = 0;
  for (const v of verdicts) {
    byCategory[v.category].total++;
    if (v.pass) {
      passed++;
      byCategory[v.category].passed++;
    }
    if (v.grounded) grounded++;
  }
  const total = verdicts.length;
  return { total, passed, passRate: total ? passed / total : 0, grounded, byCategory };
}

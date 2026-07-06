import { z } from "zod";

import { isInternalPath } from "@/lib/agent/chat-actions";

/**
 * Tailored pitch links — the pure core (ADR-0011, plan-0006). A recruiter's
 * brief becomes a persistent public page under /for/<slug>, so everything the
 * model produces is treated as untrusted: structured JSON only, sanitized
 * field by field, validated with zod, and re-validated on read. The brief
 * itself is never stored and never rendered — only the company label and the
 * validated report survive.
 */

export const COMPANY_MAX = 64;
export const PITCH_TTL_SECONDS = 90 * 24 * 60 * 60; // pages expire in 90 days
export const PITCH_KEY_PREFIX = "pitch:";
export const PITCH_INDEX_KEY = "pitch:index";
export const PITCH_DEFAULT_DAILY_CAP = 20;

/**
 * Model text is rendered on a public page of this domain: strip anything
 * link-shaped (URL spam) and any @@ protocol impersonation, then collapse
 * whitespace. Length limits are enforced AFTER sanitizing.
 */
export function sanitizeText(s: string): string {
  return s
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("@@"))
    .join(" ")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/www\.\S+/gi, "")
    .replace(/\]\(/g, "] (")
    .replace(/\s+/g, " ")
    .trim();
}

const text = (max: number) => z.string().transform(sanitizeText).pipe(z.string().min(1).max(max));

export const pitchReportSchema = z.object({
  headline: text(120),
  summary: text(600),
  strengths: z
    .array(
      z.object({
        claim: text(200),
        path: z.string().refine(isInternalPath, "not an internal site path"),
        strength: z.enum(["strong", "partial"]),
      }),
    )
    .min(3)
    .max(6),
  // the honesty contract: a pitch page without gaps does not get stored
  gaps: z.array(text(200)).min(1).max(5),
  verdict: text(500),
});

export type PitchReport = z.infer<typeof pitchReportSchema>;

export type StoredPitch = {
  v: 1;
  company: string;
  /** epoch ms */
  createdAt: number;
  report: PitchReport;
};

/** Company label: user input rendered on a public page — clamp hard. */
export function clampCompany(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    .replace(/[^a-zA-Z0-9 .&-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, COMPANY_MAX)
    .trim();
  return cleaned.length >= 2 ? cleaned : null;
}

/** `Stripe GmbH` + `a1b2c3` → `stripe-gmbh-a1b2c3`; the suffix defeats enumeration. */
export function pitchSlug(company: string, suffix: string): string {
  const base =
    company
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32)
      .replace(/-+$/g, "") || "role";
  return `${base}-${suffix}`;
}

export function isPitchSlug(slug: unknown): slug is string {
  return typeof slug === "string" && /^[a-z0-9-]{3,80}$/.test(slug);
}

/** Model output → validated report, or null. Never throws. */
export function parsePitchReport(raw: unknown): PitchReport | null {
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = pitchReportSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Stored JSON → StoredPitch, re-validated on read (defense in depth). */
export function parseStoredPitch(json: string | null | undefined): StoredPitch | null {
  if (!json) return null;
  try {
    const v = JSON.parse(json) as StoredPitch;
    if (!v || v.v !== 1 || typeof v.createdAt !== "number") return null;
    const company = clampCompany(v.company);
    const report = parsePitchReport(v.report);
    return company && report ? { v: 1, company, createdAt: v.createdAt, report } : null;
  } catch {
    return null;
  }
}

export function buildPitchSystemPrompt(corpus: string, company: string): string {
  return [
    `You are the pitch engine for Md. Abu Ammar's portfolio. A recruiter from ${company} pasted a job description; write the pitch page that argues his fit for THAT role.`,
    "Respond with ONLY a JSON object — no markdown fence, no prose around it — of exactly this shape:",
    "",
    `{
  "headline": "one line, <=110 chars, naming the role and his strongest angle",
  "summary": "2-3 sentences, <=550 chars, third person",
  "strengths": [
    { "claim": "<=190 chars, one concrete requirement-to-evidence match", "path": "/work/... or /research/... or /learn", "strength": "strong" | "partial" }
  ],
  "gaps": ["<=190 chars each: what the role asks for that the corpus does NOT demonstrate"],
  "verdict": "one plain-spoken paragraph, <=450 chars: recommend for what kind of role, honestly"
}`,
    "",
    "Rules:",
    "- 3 to 6 strengths; every one cites a real site path from the corpus.",
    "- gaps is REQUIRED and must contain 1 to 5 real gaps — do not soften; missing evidence is a gap.",
    "- Use ONLY facts from the corpus. Never invent projects, employers, numbers, papers, or skills.",
    "- No URLs, no markdown links, no email addresses — site paths only.",
    "- Write in the third person about Md. Abu Ammar; never as him.",
    "",
    "--- CORPUS ---",
    corpus,
  ].join("\n");
}

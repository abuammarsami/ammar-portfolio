import { describe, expect, it } from "vitest";
import { BRIEF_MAX, BRIEF_MIN, buildFitSystemPrompt, normalizeAudience, validateBrief } from "./fit-prompt";

describe("validateBrief", () => {
  it("accepts real briefs and rejects out-of-bounds input", () => {
    expect(validateBrief("Senior backend engineer, .NET and Azure, payments experience required.")).toBe(true);
    expect(validateBrief("x".repeat(BRIEF_MIN - 1))).toBe(false);
    expect(validateBrief("x".repeat(BRIEF_MAX + 1))).toBe(false);
    expect(validateBrief("   " + "x".repeat(10) + "   ")).toBe(false); // trimmed length counts
    expect(validateBrief(42)).toBe(false);
    expect(validateBrief(undefined)).toBe(false);
  });
});

describe("normalizeAudience", () => {
  it("defaults to recruiter and only accepts known audiences", () => {
    expect(normalizeAudience("professor")).toBe("professor");
    expect(normalizeAudience("recruiter")).toBe("recruiter");
    expect(normalizeAudience("hacker")).toBe("recruiter");
    expect(normalizeAudience(undefined)).toBe("recruiter");
  });
});

describe("buildFitSystemPrompt", () => {
  it("embeds the corpus and mandates the honest-gaps contract", () => {
    const p = buildFitSystemPrompt("THE-CORPUS-SENTINEL", "recruiter");
    expect(p).toContain("THE-CORPUS-SENTINEL");
    expect(p).toContain("## Honest gaps");
    expect(p).toContain("## Fit summary");
    expect(p).toContain("## Requirement by requirement");
    expect(p).toContain("## Verdict");
    expect(p).toContain("never invent");
  });

  it("adapts the framing per audience", () => {
    expect(buildFitSystemPrompt("c", "recruiter")).toContain("job description");
    expect(buildFitSystemPrompt("c", "professor")).toContain("research topic");
  });
});

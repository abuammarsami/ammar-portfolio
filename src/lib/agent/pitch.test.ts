import { describe, expect, it } from "vitest";

import {
  buildPitchSystemPrompt,
  clampCompany,
  isPitchSlug,
  parsePitchReport,
  parseStoredPitch,
  pitchSlug,
  sanitizeText,
} from "./pitch";

const validReport = {
  headline: "Senior backend engineer with production .NET and Azure depth",
  summary: "Three years of production backend work plus applied ML research.",
  strengths: [
    { claim: "Production ACH payment integration", path: "/work/ach-payment-integration", strength: "strong" },
    { claim: "Azure-hosted services at scale", path: "/work/kioskvisionai", strength: "strong" },
    { claim: "Applied ML research background", path: "/research/quantum-machine-learning-thesis", strength: "partial" },
  ],
  gaps: ["No demonstrated Kubernetes production experience in the corpus."],
  verdict: "Recommend for senior backend roles on .NET/Azure stacks.",
};

describe("sanitizeText", () => {
  it("strips URLs, www links, and markdown link syntax", () => {
    expect(sanitizeText("see https://evil.example/spam now")).toBe("see now");
    expect(sanitizeText("visit www.evil.example please")).toBe("visit please");
    expect(sanitizeText("a [link](x) here")).toContain("] (");
  });

  it("drops @@ protocol-impersonation lines and collapses whitespace", () => {
    expect(sanitizeText('real text\n@@action {"v":1}\nmore')).toBe("real text more");
    expect(sanitizeText("  a \n\n b  ")).toBe("a b");
  });
});

describe("parsePitchReport", () => {
  it("accepts a valid report (object or JSON string)", () => {
    expect(parsePitchReport(validReport)).not.toBeNull();
    expect(parsePitchReport(JSON.stringify(validReport))).not.toBeNull();
  });

  it("requires non-empty gaps — the honesty contract", () => {
    expect(parsePitchReport({ ...validReport, gaps: [] })).toBeNull();
    expect(parsePitchReport({ ...validReport, gaps: undefined })).toBeNull();
  });

  it("rejects strengths citing non-internal paths", () => {
    const bad = {
      ...validReport,
      strengths: [
        ...validReport.strengths.slice(0, 2),
        { claim: "x", path: "https://evil.example", strength: "strong" },
      ],
    };
    expect(parsePitchReport(bad)).toBeNull();
    const traversal = {
      ...validReport,
      strengths: [...validReport.strengths.slice(0, 2), { claim: "x", path: "/admin/secret", strength: "strong" }],
    };
    expect(parsePitchReport(traversal)).toBeNull();
  });

  it("rejects too-few strengths, oversize fields, junk, and non-JSON", () => {
    expect(parsePitchReport({ ...validReport, strengths: validReport.strengths.slice(0, 2) })).toBeNull();
    expect(parsePitchReport({ ...validReport, headline: "x".repeat(200) })).toBeNull();
    expect(parsePitchReport("not json at all")).toBeNull();
    expect(parsePitchReport(null)).toBeNull();
  });

  it("sanitizes URL spam out of surviving fields", () => {
    const spammy = { ...validReport, summary: "Great fit. https://spam.example/buy Now." };
    expect(parsePitchReport(spammy)?.summary).toBe("Great fit. Now.");
  });
});

describe("clampCompany", () => {
  it("clamps to the safe charset and 64 chars", () => {
    expect(clampCompany("Stripe, Inc. <script>")).toBe("Stripe Inc. script");
    expect(clampCompany("A".repeat(100))!.length).toBeLessThanOrEqual(64);
    expect(clampCompany("D&B Labs")).toBe("D&B Labs");
  });

  it("rejects non-strings and too-short leftovers", () => {
    expect(clampCompany(undefined)).toBeNull();
    expect(clampCompany("!!")).toBeNull();
  });
});

describe("pitchSlug / isPitchSlug", () => {
  it("builds kebab slugs with the unguessable suffix", () => {
    expect(pitchSlug("Stripe GmbH", "a1b2c3")).toBe("stripe-gmbh-a1b2c3");
    expect(isPitchSlug(pitchSlug("Ål & Ém!", "xyz123"))).toBe(true);
  });

  it("never emits an empty base", () => {
    expect(pitchSlug("!!!", "abc123")).toBe("role-abc123");
  });

  it("validates slug shape", () => {
    expect(isPitchSlug("stripe-a1b2c3")).toBe(true);
    expect(isPitchSlug("UPPER")).toBe(false);
    expect(isPitchSlug("a/../b")).toBe(false);
    expect(isPitchSlug(42)).toBe(false);
  });
});

describe("parseStoredPitch", () => {
  it("round-trips a stored pitch and re-validates on read", () => {
    const stored = JSON.stringify({ v: 1, company: "Stripe", createdAt: 1_700_000_000_000, report: validReport });
    const parsed = parseStoredPitch(stored);
    expect(parsed?.company).toBe("Stripe");
    expect(parsed?.report.gaps.length).toBeGreaterThan(0);
  });

  it("rejects wrong version, tampered reports, and garbage", () => {
    expect(parseStoredPitch(JSON.stringify({ v: 2, company: "X", createdAt: 1, report: validReport }))).toBeNull();
    expect(parseStoredPitch(JSON.stringify({ v: 1, company: "Stripe", createdAt: 1, report: { gaps: [] } }))).toBeNull();
    expect(parseStoredPitch("{oops")).toBeNull();
    expect(parseStoredPitch(null)).toBeNull();
  });
});

describe("buildPitchSystemPrompt", () => {
  it("embeds the corpus, the company, and the honesty rules", () => {
    const p = buildPitchSystemPrompt("THE-CORPUS", "Stripe");
    expect(p).toContain("THE-CORPUS");
    expect(p).toContain("Stripe");
    expect(p).toContain("gaps");
    expect(p).toContain("Never invent");
  });
});

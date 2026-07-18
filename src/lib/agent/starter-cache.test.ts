import { describe, expect, it } from "vitest";

import { matchStarter, normalizeStarterKey, parseStarters } from "./starter-cache";

const BODY = `# heading

Intro prose that is not a section.

## What has he shipped to production?

He runs Partners.com.bd end to end — /work/payments-platform.

## Why should I interview him?

Senior engineer, researcher's mind. Start at /hire.

## Empty section
`;

describe("normalizeStarterKey", () => {
  it("folds case, punctuation, and whitespace to one key", () => {
    expect(normalizeStarterKey("What has he shipped to production?")).toBe("what has he shipped to production");
    expect(normalizeStarterKey("  what   has he shipped to production  ")).toBe("what has he shipped to production");
  });
  it("flattens smart quotes so a copied chip still matches", () => {
    expect(normalizeStarterKey("What’s his “quantum” work?")).toBe(normalizeStarterKey("what's his 'quantum' work?"));
  });
});

describe("parseStarters", () => {
  it("splits on ## headings and drops empty-bodied sections", () => {
    const out = parseStarters(BODY);
    expect(out.map((s) => s.question)).toEqual([
      "What has he shipped to production?",
      "Why should I interview him?",
    ]);
    expect(out[0]!.answer).toContain("/work/payments-platform");
  });
});

describe("matchStarter", () => {
  const entries = parseStarters(BODY);
  it("matches an exact starter question regardless of case/punctuation", () => {
    expect(matchStarter("what has he shipped to production", entries)).toContain("Partners.com.bd");
    expect(matchStarter("WHAT HAS HE SHIPPED TO PRODUCTION?", entries)).toContain("Partners.com.bd");
  });
  it("returns null for a near-miss so it falls through to the live model", () => {
    expect(matchStarter("what has he shipped recently", entries)).toBeNull();
    expect(matchStarter("", entries)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { sanitizeForSpeech, splitSentences } from "./voice";

describe("sanitizeForSpeech", () => {
  it("drops @@action and → lines entirely", () => {
    const text = 'His thesis is on QML.\n@@action {"v":1,"type":"navigate","path":"/"}\n→ opening /research …\nSee the results.';
    expect(sanitizeForSpeech(text)).toBe("His thesis is on QML. See the results.");
  });

  it("strips markdown syntax but keeps the words", () => {
    expect(sanitizeForSpeech("**Strong** fit with `payments` — see [the case study](/work/ach).")).toBe(
      "Strong fit with payments — see the case study.",
    );
    expect(sanitizeForSpeech("## Verdict\n*Recommend* him")).toBe("Verdict Recommend him");
  });

  it("removes raw URLs and collapses whitespace", () => {
    expect(sanitizeForSpeech("Read   https://example.com/paper.pdf  now")).toBe("Read now");
  });
});

describe("splitSentences", () => {
  it("splits on sentence boundaries and keeps punctuation", () => {
    expect(splitSentences("One. Two! Three?")).toEqual(["One.", "Two!", "Three?"]);
  });

  it("keeps every chunk under the utterance cap (Chrome TTS cutoff)", () => {
    const long = "clause, ".repeat(80) + "end.";
    const chunks = splitSentences(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(220);
    expect(chunks.join(" ").replace(/\s+/g, " ")).toContain("end.");
  });

  it("returns nothing for empty input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });
});

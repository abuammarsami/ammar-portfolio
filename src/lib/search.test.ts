import { describe, expect, it } from "vitest";

import { fuzzyScore, searchEntries, type SearchEntry } from "./search";

const ENTRIES: SearchEntry[] = [
  { title: "KioskVisionAI", path: "/work/kioskvisionai", kind: "case study", hint: "azure · vision" },
  { title: "Machine Learning In The Realm Of Quantum", path: "/research/quantum-machine-learning-thesis", kind: "thesis", hint: "NSU · 2022" },
  { title: "Qubit", path: "/learn#qubit", kind: "lesson", hint: "interactive · lesson 1" },
  { title: "ACH Payment Integration", path: "/work/ach-payment-integration", kind: "case study", hint: "payments" },
];

describe("fuzzyScore", () => {
  it("requires the whole query as an in-order subsequence", () => {
    expect(fuzzyScore("kva", "kioskvisionai")).toBeGreaterThan(0);
    expect(fuzzyScore("kvz", "kioskvisionai")).toBe(0);
    expect(fuzzyScore("", "anything")).toBe(0);
  });

  it("ranks contiguous and word-start matches above scattered ones", () => {
    expect(fuzzyScore("quantum", "quantum thesis")).toBeGreaterThan(fuzzyScore("quantum", "q u a n t u m stretched across"));
    expect(fuzzyScore("pay", "ACH Payment Integration".toLowerCase())).toBeGreaterThan(fuzzyScore("pay", "capacity planning"));
  });
});

describe("searchEntries", () => {
  it("finds papers, lessons, and projects by fragments", () => {
    expect(searchEntries(ENTRIES, "quantum")[0]?.path).toBe("/research/quantum-machine-learning-thesis");
    expect(searchEntries(ENTRIES, "kiosk")[0]?.title).toBe("KioskVisionAI");
    expect(searchEntries(ENTRIES, "payment")[0]?.path).toBe("/work/ach-payment-integration");
  });

  it("returns nothing for junk and caps results", () => {
    expect(searchEntries(ENTRIES, "zzzzxq")).toEqual([]);
    expect(searchEntries(ENTRIES, "i", 2)).toHaveLength(2);
  });
});

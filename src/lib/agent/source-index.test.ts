import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findSourceEntry, listSource, readSource, SOURCE_INDEX } from "./source-index";

describe("source-index (chat-with-codebase allowlist)", () => {
  it("every allowlisted file actually exists on disk", () => {
    // guards the manifest against rot: if a file is renamed/deleted, get_source
    // must never dangle. This is the freshness contract for ADR-0018.
    for (const entry of SOURCE_INDEX) {
      const abs = path.join(process.cwd(), entry.path);
      expect(fs.existsSync(abs), `missing: ${entry.path}`).toBe(true);
    }
  });

  it("slugs are unique and kebab-case", () => {
    const slugs = SOURCE_INDEX.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9-]+$/);
  });

  it("no allowlisted file leaks an inlined secret", () => {
    // the standing rule: never expose hardcoded credentials. Every listed file
    // must reach config through process.env, never an inlined key.
    for (const entry of SOURCE_INDEX) {
      const raw = fs.readFileSync(path.join(process.cwd(), entry.path), "utf8");
      expect(/(?:api[_-]?key|secret|password|token)\s*[:=]\s*["'][A-Za-z0-9._\-]{16,}["']/i.test(raw), `secret-looking literal in ${entry.path}`).toBe(false);
    }
  });

  it("listSource returns metadata but never file contents", () => {
    const list = listSource();
    expect(list.length).toBe(SOURCE_INDEX.length);
    for (const item of list) {
      expect(item).not.toHaveProperty("content");
      expect(item.blurb.length).toBeGreaterThan(0);
      expect(item.why.length).toBeGreaterThan(0);
    }
  });

  it("readSource returns the real file for a known slug", () => {
    const file = readSource("statevector");
    expect(file).not.toBeNull();
    expect(file!.path).toBe("src/components/quantum/statevector.ts");
    expect(file!.content).toContain("classify"); // a known export of the sim
    expect(file!.truncated).toBe(false);
  });

  it("readSource returns null for an unknown slug — no throw, no fs access", () => {
    expect(readSource("../../../etc/passwd")).toBeNull();
    expect(readSource("does-not-exist")).toBeNull();
    expect(findSourceEntry("nope")).toBeNull();
  });
});

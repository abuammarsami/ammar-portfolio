import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { getResumeManifest } from "./resume-manifest";

/**
 * The drift gate (ADR-0016): public/resume.pdf and public/resume-manifest.json
 * are written together by CI. A hand-replaced PDF (or stale manifest) makes
 * these assertions fail, so the /verify page can never lie.
 */
describe("resume manifest (real repo)", () => {
  const pdfPath = path.join(process.cwd(), "public/resume.pdf");

  it("parses against the schema via getResumeManifest()", () => {
    const m = getResumeManifest();
    expect(m.pdf).toBe("/resume.pdf");
    expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("sha256 of public/resume.pdf matches the manifest", () => {
    const m = getResumeManifest();
    const hash = createHash("sha256").update(fs.readFileSync(pdfPath)).digest("hex");
    expect(hash).toBe(m.sha256);
  });

  it("file size of public/resume.pdf matches sizeBytes", () => {
    const m = getResumeManifest();
    expect(fs.statSync(pdfPath).size).toBe(m.sizeBytes);
  });
});

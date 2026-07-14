import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

/**
 * public/resume-manifest.json is written by the resume CI workflow
 * (ADR-0016) alongside public/resume.pdf — both are bot-owned, never
 * hand-edited. This loader is the single typed reader for that manifest;
 * /verify renders it and the drift test asserts it matches the PDF bytes.
 */

export const resumeManifestSchema = z.object({
  /** Short build hash printed in the PDF footer ("draft" until the first CI build). */
  version: z.string().min(1),
  /** Full commit SHA of the source that built the PDF ("unknown" until the first CI build). */
  commit: z.string().min(1),
  /** ISO-8601 build timestamp. */
  builtAt: z.string().datetime(),
  /** SHA-256 of public/resume.pdf — the drift gate. */
  sha256: z.string().regex(/^[0-9a-f]{64}$/, "sha256 must be 64 lowercase hex chars"),
  sizeBytes: z.number().int().positive(),
  /** Repository (or commit) URL the PDF was built from. */
  source: z.string().url(),
  /** Site-relative path of the PDF this manifest describes. */
  pdf: z.string().min(1),
});

export type ResumeManifest = z.infer<typeof resumeManifestSchema>;

const MANIFEST_PATH = path.join(process.cwd(), "public/resume-manifest.json");

/** Read + validate the manifest. Only runs inside force-static pages/tests — never per-request. */
export function getResumeManifest(): ResumeManifest {
  const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
  return resumeManifestSchema.parse(JSON.parse(raw));
}

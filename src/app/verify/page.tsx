import type { Metadata } from "next";
import { getVerifyPage } from "@/lib/content/loader";
import { getResumeManifest } from "@/lib/resume-manifest";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Verify this resume",
  description:
    "Provenance for resume.pdf: the CI build version, sha256 checksum, and how to verify the PDF (and its embedded machine-readable resume.json) yourself.",
};

const prose =
  "mt-4 max-w-2xl font-serif leading-relaxed [&>p+p]:mt-4 [&_strong]:text-q0 [&_a]:text-q1 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-q1/50 [&_a:hover]:decoration-q1 [&_code]:font-mono [&_code]:text-sm [&_code]:text-q1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li+li]:mt-3";

/**
 * /verify (ADR-0016): the provenance page for public/resume.pdf. The PDF and
 * its manifest are written only by the resume CI workflow; this page renders
 * the manifest so anyone holding a copy of the PDF can check it against the
 * canonical build — hash in the footer, sha256 of the bytes, embedded JSON.
 * Prose comes from content/verify.md; the computed facts stay here.
 */
export default async function VerifyPage() {
  const manifest = getResumeManifest();
  const sections = await getVerifyPage();
  const byHeading = new Map(sections.map((s) => [s.heading, s.bodyHtml]));

  const facts: [string, string][] = [
    ["build version", manifest.version],
    ["built at", manifest.builtAt],
    ["size", `${manifest.sizeBytes.toLocaleString("en-US")} bytes`],
    ["source commit", manifest.commit],
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <header className="mt-12">
        <p className="font-mono text-xs text-muted">verify · written by CI, never by hand</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Verify this resume</h1>
        <div className={prose} dangerouslySetInnerHTML={{ __html: byHeading.get("Intro") ?? "" }} />
      </header>

      <h2 className="mt-10 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">
        Current build
      </h2>
      {manifest.version === "draft" && (
        <p className="mt-4 max-w-2xl font-serif leading-relaxed text-muted">
          The automated resume pipeline hasn&apos;t produced its first stamped build yet — the numbers below describe
          the placeholder draft. The footer-hash and embedded-attachment checks apply from the first CI build onward.
        </p>
      )}
      <dl className="mt-4 max-w-2xl space-y-2 font-mono text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b rule-hair pb-2">
            <dt className="text-muted">{label}</dt>
            <dd className="text-q0">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">sha256</h2>
      <pre className="mt-4 overflow-x-auto rounded-sm bg-surface p-4 font-mono text-xs leading-relaxed text-q0">
        {manifest.sha256}
      </pre>

      <h2 className="mt-10 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">
        How to verify
      </h2>
      <div className={prose} dangerouslySetInnerHTML={{ __html: byHeading.get("How to verify") ?? "" }} />

      <p className="mt-10 border-t rule-hair pt-4 font-mono text-xs leading-relaxed text-muted">
        <a href={manifest.pdf} className="text-q0 hover:underline">
          resume.pdf
        </a>{" "}
        ·{" "}
        <a href="/resume.json" className="text-q0 hover:underline">
          /resume.json
        </a>{" "}
        ·{" "}
        <a href={manifest.source} className="text-q0 hover:underline">
          source
        </a>
      </p>
    </main>
  );
}

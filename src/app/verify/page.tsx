import type { Metadata } from "next";
import { getResumeManifest } from "@/lib/resume-manifest";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Verify this resume",
  description:
    "Provenance for resume.pdf: the CI build version, sha256 checksum, and how to verify the PDF (and its embedded machine-readable resume.json) yourself.",
};

/**
 * /verify (ADR-0016): the provenance page for public/resume.pdf. The PDF and
 * its manifest are written only by the resume CI workflow; this page renders
 * the manifest so anyone holding a copy of the PDF can check it against the
 * canonical build — hash in the footer, sha256 of the bytes, embedded JSON.
 */
export default function VerifyPage() {
  const manifest = getResumeManifest();
  const builtAt = new Date(manifest.builtAt).toISOString().replace(".000Z", "Z");

  const facts: [string, string][] = [
    ["build version", manifest.version],
    ["built at", builtAt],
    ["size", `${manifest.sizeBytes.toLocaleString("en-US")} bytes`],
    ["source commit", manifest.commit],
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <header className="mt-12">
        <p className="font-mono text-xs text-muted">verify · written by CI, never by hand</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Verify this resume</h1>
        <p className="mt-4 max-w-2xl font-serif leading-relaxed">
          The resume PDF on this site is compiled from LaTeX source in CI — the same pipeline that writes this
          manifest. If the copy you hold matches the numbers below, it is the canonical build, unmodified.
        </p>
      </header>

      <h2 className="mt-10 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">
        Current build
      </h2>
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
      <ol className="mt-4 max-w-2xl list-decimal space-y-3 pl-5 font-serif leading-relaxed">
        <li>
          The build hash printed in the PDF footer must equal the <strong className="text-q0">build version</strong>{" "}
          shown above.
        </li>
        <li>
          <code className="font-mono text-sm text-q1">shasum -a 256 resume.pdf</code> must equal the sha256 above.
        </li>
        <li>
          <code className="font-mono text-sm text-q1">pdfdetach -saveall resume.pdf</code> extracts the embedded
          machine-readable <code className="font-mono text-sm text-q1">resume.json</code>.
        </li>
      </ol>

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

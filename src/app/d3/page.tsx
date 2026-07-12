import type { Metadata } from "next";
import { getOptionalHtml } from "@/lib/content/loader";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Document-Driven Development (D³)",
  description:
    "An open-source Claude Code skill: prime an AI session with the right docs before you build, and capture new rules, decisions, and bugs into their canonical home after.",
};

export default async function D3Page() {
  const body = await getOptionalHtml("d3.md");

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      <header className="mt-14">
        <p className="font-mono text-xs tracking-widest text-q1 uppercase">Skill · open source</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Document-Driven Development (D³)</h1>
      </header>

      {body ? (
        <article className="deepdive-prose mt-10" dangerouslySetInnerHTML={{ __html: body }} />
      ) : (
        <p className="mt-6 font-mono text-sm text-muted">— coming soon —</p>
      )}
    </main>
  );
}

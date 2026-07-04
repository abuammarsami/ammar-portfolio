import type { Metadata } from "next";
import Link from "next/link";
import { LearnJourney } from "@/components/learn/learn-journey";
import { ExplainThis } from "@/components/ui/explain-this";
import { getLessons } from "@/lib/content/loader";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Learn quantum, from zero",
  description:
    "An interactive journey from the qubit to quantum machine learning — six lessons, every number computed live by a real quantum simulator.",
};

export default async function LearnPage() {
  const lessons = await getLessons();

  return (
    <main className="pb-16">
      {/* ── intro (server-rendered — the LCP element) ── */}
      <header className="mx-auto max-w-3xl px-6 pt-16 pb-4 text-center">
        <p className="font-mono text-sm text-muted">/learn · six lessons · ~10 minutes</p>
        <h1 className="mt-4 font-serif text-[clamp(2.2rem,4.5vw,3.5rem)] leading-tight">
          Quantum computing, from zero to my thesis
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted">
          Everything on this page is computed live by the same 2-qubit simulator that powers
          this site — no videos, no canned animations. Scroll, drag, and break things.
        </p>
      </header>

      <LearnJourney lessons={lessons.map(({ slug, title, order }) => ({ slug, title, order }))}>
        {lessons.map((l, i) => (
          <div key={l.slug}>
            <p className="font-mono text-xs text-muted">
              lesson {i + 1} / {lessons.length}
            </p>
            <h2 className="mt-2 font-serif text-3xl">{l.title}</h2>
            <div
              className="mt-4 font-serif text-lg leading-relaxed text-q0 [&_em]:not-italic"
              dangerouslySetInnerHTML={{ __html: l.hookHtml }}
            />
            <div
              className="mt-4 max-w-xl font-serif leading-relaxed [&>p+p]:mt-4"
              dangerouslySetInnerHTML={{ __html: l.explainHtml }}
            />
            <div className="mt-5 rounded-sm border-l-2 border-q0/50 bg-surface/60 py-3 pr-3 pl-4">
              <p className="font-mono text-xs text-q0">try it</p>
              <div
                className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted"
                dangerouslySetInnerHTML={{ __html: l.tryItHtml }}
              />
            </div>
            <div
              className="mt-5 max-w-xl font-serif leading-relaxed text-muted italic"
              dangerouslySetInnerHTML={{ __html: l.takeawayHtml }}
            />
            {l.deeperHtml && <ExplainThis html={l.deeperHtml} label="go deeper" />}
          </div>
        ))}
      </LearnJourney>

      {/* ── colophon ── */}
      <section className="mx-auto max-w-3xl border-t rule-hair px-6 pt-12 text-center">
        <p className="font-mono text-xs text-muted">colophon</p>
        <p className="mx-auto mt-3 max-w-lg font-serif leading-relaxed">
          Every number on this page came from a ~200-line statevector simulator, written in
          TypeScript and unit-tested against textbook identities — the same engine that trains
          the classifier on the homepage.
        </p>
        <p className="mt-4 flex justify-center gap-5 font-mono text-sm">
          <a
            href="https://github.com/abuammarsami/ammar-portfolio/blob/main/src/components/quantum/statevector.ts"
            target="_blank"
            rel="noopener noreferrer"
            className="text-q0 hover:underline"
          >
            [read the source]
          </a>
          <Link href="/work/quantum-machine-learning-thesis" className="text-q1 hover:underline">
            [the thesis]
          </Link>
        </p>
      </section>
    </main>
  );
}

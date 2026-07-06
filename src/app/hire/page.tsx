import type { Metadata } from "next";
import { getHirePage } from "@/lib/content/loader";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Hire",
  description: "Quantum ML tutoring, .NET/Azure backend consulting, and research office hours — booked directly.",
};

const prose =
  "font-serif leading-relaxed [&_a]:text-q1 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-q1/50 [&_a:hover]:decoration-q1";

/** /hire (plan-0006, money track): zero-JS services page from content/hire.md. */
export default async function HirePage() {
  const { introHtml, services } = await getHirePage();

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <header className="mt-12">
        <p className="font-mono text-xs text-muted">services · booked directly, delivered personally</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Work with me</h1>
        <div className={`mt-5 max-w-2xl ${prose}`} dangerouslySetInnerHTML={{ __html: introHtml }} />
      </header>

      <div className="mt-10 space-y-6">
        {services.map((s) => (
          <section key={s.title} className="rounded-sm border rule-hair bg-surface p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif text-2xl">{s.title}</h2>
              <p className="font-mono text-xs text-q1">{s.price}</p>
            </div>
            <div className={`mt-3 ${prose}`} dangerouslySetInnerHTML={{ __html: s.pitchHtml }} />
            <p className="mt-4 font-mono text-sm">
              <a href={s.cta.href} className="border border-q0/60 px-4 py-2 text-q0 hover:bg-q0/10">
                → {s.cta.label}
              </a>
            </p>
          </section>
        ))}
      </div>

      <p className="mt-10 border-t rule-hair pt-4 font-mono text-xs leading-relaxed text-muted">
        Hiring for a full-time role instead? Run the{" "}
        <a href="/agents" className="text-q0 hover:underline">
          honest fit report
        </a>{" "}
        or grab the{" "}
        <a href="/resume.pdf" className="text-q0 hover:underline">
          resume
        </a>
        .
      </p>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/ui/reveal";
import {
  getDeepDives,
  getDeepDiveSerieses,
  standaloneDeepDives,
  visibleDeepDives,
} from "@/lib/content/loader";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Deep Dives",
  description:
    "Long-form engineering writing — real systems I've built, explained from first principles to production.",
};

export default async function DeepDivesPage() {
  const serieses = await getDeepDiveSerieses();
  const standalones = standaloneDeepDives(visibleDeepDives(await getDeepDives()));

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      <header className="mt-14">
        <p className="font-mono text-xs text-muted">deep dives</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">Engineering, explained</h1>
        <p className="mt-4 max-w-xl font-serif leading-relaxed text-ink/85">
          Long-form writing on the systems I build and the way I build them — from first principles to a
          production cutover. The depth that doesn&rsquo;t fit in a README, written so it&rsquo;s useful whether
          you&rsquo;re new to the idea or reviewing my work. Everything I publish lands here.
        </p>
      </header>

      {serieses.length === 0 && standalones.length === 0 && (
        <p className="mt-12 font-mono text-sm text-muted">Nothing published yet.</p>
      )}

      {standalones.map((d) => (
        <Reveal key={d.slug}>
          <Link
            href={`/deep-dives/${d.slug}`}
            className="group mt-12 block rounded-sm border rule-hair bg-surface/40 p-6 transition-colors hover:border-q0"
          >
            <p className="font-mono text-xs tracking-widest text-q1 uppercase">
              {d.featured ? "Featured essay" : "Essay"}
            </p>
            <h2 className="mt-2 font-serif text-2xl leading-snug group-hover:text-q0">{d.title}</h2>
            <p className="mt-2 max-w-xl leading-relaxed text-muted">{d.summary}</p>
            <p className="mt-3 font-mono text-xs text-muted">
              {d.readingMinutes} min read{" "}
              <span aria-hidden className="ml-1 inline-block transition-transform group-hover:translate-x-1 group-hover:text-q0">
                →
              </span>
            </p>
          </Link>
        </Reveal>
      ))}

      {serieses.map((s) => (
        <section key={s.slug} className="mt-14">
          <Reveal>
            <div className="rounded-sm border-l-2 border-q0 bg-surface/60 py-5 pr-5 pl-6">
              <p className="font-mono text-xs tracking-widest text-q1 uppercase">
                Series · {s.chapters.length + s.upcoming.length}{" "}
                {s.chapters.length + s.upcoming.length === 1 ? "part" : "parts"}
                {s.upcoming.length > 0 && ` · ${s.chapters.length} live`}
              </p>
              <h2 className="mt-2 font-serif text-2xl leading-snug">{s.title}</h2>
              <p className="mt-2 max-w-xl leading-relaxed text-muted">{s.tagline}</p>
            </div>
          </Reveal>

          <Reveal stagger className="mt-2">
            <ol>
              {s.chapters.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/deep-dives/${c.slug}`}
                    className="group flex items-baseline gap-4 border-t rule-hair py-5"
                  >
                    <span className="font-mono text-sm tabular-nums text-muted group-hover:text-q0">
                      {String(c.order).padStart(2, "0")}
                    </span>
                    <span className="flex-1">
                      <span className="block font-serif text-lg leading-snug group-hover:text-q0">
                        {c.title}
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">{c.summary}</span>
                      <span className="mt-1.5 block font-mono text-xs text-muted">{c.readingMinutes} min read</span>
                    </span>
                    <span aria-hidden className="self-center font-mono text-muted transition-transform group-hover:translate-x-1 group-hover:text-q0">
                      →
                    </span>
                  </Link>
                </li>
              ))}
              {s.upcoming.map((title, i) => (
                <li key={`upcoming-${i}`}>
                  <div className="flex items-baseline gap-4 border-t rule-hair py-5 opacity-55">
                    <span className="font-mono text-sm tabular-nums text-muted">
                      {String(s.chapters.length + i + 1).padStart(2, "0")}
                    </span>
                    <span className="flex-1">
                      <span className="block font-serif text-lg leading-snug">{title}</span>
                      <span className="mt-1 block font-mono text-xs tracking-wide text-muted uppercase">
                        Planned
                      </span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </section>
      ))}
    </main>
  );
}

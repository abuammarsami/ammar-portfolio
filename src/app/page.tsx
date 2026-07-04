import Link from "next/link";
import { QuantumCircuitCanvas } from "@/components/hero/quantum-circuit-canvas";
import { ArxivRow } from "@/components/paper/arxiv-row";
import { ProjectCard } from "@/components/ui/project-card";
import { getAbout, getProjects, visibleProjects } from "@/lib/content/loader";

export const dynamic = "force-static";

export default async function HomePage() {
  const [about, allProjects] = await Promise.all([getAbout(), getProjects()]);
  const projects = visibleProjects(allProjects);
  const featuredWork = projects.filter((p) => p.category === "engineering" && p.featured).slice(0, 3);
  const workFill = projects.filter((p) => p.category === "engineering" && !p.featured);
  const selectedWork = [...featuredWork, ...workFill].slice(0, 3);
  const allResearch = projects.filter((p) => p.category === "research");
  const research = [
    ...allResearch.filter((p) => p.featured),
    ...allResearch.filter((p) => !p.featured),
  ].slice(0, 2);

  return (
    <main className="mx-auto max-w-4xl px-6">
      {/* ── Hero ── */}
      <section className="grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="font-mono text-sm text-muted">Md. Abu Ammar · Software Engineer</p>
          <h1 className="mt-3 font-serif text-4xl leading-tight md:text-5xl">{about.tagline}</h1>
          <p className="mt-4 max-w-md leading-relaxed text-muted">{about.subheading}</p>
          <div className="mt-8 flex flex-wrap gap-4 font-mono text-sm">
            <Link
              href="/work"
              className="rounded-sm border border-q0/60 px-4 py-2 text-q0 transition-colors hover:bg-q0/10"
            >
              Selected work →
            </Link>
            <Link
              href="/research"
              className="rounded-sm border border-q1/60 px-4 py-2 text-q1 transition-colors hover:bg-q1/10"
            >
              Research &amp; publications →
            </Link>
          </div>
        </div>
        <div className="hidden md:block" aria-hidden={false}>
          <QuantumCircuitCanvas />
        </div>
      </section>

      {/* ── Selected work ── */}
      <section className="border-t rule-hair py-14">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">Selected work</h2>
          <Link href="/work" className="font-mono text-sm text-q0 hover:underline">
            all work →
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {selectedWork.map((p) => (
            <ProjectCard key={p.slug} project={p} />
          ))}
        </div>
      </section>

      {/* ── Research highlights ── */}
      <section className="border-t rule-hair py-14">
        <div className="flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">Research</h2>
          <Link href="/research" className="font-mono text-sm text-q1 hover:underline">
            all research →
          </Link>
        </div>
        <div className="mt-2">
          {research.map((p) => (
            <ArxivRow
              key={p.slug}
              id={p.slug}
              title={p.title}
              date={p.date}
              categories={p.tags.slice(0, 3)}
              abstract={p.summary}
              links={[
                { label: "case study", href: `/work/${p.slug}` },
                ...(p.links.github ? [{ label: "github", href: p.links.github }] : []),
              ]}
            />
          ))}
        </div>
      </section>

      {/* ── About excerpt ── */}
      <section className="border-t rule-hair py-14">
        <h2 className="font-serif text-2xl">About</h2>
        <div
          className="prose-paper mt-4 max-w-2xl font-serif leading-relaxed [&>p+p]:mt-4"
          dangerouslySetInnerHTML={{ __html: about.narrativeHtml }}
        />
        <p className="mt-6">
          <Link href="/about" className="font-mono text-sm text-q0 hover:underline">
            more about me →
          </Link>
        </p>
      </section>
    </main>
  );
}

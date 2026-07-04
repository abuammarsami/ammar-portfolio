import Link from "next/link";
import { QuantumCircuitCanvas } from "@/components/hero/quantum-circuit-canvas";
import { ArxivRow } from "@/components/paper/arxiv-row";
import { FigKioskVision } from "@/components/paper/fig-kioskvision";
import { MagneticLink } from "@/components/ui/magnetic-link";
import { ProjectCard } from "@/components/ui/project-card";
import { Reveal } from "@/components/ui/reveal";
import { StatsStrip } from "@/components/ui/stats-strip";
import { ExplainThis } from "@/components/ui/explain-this";
import { getAbout, getExplainers, getProjects, visibleProjects } from "@/lib/content/loader";

export const dynamic = "force-static";

export default async function HomePage() {
  const [about, allProjects, explainers] = await Promise.all([
    getAbout(),
    getProjects(),
    getExplainers(),
  ]);
  const projects = visibleProjects(allProjects);
  const featured = projects.find((p) => p.slug === "kioskvisionai");
  const work = projects
    .filter((p) => p.category === "engineering" && p.slug !== "kioskvisionai")
    .slice(0, 3);
  const allResearch = projects.filter((p) => p.category === "research");
  const research = [
    ...allResearch.filter((p) => p.featured),
    ...allResearch.filter((p) => !p.featured),
  ].slice(0, 2);

  return (
    <main>
      {/* ── Hero: full-bleed stage ── */}
      <section className="hero-atmosphere">
        <div className="mx-auto grid min-h-[88vh] max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <p className="enter enter-1 font-mono text-sm text-muted">
              Md. Abu Ammar · Backend &amp; AI Systems Engineer
            </p>
            <h1 className="enter enter-2 mt-5 font-serif text-[clamp(2.5rem,5.2vw,4.25rem)] leading-[1.05] tracking-tight">
              {about.tagline}
            </h1>
            <p className="enter enter-3 mt-6 max-w-lg leading-relaxed text-muted">
              {about.subheading}
            </p>
            <div className="enter enter-4 mt-10 flex flex-wrap gap-4 font-mono text-sm">
              <MagneticLink
                href="/work"
                className="rounded-sm border border-q0/60 px-5 py-2.5 text-q0 hover:bg-q0/10"
              >
                Selected work →
              </MagneticLink>
              <MagneticLink
                href="/research"
                className="rounded-sm border border-q1/60 px-5 py-2.5 text-q1 hover:bg-q1/10"
              >
                Research &amp; publications →
              </MagneticLink>
              <MagneticLink
                href="/learn"
                className="rounded-sm border rule-hair px-5 py-2.5 text-muted hover:text-ink"
              >
                Learn quantum, from zero →
              </MagneticLink>
            </div>
          </div>
          <div className="enter enter-4 hidden md:block">
            <QuantumCircuitCanvas />
            {explainers.get("hero-classifier") && (
              <ExplainThis html={explainers.get("hero-classifier")!} />
            )}
          </div>
        </div>
      </section>

      {/* ── Stats: the dossier numbers ── */}
      <StatsStrip />

      {/* ── Featured: editorial case study ── */}
      {featured && (
        <section className="border-t rule-hair">
          <Reveal className="mx-auto max-w-4xl px-6 py-16">
            <p className="font-mono text-xs text-muted">featured system</p>
            <div className="mt-4 grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
              <div>
                <h2 className="font-serif text-3xl leading-snug">
                  <Link href={`/work/${featured.slug}`} className="hover:text-q0 transition-colors">
                    {featured.title}
                  </Link>
                </h2>
                <p className="mt-4 max-w-md leading-relaxed text-muted">{featured.summary}</p>
                <p className="mt-6">
                  <Link
                    href={`/work/${featured.slug}`}
                    className="font-mono text-sm text-q0 hover:underline"
                  >
                    read the case study →
                  </Link>
                </p>
              </div>
              <figure>
                <div className="rounded-sm border rule-hair bg-surface p-4">
                  <FigKioskVision />
                </div>
                <figcaption className="mt-2 text-center font-mono text-xs text-muted">
                  Fig. 1 — 120+ kiosks · Azure Vision AI · automated recovery
                </figcaption>
              </figure>
            </div>
          </Reveal>
        </section>
      )}

      {/* ── Selected work ── */}
      <section className="border-t rule-hair">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <Reveal className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl">Selected work</h2>
            <Link href="/work" className="font-mono text-sm text-q0 hover:underline">
              all work →
            </Link>
          </Reveal>
          <Reveal stagger className="mt-6 grid gap-4 md:grid-cols-3">
            {work.map((p) => (
              <ProjectCard key={p.slug} project={p} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* ── Research highlights ── */}
      <section className="border-t rule-hair">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <Reveal className="flex items-baseline justify-between">
            <h2 className="font-serif text-2xl">Research</h2>
            <Link href="/research" className="font-mono text-sm text-q1 hover:underline">
              all research →
            </Link>
          </Reveal>
          <Reveal stagger className="mt-2">
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
          </Reveal>
        </div>
      </section>

      {/* ── About excerpt ── */}
      <section className="border-t rule-hair">
        <Reveal className="mx-auto max-w-4xl px-6 py-14">
          <h2 className="font-serif text-2xl">About</h2>
          <div
            className="drop-cap mt-5 max-w-2xl font-serif text-lg leading-relaxed [&>p+p]:mt-4"
            dangerouslySetInnerHTML={{ __html: about.narrativeHtml }}
          />
          <p className="mt-6">
            <Link href="/about" className="font-mono text-sm text-q0 hover:underline">
              more about me →
            </Link>
          </p>
        </Reveal>
      </section>
    </main>
  );
}

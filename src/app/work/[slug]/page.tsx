import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BibtexBlock } from "@/components/paper/bibtex-block";
import { SectionHeading } from "@/components/paper/section-heading";
import { TagChip } from "@/components/ui/tag-chip";
import { getProject, getProjects, visibleProjects } from "@/lib/content/loader";
import type { Project } from "@/lib/content/schema";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const projects = visibleProjects(await getProjects());
  return projects.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) return {};
  return { title: project.title, description: project.summary };
}

function bibtex(p: Project): string {
  const year = p.date.slice(0, 4);
  const key = `ammar${year}${p.slug.split("-")[0]}`;
  const lines = [
    `@misc{${key},`,
    `  author = {Ammar, Md. Abu},`,
    `  title  = {${p.title}},`,
    `  year   = {${year}},`,
  ];
  if (p.links.github) lines.push(`  url    = {${p.links.github}},`);
  lines.push(`  note   = {${p.category === "research" ? "Research project" : "Engineering case study"}}`, `}`);
  return lines.join("\n");
}

export default async function CaseStudyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);
  if (!project) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      {/* ── abstract header ── */}
      <header className="mt-12">
        <p className="font-mono text-xs text-muted">
          <Link href="/work" className="hover:text-q0">
            work
          </Link>{" "}
          / {project.slug} · {project.date}
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">{project.title}</h1>
        <p className="mt-3 flex flex-wrap gap-1.5">
          {project.tags.map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </p>
        <div className="mt-6 rounded-sm border rule-hair bg-surface p-5">
          <p className="font-mono text-xs text-muted">Abstract</p>
          <p className="mt-2 font-serif leading-relaxed">{project.summary}</p>
        </div>
      </header>

      {/* ── §-numbered body ── */}
      <SectionHeading index={1} title="Problem" />
      <div
        className="mt-4 max-w-2xl font-serif leading-relaxed [&>p+p]:mt-4"
        dangerouslySetInnerHTML={{ __html: project.problemHtml }}
      />

      <SectionHeading index={2} title="Approach" />
      <div
        className="mt-4 max-w-2xl font-serif leading-relaxed [&>p+p]:mt-4"
        dangerouslySetInnerHTML={{ __html: project.approachHtml }}
      />

      <SectionHeading index={3} title="Impact" />
      <div
        className="mt-4 max-w-2xl font-serif leading-relaxed [&>p+p]:mt-4 [&_strong]:text-q0"
        dangerouslySetInnerHTML={{ __html: project.impactHtml }}
      />

      {/* ── keywords / stack ── */}
      <p className="mt-10 border-t rule-hair pt-4 font-mono text-xs leading-relaxed text-muted">
        <span className="text-q1">Keywords:</span> {project.techStack}
      </p>

      {/* ── links ── */}
      <p className="mt-3 flex gap-4 font-mono text-sm">
        {project.links.github && (
          <a
            href={project.links.github}
            target="_blank"
            rel="noopener noreferrer"
            className="text-q0 hover:underline"
          >
            [github]
          </a>
        )}
        {project.links.live && (
          <a
            href={project.links.live}
            target="_blank"
            rel="noopener noreferrer"
            className="text-q1 hover:underline"
          >
            [live]
          </a>
        )}
        {!project.links.github && !project.links.live && project.linksNote && (
          <span className="text-muted">{project.linksNote}</span>
        )}
      </p>

      {/* ── cite block ── */}
      <BibtexBlock entry={bibtex(project)} />
    </main>
  );
}

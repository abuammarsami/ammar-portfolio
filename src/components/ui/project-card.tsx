import Link from "next/link";
import { Vt } from "@/components/ui/vt";
import type { Project } from "@/lib/content/schema";

/** Paper-abstract card with the entangled-pair hover (ADR-0003). */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link href={`/work/${project.slug}`} className="block">
      <article className="entangled h-full rounded-sm border rule-hair bg-surface p-5 transition-colors">
        <p className="entangled-a font-mono text-xs text-muted">
          {project.slug} · {project.date}
        </p>
        <Vt name={`project-${project.slug}`}>
          <h3 className="mt-1.5 font-serif text-xl leading-snug">{project.title}</h3>
        </Vt>
        <p className="mt-2 text-sm leading-relaxed text-muted">{project.summary}</p>
        <p className="mt-3 flex flex-wrap gap-1.5">
          {project.tags.slice(0, 4).map((t) => (
            <span
              key={t}
              className="entangled-b rounded-sm border rule-hair px-1.5 py-0.5 font-mono text-xs text-muted transition-colors"
            >
              [{t}]
            </span>
          ))}
        </p>
      </article>
    </Link>
  );
}

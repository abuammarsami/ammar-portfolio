import type { Metadata } from "next";
import { ProjectCard } from "@/components/ui/project-card";
import { getProjects, visibleProjects } from "@/lib/content/loader";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Work",
  description: "Engineering case studies — distributed systems, payments, Azure, and applied ML.",
};

export default async function WorkPage() {
  const projects = visibleProjects(await getProjects());

  return (
    <main className="mx-auto max-w-4xl px-6 pb-16">
      <h1 className="mt-12 font-serif text-4xl">Work</h1>
      <p className="mt-2 max-w-xl text-muted">
        Case studies, written the way I think about them: problem, approach, impact.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {projects.map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </div>
    </main>
  );
}

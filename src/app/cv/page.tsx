import type { Metadata } from "next";
import { PrintButton } from "@/components/ui/print-button";
import { getAbout, getExperience, getPapers, getProjects, getSkills, visiblePapers, visibleProjects } from "@/lib/content/loader";
import { LINKS, SITE_URL } from "@/lib/site";

const HOST = new URL(SITE_URL).host;
import type { ExperienceRole, Paper, Project, SkillGroup } from "@/lib/content/schema";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "CV",
  description: "Typeset curriculum vitae — generated from the same content as the rest of the site, print-ready.",
};

/**
 * /cv (plan-0006): a print-perfect CV from the SAME markdown the site renders,
 * so it can never drift from the site the way a static PDF does. Lens-aware:
 * the professor lens reorders to an academic CV (publications first) via
 * duplicated sections + display:none — never CSS `order` (a11y).
 */

const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

function ExperienceBlock({ roles }: { roles: ExperienceRole[] }) {
  return (
    <section className="cv-block">
      <h2 className="mt-8 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">Experience</h2>
      {roles.map((r) => (
        <div key={r.heading} className="cv-entry mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className="font-serif text-lg">{r.heading}</h3>
            <p className="font-mono text-xs text-muted">{r.meta}</p>
          </div>
          <div
            className="mt-1 font-serif text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-q0"
            dangerouslySetInnerHTML={{ __html: r.bodyHtml }}
          />
        </div>
      ))}
    </section>
  );
}

function PublicationsBlock({ papers }: { papers: Paper[] }) {
  return (
    <section className="cv-block">
      <h2 className="mt-8 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">Publications & theses</h2>
      {papers.map((p) => (
        <div key={p.slug} className="cv-entry mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className="font-serif text-lg">{p.title}</h3>
            <p className="font-mono text-xs text-muted">{p.year}</p>
          </div>
          <p className="mt-1 font-serif text-sm text-muted">
            {p.authors.join(", ")} · {p.venue}
            {p.supervisor ? ` · supervised by ${p.supervisor}` : ""}
          </p>
          <p className="mt-1 font-mono text-xs text-q1">
            {HOST}/research/{p.slug}
          </p>
        </div>
      ))}
    </section>
  );
}

function ProjectsBlock({ projects }: { projects: Project[] }) {
  return (
    <section className="cv-block">
      <h2 className="mt-8 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">Selected projects</h2>
      {projects.map((p) => (
        <div key={p.slug} className="cv-entry mt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <h3 className="font-serif text-lg">{p.title}</h3>
            <p className="font-mono text-xs text-muted">{p.date}</p>
          </div>
          <p className="mt-1 font-serif text-sm leading-relaxed">{p.summary}</p>
          <p className="mt-1 font-mono text-xs text-muted">{p.techStack}</p>
        </div>
      ))}
    </section>
  );
}

function SkillsBlock({ skills }: { skills: SkillGroup[] }) {
  return (
    <section className="cv-block">
      <h2 className="mt-8 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">Skills</h2>
      <div className="mt-3 space-y-1.5">
        {skills.map((g) => (
          <p key={g.group} className="font-serif text-sm leading-relaxed">
            <strong className="text-q0">{g.group}:</strong> {strip(g.bodyHtml)}
          </p>
        ))}
      </div>
    </section>
  );
}

function EducationBlock({ html }: { html: string | null }) {
  if (!html) return null;
  return (
    <section className="cv-block">
      <h2 className="mt-8 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">Education</h2>
      <div
        className="mt-3 font-serif text-sm leading-relaxed [&_li]:ml-4 [&_li]:list-disc [&_strong]:text-ink"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </section>
  );
}

export default async function CvPage() {
  const [about, roles, papers, projects, skills] = await Promise.all([
    getAbout(),
    getExperience(),
    getPapers().then(visiblePapers),
    getProjects().then(visibleProjects),
    getSkills(),
  ]);
  const featured = projects.filter((p) => p.featured);

  return (
    <main className="cv-page mx-auto max-w-3xl px-6 pb-16">
      <header className="mt-12 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-tight">Md. Abu Ammar</h1>
          <p className="mt-2 font-serif text-muted">{about.tagline}</p>
          <p className="mt-2 font-mono text-xs text-muted">
            {LINKS.email} · github.com/abuammarsami · linkedin.com/in/abu-ammar · {HOST}
          </p>
        </div>
        <PrintButton />
      </header>

      {/* recruiter/engineer ordering: experience first */}
      <div className="lens-not-professor">
        <ExperienceBlock roles={roles} />
        <ProjectsBlock projects={featured} />
        <PublicationsBlock papers={papers} />
        <SkillsBlock skills={skills} />
        <EducationBlock html={about.educationHtml} />
      </div>

      {/* professor ordering: an academic CV — education & publications first */}
      <div className="lens-professor">
        <EducationBlock html={about.educationHtml} />
        <PublicationsBlock papers={papers} />
        <ExperienceBlock roles={roles} />
        <ProjectsBlock projects={featured} />
        <SkillsBlock skills={skills} />
      </div>

      <p className="no-print mt-10 border-t rule-hair pt-4 font-mono text-xs leading-relaxed text-muted">
        Generated from the same content as the rest of this site — it can&apos;t drift. Switch the ⟨lens| in the nav
        for the academic ordering, or download the{" "}
        <a href="/resume.pdf" className="text-q0 hover:underline">
          one-page resume.pdf
        </a>{" "}
        (
        <a href="/verify" className="text-q0 hover:underline">
          verify
        </a>
        ).
      </p>
    </main>
  );
}

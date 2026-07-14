import { getExperience, getPapers, getProjects, getSkills, visiblePapers, visibleProjects } from "@/lib/content/loader";
import { LINKS, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/** JSON Resume schema (https://jsonresume.org) — for recruiters' parsing tools. */
export async function GET() {
  const [experience, projects, skills, papers] = await Promise.all([
    getExperience(),
    getProjects().then(visibleProjects),
    getSkills(),
    getPapers().then(visiblePapers),
  ]);
  const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const resume = {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: "Md. Abu Ammar",
      label: "Backend & AI Systems Engineer",
      email: LINKS.email,
      url: SITE_URL,
      summary:
        "Backend & AI systems engineer: payment infrastructure (millions of dollars/yr, 20k+ users), AI-powered kiosk monitoring (200+ devices), .NET Aspire distributed platforms on Azure. Quantum ML researcher (MS CS, North South University).",
      location: { city: "Dhaka", countryCode: "BD" },
      profiles: [
        { network: "GitHub", username: "abuammarsami", url: LINKS.github },
        { network: "LinkedIn", username: "abu-ammar", url: LINKS.linkedin },
      ],
    },
    work: experience.map((r) => {
      const [name, position] = r.heading.split(" — ");
      return { name, position, summary: strip(r.bodyHtml), date: r.meta };
    }),
    projects: projects.map((p) => ({
      name: p.title,
      description: p.summary,
      keywords: p.tags,
      url: p.links.github ?? `${SITE_URL}/work/${p.slug}`,
      type: p.category,
    })),
    skills: skills.map((g) => ({ name: g.group, keywords: strip(g.bodyHtml).split(", ") })),
    publications: papers.map((p) => ({
      name: p.title,
      publisher: p.venue,
      releaseDate: String(p.year),
      url: `${SITE_URL}/research/${p.slug}`,
      summary: strip(p.abstractHtml),
    })),
    education: [
      {
        institution: "North South University",
        area: "Computer Science",
        studyType: "MS (expected Nov 2026)",
      },
      {
        institution: "North South University",
        area: "Computer Science (minor: Mathematics)",
        studyType: "BS",
        score: "3.58/4.00",
      },
    ],
  };
  return Response.json(resume);
}

import { getAbout, getExperience, getLessons, getProjects, getSkills, getStats, visibleProjects } from "@/lib/content/loader";
import { LINKS, SITE_URL } from "@/lib/site";

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * The single source of agent-readable truth (ADR-0007). Assembled at build
 * time from content/ — the same markdown humans read. Consumed by /llms-full.txt,
 * /api/chat (system context), and /api/mcp tools.
 */
export async function buildCorpus(): Promise<string> {
  const [about, projects, experience, skills, lessons, stats] = await Promise.all([
    getAbout(),
    getProjects().then(visibleProjects),
    getExperience(),
    getSkills(),
    getLessons(),
    Promise.resolve(getStats()),
  ]);

  const lines: string[] = [
    "# Md. Abu Ammar — Backend & AI Systems Engineer",
    "",
    `Site: ${SITE_URL} · GitHub: ${LINKS.github} · LinkedIn: ${LINKS.linkedin} · Email: ${LINKS.email}`,
    "",
    "## Summary",
    about.tagline,
    strip(about.narrativeHtml),
    "",
    "## Key numbers",
    ...stats.map((s) => `- ${s.value} ${s.label}`),
    "",
    "## Experience",
    ...experience.flatMap((r) => [`### ${r.heading} (${r.meta})`, strip(r.bodyHtml), ""]),
    "## Projects & research",
    ...projects.flatMap((p) => [
      `### ${p.title} [${p.category}] (${p.date}) — ${SITE_URL}/work/${p.slug}`,
      `Summary: ${p.summary}`,
      `Problem: ${strip(p.problemHtml)}`,
      `Approach: ${strip(p.approachHtml)}`,
      `Impact: ${strip(p.impactHtml)}`,
      `Stack: ${p.techStack}`,
      p.links.github ? `GitHub: ${p.links.github}` : "",
      "",
    ]),
    "## Skills",
    ...skills.map((g) => `- ${g.group}: ${strip(g.bodyHtml)}`),
    "",
    "## Interactive quantum curriculum (/learn)",
    ...lessons.map((l) => `- Lesson ${l.order}: ${l.title} — ${strip(l.hookHtml)}`),
    "",
    "## Education",
    "- MS in Computer Science, North South University (expected Nov 2026)",
    "- BS in Computer Science (minor: Mathematics), North South University, CGPA 3.58/4.00",
  ];
  return lines.filter((l) => l !== undefined).join("\n");
}

import { getAbout, getExperience, getLessons, getPapers, getProjects, getSkills, getStats, visiblePapers, visibleProjects } from "@/lib/content/loader";
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
  const [about, projects, experience, skills, lessons, stats, papers] = await Promise.all([
    getAbout(),
    getProjects().then(visibleProjects),
    getExperience(),
    getSkills(),
    getLessons(),
    Promise.resolve(getStats()),
    getPapers().then(visiblePapers),
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
    "## Publications & theses (full text distilled at /research)",
    ...papers.flatMap((p) => [
      `### ${p.title} [${p.kind}] (${p.venue}, ${p.year}) — ${SITE_URL}/research/${p.slug}`,
      `Authors: ${p.authors.join(", ")}${p.supervisor ? ` · supervised by ${p.supervisor}` : ""}`,
      `Abstract: ${strip(p.abstractHtml)}`,
      `Results: ${strip(p.resultsHtml)}`,
      p.pdf ? `PDF: ${SITE_URL}/papers/${p.slug}.pdf` : "PDF: available on request",
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

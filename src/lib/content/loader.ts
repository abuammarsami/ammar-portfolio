import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { markdownToHtml } from "./markdown";
import {
  ABOUT_SECTIONS,
  LESSON_SECTIONS,
  PROJECT_SECTIONS,
  lessonFrontmatterSchema,
  projectFrontmatterSchema,
  simpleFrontmatterSchema,
  type About,
  type ExperienceRole,
  type Lesson,
  type Project,
  type SkillGroup,
} from "./schema";

const CONTENT_DIR = path.join(process.cwd(), "content");
const STRICT = process.env.NODE_ENV === "production";

/**
 * Strict in production builds: a missing required section fails the build loudly,
 * naming the file and section (ADR-0002). Lenient in dev: warns and returns fallback.
 */
function missing(file: string, what: string): string {
  const msg = `[content] ${file}: missing required ${what}`;
  if (STRICT) throw new Error(msg);
  console.warn(`${msg} — rendering placeholder (dev only)`);
  return "";
}

function read(rel: string): { data: unknown; body: string } | null {
  const abs = path.join(CONTENT_DIR, rel);
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, "utf8");
  const { data, content } = matter(raw);
  return { data, body: content };
}

/** Split a markdown body on `**Label:**` bold-label paragraphs (project template). */
export function splitLabelSections(body: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /^\*\*([^*]+):\*\*/gm;
  const matches = [...body.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const label = m[1]!.trim();
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : body.length;
    map.set(label, body.slice(start, end).trim());
  }
  return map;
}

/** Split a markdown body on `## Heading` sections (about/experience/skills templates). */
export function splitHeadingSections(body: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /^## +(.+)$/gm;
  const matches = [...body.matchAll(re)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const heading = m[1]!.trim();
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : body.length;
    map.set(heading, body.slice(start, end).trim());
  }
  return map;
}

/** Strip HTML comments (template guidance) before parsing. */
function stripComments(md: string): string {
  return md.replace(/<!--[\s\S]*?-->/g, "").trim();
}

// ---------------------------------------------------------------- projects

export async function getProjects(): Promise<Project[]> {
  const dir = path.join(CONTENT_DIR, "projects");
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort();

  const projects: Project[] = [];
  for (const file of files) {
    const rel = path.join("projects", file);
    const parsed = read(rel);
    if (!parsed) continue;

    const fmResult = projectFrontmatterSchema.safeParse(parsed.data);
    if (!fmResult.success) {
      missing(rel, `valid frontmatter (${fmResult.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")})`);
      continue;
    }
    const fm = fmResult.data;

    const sections = splitLabelSections(stripComments(parsed.body));
    for (const s of PROJECT_SECTIONS) {
      if (!sections.get(s)) missing(rel, `**${s}:** section`);
    }

    projects.push({
      ...fm,
      slug: file.replace(/\.md$/, ""),
      summary: sections.get("Summary") ?? "",
      problemHtml: await markdownToHtml(sections.get("Problem") ?? ""),
      approachHtml: await markdownToHtml(sections.get("Approach") ?? ""),
      impactHtml: await markdownToHtml(sections.get("Impact") ?? ""),
      techStack: sections.get("Tech stack") ?? "",
      linksNote: sections.get("Links") || null,
      media: sections.get("Media") || null,
    });
  }

  // newest first; featured handled by callers
  return projects.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export async function getProject(slug: string): Promise<Project | null> {
  const all = await getProjects();
  return all.find((p) => p.slug === slug) ?? null;
}

/** Draft projects are hidden from production listings but still routable in dev. */
export function visibleProjects(projects: Project[]): Project[] {
  return STRICT ? projects.filter((p) => p.status === "active") : projects;
}

// ---------------------------------------------------------------- about

export async function getAbout(): Promise<About> {
  const parsed = read("about.md");
  if (!parsed) {
    missing("about.md", "file");
    return { status: "draft", tagline: "", subheading: "", narrativeHtml: "" };
  }
  const fm = simpleFrontmatterSchema.parse(parsed.data ?? {});
  const sections = splitHeadingSections(stripComments(parsed.body));
  for (const s of ABOUT_SECTIONS) {
    if (!sections.get(s)) missing("about.md", `"## ${s}" section`);
  }
  return {
    status: fm.status,
    tagline: sections.get("Hero tagline") ?? "",
    subheading: sections.get("Hero subheading") ?? "",
    narrativeHtml: await markdownToHtml(sections.get("About me narrative") ?? ""),
  };
}

// ---------------------------------------------------------------- experience

export async function getExperience(): Promise<ExperienceRole[]> {
  const parsed = read("experience.md");
  if (!parsed) {
    missing("experience.md", "file");
    return [];
  }
  const sections = splitHeadingSections(stripComments(parsed.body));
  if (sections.size === 0) missing("experience.md", "at least one '## Company — Title' role");

  const roles: ExperienceRole[] = [];
  for (const [heading, block] of sections) {
    // first *emphasized* line is the dates/location meta
    const metaMatch = block.match(/^\*([^*]+)\*/);
    const meta = metaMatch?.[1]?.trim() ?? "";
    const body = metaMatch ? block.slice(metaMatch[0].length).trim() : block;
    roles.push({ heading, meta, bodyHtml: await markdownToHtml(body) });
  }
  return roles;
}

// ---------------------------------------------------------------- skills

export async function getSkills(): Promise<SkillGroup[]> {
  const parsed = read("skills.md");
  if (!parsed) {
    missing("skills.md", "file");
    return [];
  }
  const sections = splitHeadingSections(stripComments(parsed.body));
  if (sections.size === 0) missing("skills.md", "at least one '## Group' heading");

  const groups: SkillGroup[] = [];
  for (const [group, block] of sections) {
    if (!block) continue; // empty group headings simply drop out
    groups.push({ group, bodyHtml: await markdownToHtml(block) });
  }
  return groups;
}

// ---------------------------------------------------------------- lessons

/** content/learn/*.md → the /learn curriculum, sorted by frontmatter order. */
export async function getLessons(): Promise<Lesson[]> {
  const dir = path.join(CONTENT_DIR, "learn");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));

  const lessons: Lesson[] = [];
  for (const file of files) {
    const rel = path.join("learn", file);
    const parsed = read(rel);
    if (!parsed) continue;
    const fmResult = lessonFrontmatterSchema.safeParse(parsed.data);
    if (!fmResult.success) {
      missing(rel, `valid frontmatter (${fmResult.error.issues.map((i) => i.message).join("; ")})`);
      continue;
    }
    const sections = splitHeadingSections(stripComments(parsed.body));
    for (const s of LESSON_SECTIONS) {
      if (!sections.get(s)) missing(rel, `"## ${s}" section`);
    }
    const deeper = sections.get("Deeper");
    lessons.push({
      ...fmResult.data,
      slug: file.replace(/\.md$/, ""),
      hookHtml: await markdownToHtml(sections.get("Hook") ?? ""),
      explainHtml: await markdownToHtml(sections.get("Explain") ?? ""),
      tryItHtml: await markdownToHtml(sections.get("Try it") ?? ""),
      takeawayHtml: await markdownToHtml(sections.get("Takeaway") ?? ""),
      deeperHtml: deeper ? await markdownToHtml(deeper) : null,
    });
  }
  return lessons
    .filter((l) => (STRICT ? l.status === "active" : true))
    .sort((a, b) => a.order - b.order);
}

// ---------------------------------------------------------------- explainers

/** content/explainers.md `## key` sections → html by key. */
export async function getExplainers(): Promise<Map<string, string>> {
  const parsed = read("explainers.md");
  const map = new Map<string, string>();
  if (!parsed) return map;
  const sections = splitHeadingSections(stripComments(parsed.body));
  for (const [key, body] of sections) {
    if (body) map.set(key, await markdownToHtml(body));
  }
  return map;
}

// ---------------------------------------------------------------- stats

export type Stat = { value: string; label: string };

/** stats.md: one `- value | label` per line. Optional file. */
export function getStats(): Stat[] {
  const parsed = read("stats.md");
  if (!parsed) return [];
  const stats: Stat[] = [];
  for (const line of parsed.body.split("\n")) {
    const m = line.match(/^- +(.+?) +\| +(.+)$/);
    if (m) stats.push({ value: m[1]!, label: m[2]! });
  }
  return stats;
}

// ---------------------------------------------------------------- optional files

/** writing.md / testimonials.md — optional; empty (or template-only) → null. */
export async function getOptionalHtml(file: "writing.md" | "testimonials.md"): Promise<string | null> {
  const parsed = read(file);
  if (!parsed) return null;
  const body = stripComments(parsed.body)
    .replace(/^# .+$/m, "") // drop the H1 title
    .trim();
  // Treat template placeholders (angle-bracket stubs) as empty.
  if (!body || /^[->\s]*<.+>/.test(body)) return null;
  return markdownToHtml(body);
}

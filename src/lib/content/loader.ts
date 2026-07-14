import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { markdownToHtml } from "./markdown";
import {
  ABOUT_SECTIONS,
  AGENTS_SECTIONS,
  LESSON_SECTIONS,
  PAPER_SECTIONS,
  PROJECT_SECTIONS,
  lessonFrontmatterSchema,
  paperFrontmatterSchema,
  projectFrontmatterSchema,
  simpleFrontmatterSchema,
  COLOPHON_SECTIONS,
  VERIFY_SECTIONS,
  type About,
  type AgentsSection,
  type ColophonSection,
  type VerifySection,
  type ExperienceRole,
  type HirePage,
  type Lesson,
  type CaseStudy,
  type CaseStudyCapability,
  type CaseStudyCard,
  type CaseStudyStat,
  type DeepDive,
  type DeepDiveSeries,
  deepDiveFrontmatterSchema,
  deepDiveSeriesFrontmatterSchema,
  type Paper,
  type Project,
  type ProjectFigure,
  type Service,
  type SkillGroup,
  type Testimonial,
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
  try {
    const { data, content } = matter(raw);
    return { data, body: content };
  } catch (e) {
    // gray-matter's YAMLException has no file path — attribute it (ADR-0002)
    throw new Error(`[content] ${rel}: invalid frontmatter YAML — ${e instanceof Error ? e.message : String(e)}`);
  }
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

/**
 * Parse a project's **Media:** section into typed figures (ADR-0012):
 * one markdown image per line, `![caption](/figures/name.svg)`. Figures are
 * self-hosted SVGs inlined at build time, so anything outside /figures/*.svg
 * (or a file that doesn't exist in public/) fails the production build.
 */
export function parseProjectFigures(section: string | undefined, file: string): ProjectFigure[] {
  if (!section) return [];
  const figures: ProjectFigure[] = [];
  for (const line of section.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^!\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (!m) {
      missing(file, `a markdown-image Media line (got "${trimmed.slice(0, 60)}")`);
      continue;
    }
    const caption = m[1]!;
    const src = m[2]!;
    if (!/^\/figures\/[a-z0-9-]+\.svg$/.test(src)) {
      missing(file, `a /figures/*.svg Media src (got "${src}")`);
      continue;
    }
    if (!fs.existsSync(path.join(process.cwd(), "public", src))) {
      missing(file, `an existing figure file (public${src} not found)`);
      continue;
    }
    figures.push({ src, caption: caption.trim() });
  }
  return figures;
}

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
      figures: parseProjectFigures(sections.get("Media"), rel),
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

// ---------------------------------------------------------------- case studies (ADR-0013)

/** Split a `## Section` block into `### Card` records, each with an optional emphasized *meta* first line. */
async function splitCards(block: string): Promise<CaseStudyCard[]> {
  const re = /^### +(.+)$/gm;
  const matches = [...block.matchAll(re)];
  const cards: CaseStudyCard[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i]!;
    const start = m.index! + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : block.length;
    let body = block.slice(start, end).trim();
    const metaMatch = body.match(/^\*([^*]+)\*/);
    const meta = metaMatch ? metaMatch[1]!.trim() : null;
    if (metaMatch) body = body.slice(metaMatch[0].length).trim();
    cards.push({ title: m[1]!.trim(), meta, bodyHtml: await markdownToHtml(body) });
  }
  return cards;
}

/** Parse `- value | label` numeral lines (hero stats, outcomes). */
/** Parse `- <left> | <right>` list rows into [left, right] pairs. */
function parsePipeRows(block: string | undefined): [string, string][] {
  if (!block) return [];
  const out: [string, string][] = [];
  for (const line of block.split("\n")) {
    const m = line.match(/^- +(.+?) +\| +(.+)$/);
    if (m) out.push([m[1]!.trim(), m[2]!.trim()]);
  }
  return out;
}

function parseStatLines(block: string | undefined): CaseStudyStat[] {
  return parsePipeRows(block).map(([value, label]) => ({ value, label }));
}

/** Parse `- name | body` capability rows for the "wrapper" grid. */
function parseCapabilities(block: string | undefined): CaseStudyCapability[] {
  return parsePipeRows(block).map(([name, body]) => ({ name, body }));
}

/** content/case-studies/<slug>.md → the bespoke narrative layout (ADR-0013). Null when absent. */
export async function getCaseStudy(slug: string): Promise<CaseStudy | null> {
  const parsed = read(path.join("case-studies", `${slug}.md`));
  if (!parsed) return null;
  const fm = (parsed.data ?? {}) as { headings?: Record<string, string> };
  const s = splitHeadingSections(stripComments(parsed.body));
  return {
    slug,
    headings: fm.headings ?? {},
    tagline: (s.get("Tagline") ?? "").trim(),
    role: (s.get("Role") ?? "").trim(),
    inOneMinuteHtml: await markdownToHtml(s.get("In one minute") ?? ""),
    stats: parseStatLines(s.get("Stats")),
    problemHtml: await markdownToHtml(s.get("The problem") ?? ""),
    incidents: await splitCards(s.get("Incidents") ?? ""),
    bigIdeaHtml: await markdownToHtml(s.get("The big idea") ?? ""),
    capabilities: parseCapabilities(s.get("The wrapper")),
    howItWorksHtml: await markdownToHtml(s.get("How it works") ?? ""),
    walkthrough: await splitCards(s.get("Follow a job") ?? ""),
    decisions: await splitCards(s.get("Architect decisions") ?? ""),
    warStoryHtml: await markdownToHtml(s.get("The war story") ?? ""),
    impactHtml: await markdownToHtml(s.get("Impact") ?? ""),
    goingDeeperHtml: await markdownToHtml(s.get("Going deeper") ?? ""),
  };
}

// ---------------------------------------------------------------- deep dives (ADR-0014)

/** All deep-dive chapters (content/deep-dives/*.md, excluding _series files), sorted by series then order. */
export async function getDeepDives(): Promise<DeepDive[]> {
  const dir = path.join(CONTENT_DIR, "deep-dives");
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("_"));

  const chapters: DeepDive[] = [];
  for (const file of files) {
    const rel = path.join("deep-dives", file);
    const parsed = read(rel);
    if (!parsed) continue;
    const fm = deepDiveFrontmatterSchema.safeParse(parsed.data);
    if (!fm.success) {
      missing(rel, `valid frontmatter (${fm.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")})`);
      continue;
    }
    chapters.push({
      ...fm.data,
      slug: file.replace(/\.md$/, ""),
      bodyHtml: await markdownToHtml(stripComments(parsed.body)),
    });
  }
  return chapters.sort((a, b) =>
    a.series === b.series ? a.order - b.order : (a.series ?? "").localeCompare(b.series ?? ""),
  );
}

/** Standalone deep-dives (no `series`), featured first, then newest by date. */
export function standaloneDeepDives(chapters: DeepDive[]): DeepDive[] {
  return chapters
    .filter((c) => !c.series)
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.date.localeCompare(a.date));
}

export async function getDeepDive(slug: string): Promise<DeepDive | null> {
  const all = await getDeepDives();
  return all.find((d) => d.slug === slug) ?? null;
}

/** Draft chapters stay dev-only. */
export function visibleDeepDives(chapters: DeepDive[]): DeepDive[] {
  return STRICT ? chapters.filter((c) => c.status === "active") : chapters;
}

/** A deep-dive series (its _<slug>.md meta + intro) plus its visible chapters in order. */
export async function getDeepDiveSeries(slug: string): Promise<DeepDiveSeries | null> {
  const parsed = read(path.join("deep-dives", `_${slug}.md`));
  if (!parsed) return null;
  const fm = deepDiveSeriesFrontmatterSchema.safeParse(parsed.data);
  if (!fm.success) {
    missing(`deep-dives/_${slug}.md`, `valid frontmatter (${fm.error.issues.map((i) => i.message).join("; ")})`);
    return null;
  }
  const chapters = visibleDeepDives(await getDeepDives()).filter((d) => d.series === slug);
  // The filename-derived slug is canonical; ignore any divergent frontmatter `slug`.
  return { ...fm.data, slug, introHtml: await markdownToHtml(stripComments(parsed.body)), chapters };
}

/** Every deep-dive series (one _<slug>.md per series). */
export async function getDeepDiveSerieses(): Promise<DeepDiveSeries[]> {
  const dir = path.join(CONTENT_DIR, "deep-dives");
  if (!fs.existsSync(dir)) return [];
  const slugs = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("_") && f.endsWith(".md"))
    .map((f) => f.slice(1).replace(/\.md$/, ""));
  const serieses: DeepDiveSeries[] = [];
  for (const slug of slugs) {
    const s = await getDeepDiveSeries(slug);
    if (s && (!STRICT || s.status === "active")) serieses.push(s);
  }
  return serieses.sort((a, b) => Number(b.featured) - Number(a.featured) || a.title.localeCompare(b.title));
}

// ---------------------------------------------------------------- papers

/** Strip ```bibtex fences from the optional BibTeX section, leaving the raw entry. */
function extractBibtex(section: string | undefined): string | null {
  if (!section) return null;
  const fenced = section.match(/```(?:bibtex)?\n([\s\S]*?)```/);
  const raw = (fenced ? fenced[1]! : section).trim();
  return raw || null;
}

/** content/papers/*.md → the research library (ADR-0008). */
export async function getPapers(): Promise<Paper[]> {
  const dir = path.join(CONTENT_DIR, "papers");
  if (!fs.existsSync(dir)) return [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort();

  const papers: Paper[] = [];
  for (const file of files) {
    const rel = path.join("papers", file);
    const parsed = read(rel);
    if (!parsed) continue;

    const fmResult = paperFrontmatterSchema.safeParse(parsed.data);
    if (!fmResult.success) {
      missing(rel, `valid frontmatter (${fmResult.error.issues.map((i) => i.path.join(".") + ": " + i.message).join("; ")})`);
      continue;
    }

    const fm = fmResult.data;
    // related.* are rendered as hrefs on four surfaces — a dangling slug ships 404 links
    if (fm.related.project && !fs.existsSync(path.join(CONTENT_DIR, "projects", `${fm.related.project}.md`))) {
      missing(rel, `existing related.project (content/projects/${fm.related.project}.md not found)`);
    }
    if (fm.related.lesson && !fs.existsSync(path.join(CONTENT_DIR, "learn", `${fm.related.lesson}.md`))) {
      missing(rel, `existing related.lesson (content/learn/${fm.related.lesson}.md not found)`);
    }

    const sections = splitLabelSections(stripComments(parsed.body));
    for (const s of PAPER_SECTIONS) {
      if (!sections.get(s)) missing(rel, `**${s}:** section`);
    }

    papers.push({
      ...fm,
      slug: file.replace(/\.md$/, ""),
      abstractHtml: await markdownToHtml(sections.get("Abstract") ?? ""),
      plainWordsHtml: await markdownToHtml(sections.get("In plain words") ?? ""),
      methodHtml: await markdownToHtml(sections.get("Method") ?? ""),
      resultsHtml: await markdownToHtml(sections.get("Results") ?? ""),
      lookingBackHtml: await markdownToHtml(sections.get("Looking back") ?? ""),
      bibtex: extractBibtex(sections.get("BibTeX")),
    });
  }

  // featured first, then newest
  return papers.sort((a, b) => Number(b.featured) - Number(a.featured) || b.year - a.year);
}

/** Resolves only papers visible in the current env — drafts stay dev-only on every surface (MCP included). */
export async function getPaper(slug: string): Promise<Paper | null> {
  const all = visiblePapers(await getPapers());
  return all.find((p) => p.slug === slug) ?? null;
}

/** Draft papers are hidden from production listings but still routable in dev. */
export function visiblePapers(papers: Paper[]): Paper[] {
  return STRICT ? papers.filter((p) => p.status === "active") : papers;
}

// ---------------------------------------------------------------- about

/** Parse the "## State vector" list into exactly two ket labels (the About flourish's basis states). */
function parseStateVectorKets(section: string | undefined): [string, string] {
  const items = (section ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
  if (items.length !== 2) {
    missing("about.md", `"## State vector" section with exactly two list items (got ${items.length})`);
    return ["", ""];
  }
  return [items[0]!, items[1]!];
}

export async function getAbout(): Promise<About> {
  const parsed = read("about.md");
  if (!parsed) {
    missing("about.md", "file");
    return {
      status: "draft",
      tagline: "",
      subheading: "",
      subheadings: { recruiter: "", professor: "", engineer: "" },
      narrativeHtml: "",
      stateVector: ["", ""],
      educationHtml: null,
    };
  }
  const fm = simpleFrontmatterSchema.parse(parsed.data ?? {});
  const sections = splitHeadingSections(stripComments(parsed.body));
  for (const s of ABOUT_SECTIONS) {
    if (!sections.get(s)) missing("about.md", `"## ${s}" section`);
  }
  const subheading = sections.get("Hero subheading") ?? "";
  return {
    status: fm.status,
    tagline: sections.get("Hero tagline") ?? "",
    subheading,
    // lens variants are optional — absent ones fall back to the base (plan-0005)
    subheadings: {
      recruiter: subheading,
      professor: sections.get("Hero subheading (professor)") || subheading,
      engineer: sections.get("Hero subheading (engineer)") || subheading,
    },
    narrativeHtml: await markdownToHtml(sections.get("About me narrative") ?? ""),
    stateVector: parseStateVectorKets(sections.get("State vector")),
    educationHtml: sections.get("Education") ? await markdownToHtml(sections.get("Education")!) : null,
  };
}

// ---------------------------------------------------------------- agents

/** content/agents.md → the /agents machine-interface page, sections in file order (ADR-0009). */
export async function getAgentsPage(): Promise<AgentsSection[]> {
  const parsed = read("agents.md");
  if (!parsed) {
    missing("agents.md", "file");
    return [];
  }
  simpleFrontmatterSchema.parse(parsed.data ?? {});
  const sections = splitHeadingSections(stripComments(parsed.body));
  const out: AgentsSection[] = [];
  for (const heading of AGENTS_SECTIONS) {
    const block = sections.get(heading);
    if (!block) {
      missing("agents.md", `"## ${heading}" section`);
      continue;
    }
    out.push({ heading, bodyHtml: await markdownToHtml(block) });
  }
  return out;
}

// ---------------------------------------------------------------- colophon

/** content/colophon.md → /colophon prose sections, in COLOPHON_SECTIONS order. */
export async function getColophonPage(): Promise<ColophonSection[]> {
  const parsed = read("colophon.md");
  if (!parsed) {
    missing("colophon.md", "file");
    return [];
  }
  simpleFrontmatterSchema.parse(parsed.data ?? {});
  const sections = splitHeadingSections(stripComments(parsed.body));
  const out: ColophonSection[] = [];
  for (const heading of COLOPHON_SECTIONS) {
    const block = sections.get(heading);
    if (!block) {
      missing("colophon.md", `"## ${heading}" section`);
      continue;
    }
    out.push({ heading, bodyHtml: await markdownToHtml(block) });
  }
  return out;
}

// ---------------------------------------------------------------- verify

/** content/verify.md → /verify prose sections, in VERIFY_SECTIONS order (ADR-0016). */
export async function getVerifyPage(): Promise<VerifySection[]> {
  const parsed = read("verify.md");
  if (!parsed) {
    missing("verify.md", "file");
    return [];
  }
  simpleFrontmatterSchema.parse(parsed.data ?? {});
  const sections = splitHeadingSections(stripComments(parsed.body));
  const out: VerifySection[] = [];
  for (const heading of VERIFY_SECTIONS) {
    const block = sections.get(heading);
    if (!block) {
      missing("verify.md", `"## ${heading}" section`);
      continue;
    }
    out.push({ heading, bodyHtml: await markdownToHtml(block) });
  }
  return out;
}

// ---------------------------------------------------------------- hire

/**
 * content/hire.md → /hire (plan-0006): an "## Intro" section plus one
 * "## Service" section per offering, each carrying Pitch, Price, and CTA
 * bold-label lines. The CTA must be a single markdown link; a service
 * missing any required label fails the production build (ADR-0002).
 */
export async function getHirePage(): Promise<HirePage> {
  const parsed = read("hire.md");
  if (!parsed) {
    missing("hire.md", "file");
    return { introHtml: "", services: [] };
  }
  simpleFrontmatterSchema.parse(parsed.data ?? {});
  const sections = splitHeadingSections(stripComments(parsed.body));
  const introHtml = await markdownToHtml(sections.get("Intro") ?? missing("hire.md", '"## Intro" section'));

  const services: Service[] = [];
  for (const [title, block] of sections) {
    if (title === "Intro") continue;
    const labels = splitLabelSections(block);
    const pitch = labels.get("Pitch") ?? missing("hire.md", `"**Pitch:**" in "## ${title}"`);
    const price = labels.get("Price") ?? missing("hire.md", `"**Price:**" in "## ${title}"`);
    const ctaRaw = labels.get("CTA") ?? missing("hire.md", `"**CTA:**" in "## ${title}"`);
    const link = ctaRaw.match(/\[([^\]]+)\]\(([^)\s]+)\)/);
    if (!link) {
      missing("hire.md", `a markdown-link CTA in "## ${title}"`);
      continue;
    }
    services.push({
      title,
      pitchHtml: await markdownToHtml(pitch),
      price: price.replace(/\s+/g, " ").trim(),
      cta: { label: link[1]!, href: link[2]! },
    });
  }
  if (services.length === 0) missing("hire.md", "at least one service section");
  return { introHtml, services };
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

// ---------------------------------------------------------------- testimonials

/**
 * Parse testimonials.md blockquotes into typed quotes. One blockquote per
 * testimonial; its last line is the attribution `— Name, Title, Company`
 * (title/company optional). Angle-bracket template stubs read as empty, so
 * the /about section stays invisible until real quotes exist — quotes are
 * pasted by their authors, never fabricated.
 */
export async function parseTestimonials(rawBody: string): Promise<Testimonial[]> {
  const body = stripComments(rawBody)
    .replace(/^# .+$/m, "")
    .trim();
  if (!body || /^[->\s]*<.+>/.test(body)) return [];

  const testimonials: Testimonial[] = [];
  const blocks = body.split(/\n\s*\n/).filter((b) => b.trim().startsWith(">"));
  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.replace(/^\s*>\s?/, "").trim())
      .filter(Boolean);
    const attr = lines.at(-1);
    if (!attr?.startsWith("—")) {
      missing("testimonials.md", "an attribution last line (— Name, Title, Company) in each blockquote");
      continue;
    }
    const quote = lines.slice(0, -1).join(" ").trim();
    const parts = attr
      .replace(/^—\s*/, "")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const name = parts[0];
    if (!quote || !name) {
      missing("testimonials.md", "a non-empty quote and attributed name in each blockquote");
      continue;
    }
    testimonials.push({
      quoteHtml: await markdownToHtml(quote),
      name,
      title: parts[1] ?? null,
      company: parts.slice(2).join(", ") || null,
    });
  }
  return testimonials;
}

/** content/testimonials.md → typed quotes for /about; [] while the file is a stub. */
export async function getTestimonials(): Promise<Testimonial[]> {
  const parsed = read("testimonials.md");
  if (!parsed) return [];
  return parseTestimonials(parsed.body);
}

// ---------------------------------------------------------------- optional files

/** writing.md / playground.md / d3.md — optional; empty (or template-only) → null. */
export async function getOptionalHtml(file: "writing.md" | "playground.md" | "d3.md"): Promise<string | null> {
  const parsed = read(file);
  if (!parsed) return null;
  const body = stripComments(parsed.body)
    .replace(/^# .+$/m, "") // drop the H1 title
    .trim();
  // Treat template placeholders (angle-bracket stubs) as empty.
  if (!body || /^[->\s]*<.+>/.test(body)) return null;
  return markdownToHtml(body);
}

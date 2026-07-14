import { z } from "zod";

/** Shared status lifecycle for content files (mirrors docs lifecycle). */
export const contentStatus = z.enum(["draft", "active"]).default("active");

export const projectFrontmatterSchema = z.object({
  title: z.string().min(1),
  /** YYYY-MM */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "date must be YYYY-MM")
    .or(z.date().transform((d) => d.toISOString().slice(0, 7))),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  category: z.enum(["engineering", "research"]),
  links: z
    .object({
      github: z.string().url().nullable().default(null),
      live: z.string().url().nullable().default(null),
    })
    .default({ github: null, live: null }),
  status: contentStatus,
  /** Bespoke narrative layout for flagship case studies (ADR-0013); default = the standard abstract layout. */
  layout: z.enum(["default", "case-study"]).default("default"),
});

export type ProjectFrontmatter = z.infer<typeof projectFrontmatterSchema>;

export const simpleFrontmatterSchema = z.object({
  status: contentStatus,
});

/** Required body sections of a project file (template labels). */
export const PROJECT_SECTIONS = ["Summary", "Problem", "Approach", "Impact", "Tech stack"] as const;
export const PROJECT_OPTIONAL_SECTIONS = ["Links", "Media"] as const;
export type ProjectSection = (typeof PROJECT_SECTIONS)[number] | (typeof PROJECT_OPTIONAL_SECTIONS)[number];

/** Required headings of about.md. */
export const ABOUT_SECTIONS = ["Hero tagline", "Hero subheading", "About me narrative", "State vector"] as const;

/** Optional per-lens hero subheadings (plan-0005); absent variants fall back to the base. */
export const ABOUT_LENS_SECTIONS = ["Hero subheading (professor)", "Hero subheading (engineer)"] as const;

/** Required headings of colophon.md — the /colophon receipts page (plan-0006). */
export const COLOPHON_SECTIONS = ["Intro", "Principles", "Template"] as const;

export type ColophonSection = { heading: (typeof COLOPHON_SECTIONS)[number]; bodyHtml: string };

/** Required headings of agents.md — the /agents machine-interface page (ADR-0009). */
export const AGENTS_SECTIONS = [
  "Tagline",
  "Why agent-native",
  "MCP server",
  "WebMCP tools",
  "Feeds",
  "Fit report",
  "Guestbook",
  "Agent card",
  "How to interview this site",
] as const;

export type AgentsSection = { heading: (typeof AGENTS_SECTIONS)[number]; bodyHtml: string };

/** One self-hosted figure from a project's **Media:** section (ADR-0012). */
export type ProjectFigure = {
  /** Site-relative path, always under /figures/ and always .svg. */
  src: string;
  caption: string;
};

export type Project = ProjectFrontmatter & {
  slug: string;
  summary: string;
  problemHtml: string;
  approachHtml: string;
  impactHtml: string;
  techStack: string;
  linksNote: string | null;
  figures: ProjectFigure[];
};

// ---------------------------------------------------------------- case study (ADR-0013)

/** A big numeral on a case study (`- value | label`), reused for hero stats and outcomes. */
export type CaseStudyStat = { value: string; label: string };

/** A titled card (### heading, optional emphasized *meta* first line, then body). */
export type CaseStudyCard = { title: string; meta: string | null; bodyHtml: string };

/** One row of the "wrapper" capability grid (`- name | body`). */
export type CaseStudyCapability = { name: string; body: string };

/**
 * content/case-studies/<slug>.md → the bespoke narrative layout (ADR-0013).
 * Each field maps to a `## Heading` section; missing sections render nothing.
 */
export type CaseStudy = {
  slug: string;
  /** Per-case-study overrides for the bespoke section display headings (frontmatter `headings:`);
   * absent keys fall back to the layout's defaults so the first case study keeps its wording. */
  headings: Record<string, string>;
  tagline: string;
  role: string;
  inOneMinuteHtml: string;
  stats: CaseStudyStat[];
  problemHtml: string;
  incidents: CaseStudyCard[];
  bigIdeaHtml: string;
  capabilities: CaseStudyCapability[];
  howItWorksHtml: string;
  walkthrough: CaseStudyCard[];
  decisions: CaseStudyCard[];
  warStoryHtml: string;
  impactHtml: string;
  goingDeeperHtml: string;
};

export type About = {
  status: z.infer<typeof contentStatus>;
  tagline: string;
  subheading: string;
  /** Per-lens hero subheadings; every key resolved (missing variants = base subheading). */
  subheadings: { recruiter: string; professor: string; engineer: string };
  narrativeHtml: string;
  /** The two ket labels of the "## State vector" section: [engineering basis state, research basis state]. */
  stateVector: [string, string];
  /** Optional "## Education" section (plan-0006, /cv); null when absent. */
  educationHtml: string | null;
};

/** One paid offering on /hire (plan-0006): a "## Service" section of hire.md. */
export type Service = {
  title: string;
  pitchHtml: string;
  price: string;
  cta: { label: string; href: string };
};

export type HirePage = {
  introHtml: string;
  services: Service[];
};

/** One quote from content/testimonials.md — parsed, never fabricated. */
export type Testimonial = {
  quoteHtml: string;
  name: string;
  title: string | null;
  company: string | null;
};

export type ExperienceRole = {
  heading: string; // "Company — Title"
  meta: string; // "dates · location"
  bodyHtml: string;
};

export type SkillGroup = {
  group: string;
  bodyHtml: string;
};

// ---------------------------------------------------------------- deep dives (ADR-0014)

/** One chapter of a technical deep-dive series (content/deep-dives/<slug>.md). */
export const deepDiveFrontmatterSchema = z.object({
  title: z.string().min(1),
  /** Omit for a standalone flagship piece (renders on its own, no series TOC). */
  series: z.string().min(1).optional(),
  /** Position within a series; ignored for standalone pieces. */
  order: z.number().int().min(1).default(1),
  summary: z.string().min(1),
  readingMinutes: z.number().int().positive(),
  /** YYYY-MM */
  date: z.string().regex(/^\d{4}-\d{2}$/, "date must be YYYY-MM"),
  tags: z.array(z.string()).default([]),
  /** Standalone pieces only: surface at the top of the index. */
  featured: z.boolean().default(false),
  status: contentStatus,
});
export type DeepDiveFrontmatter = z.infer<typeof deepDiveFrontmatterSchema>;

export type DeepDive = DeepDiveFrontmatter & {
  slug: string;
  bodyHtml: string;
};

/** Series metadata file: content/deep-dives/_<slug>.md (skipped by the chapter loader). */
export const deepDiveSeriesFrontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  tagline: z.string().min(1),
  featured: z.boolean().default(false),
  /** Titles of episodes that are planned but not yet written — rendered as dimmed "planned" rows. */
  upcoming: z.array(z.string()).default([]),
  status: contentStatus,
});
export type DeepDiveSeries = z.infer<typeof deepDiveSeriesFrontmatterSchema> & {
  introHtml: string;
  chapters: DeepDive[];
};

export const paperFrontmatterSchema = z.object({
  title: z.string().min(1),
  authors: z.array(z.string()).min(1),
  venue: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  kind: z.enum(["thesis", "paper", "report"]),
  supervisor: z.string().nullable().default(null),
  /** true = a reviewed copy ships in public/papers/<slug>.pdf (ADR-0008 curation). */
  pdf: z.boolean().default(false),
  tags: z.array(z.string()).default([]),
  related: z
    .object({
      project: z.string().nullable().default(null),
      lesson: z.string().nullable().default(null),
    })
    .default({ project: null, lesson: null }),
  featured: z.boolean().default(false),
  status: contentStatus,
});

export type PaperFrontmatter = z.infer<typeof paperFrontmatterSchema>;

/** Required body sections of a paper file (content/papers/*.md). */
export const PAPER_SECTIONS = ["Abstract", "In plain words", "Method", "Results", "Looking back"] as const;

export type Paper = PaperFrontmatter & {
  slug: string;
  abstractHtml: string;
  plainWordsHtml: string;
  methodHtml: string;
  resultsHtml: string;
  lookingBackHtml: string;
  /** Raw BibTeX (fences stripped) from the optional **BibTeX:** section. */
  bibtex: string | null;
};

export const lessonFrontmatterSchema = z.object({
  title: z.string().min(1),
  order: z.number().int().positive(),
  status: contentStatus,
});

/** Required body sections of a lesson file (content/learn/*.md). */
export const LESSON_SECTIONS = ["Hook", "Explain", "Try it", "Takeaway"] as const;

export type Lesson = z.infer<typeof lessonFrontmatterSchema> & {
  slug: string;
  hookHtml: string;
  explainHtml: string;
  tryItHtml: string;
  takeawayHtml: string;
  deeperHtml: string | null;
};

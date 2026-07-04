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
export const ABOUT_SECTIONS = ["Hero tagline", "Hero subheading", "About me narrative"] as const;

export type Project = ProjectFrontmatter & {
  slug: string;
  summary: string;
  problemHtml: string;
  approachHtml: string;
  impactHtml: string;
  techStack: string;
  linksNote: string | null;
  media: string | null;
};

export type About = {
  status: z.infer<typeof contentStatus>;
  tagline: string;
  subheading: string;
  narrativeHtml: string;
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

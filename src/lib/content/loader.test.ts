import { describe, expect, it } from "vitest";
import { getAbout, getColophonPage, getExperience, getHirePage, getProjects, getSkills, getTestimonials, parseProjectFigures, parseTestimonials, splitHeadingSections, splitLabelSections } from "./loader";
import { projectFrontmatterSchema } from "./schema";

describe("splitLabelSections", () => {
  it("parses **Label:** template sections", () => {
    const md = `# Title

**Summary:** one line.

**Problem:** the pain
spanning two lines.

**Tech stack:** a, b, c`;
    const s = splitLabelSections(md);
    expect(s.get("Summary")).toBe("one line.");
    expect(s.get("Problem")).toContain("spanning two lines");
    expect(s.get("Tech stack")).toBe("a, b, c");
  });

  it("returns empty map for unstructured text", () => {
    expect(splitLabelSections("just some prose").size).toBe(0);
  });
});

describe("splitHeadingSections", () => {
  it("parses ## heading sections in order", () => {
    const md = `# H1

## First
alpha

## Second
beta`;
    const s = splitHeadingSections(md);
    expect([...s.keys()]).toEqual(["First", "Second"]);
    expect(s.get("Second")).toBe("beta");
  });
});

describe("parseProjectFigures", () => {
  it("parses one markdown image per line into typed figures", () => {
    const section = [
      "![Fig. 1 — Aspire service graph](/figures/kioskvisionai-aspire-graph.svg)",
      "![Fig. 2 — architecture](/figures/multi-output-cnn-architecture.svg)",
    ].join("\n");
    const figs = parseProjectFigures(section, "projects/x.md");
    expect(figs).toEqual([
      { src: "/figures/kioskvisionai-aspire-graph.svg", caption: "Fig. 1 — Aspire service graph" },
      { src: "/figures/multi-output-cnn-architecture.svg", caption: "Fig. 2 — architecture" },
    ]);
  });

  it("returns [] for an absent or empty Media section", () => {
    expect(parseProjectFigures(undefined, "projects/x.md")).toEqual([]);
    expect(parseProjectFigures("", "projects/x.md")).toEqual([]);
    expect(parseProjectFigures("  \n ", "projects/x.md")).toEqual([]);
  });

  it("drops non-image lines and non-/figures/*.svg sources (dev-lenient)", () => {
    expect(parseProjectFigures("_TODO: a figure_", "projects/x.md")).toEqual([]);
    expect(parseProjectFigures("![cap](https://evil.example/x.svg)", "projects/x.md")).toEqual([]);
    expect(parseProjectFigures("![cap](/figures/../../secret.svg)", "projects/x.md")).toEqual([]);
    expect(parseProjectFigures("![cap](/figures/shot.png)", "projects/x.md")).toEqual([]);
  });

  it("drops figures whose file does not exist in public/", () => {
    expect(parseProjectFigures("![cap](/figures/does-not-exist.svg)", "projects/x.md")).toEqual([]);
  });
});

describe("parseTestimonials", () => {
  it("parses blockquote + attribution pairs into typed quotes", async () => {
    const md = `# Testimonials

> Shipped the integration two weeks early and documented *everything*.
> — Jane Doe, CTO, Acme Corp

> A rigorous, curious researcher.
> — Prof. X`;
    const t = await parseTestimonials(md);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ name: "Jane Doe", title: "CTO", company: "Acme Corp" });
    expect(t[0]!.quoteHtml).toContain("<em>everything</em>");
    expect(t[1]).toMatchObject({ name: "Prof. X", title: null, company: null });
  });

  it("treats the angle-bracket template stub as empty", async () => {
    const stub = `# Testimonials\n\n> <quote>\n> — <name>, <title>, <company>`;
    expect(await parseTestimonials(stub)).toEqual([]);
    expect(await parseTestimonials("")).toEqual([]);
  });

  it("drops blockquotes without an attribution line (dev-lenient)", async () => {
    expect(await parseTestimonials("> just a quote, no attribution")).toEqual([]);
  });

  it("returns [] for the real (still-stub) content file", async () => {
    expect(await getTestimonials()).toEqual([]);
  });
});

describe("projectFrontmatterSchema", () => {
  const valid = {
    title: "X",
    date: "2025-01",
    category: "engineering",
  };

  it("accepts minimal valid frontmatter with defaults", () => {
    const p = projectFrontmatterSchema.parse(valid);
    expect(p.featured).toBe(false);
    expect(p.status).toBe("active");
    expect(p.links.github).toBeNull();
  });

  it("rejects bad category and bad date", () => {
    expect(() => projectFrontmatterSchema.parse({ ...valid, category: "art" })).toThrow();
    expect(() => projectFrontmatterSchema.parse({ ...valid, date: "June 2025" })).toThrow();
  });
});

describe("real content/ files", () => {
  it("loads all projects with slugs, sections, and valid categories", async () => {
    const projects = await getProjects();
    expect(projects.length).toBeGreaterThanOrEqual(8);
    for (const p of projects) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.summary.length).toBeGreaterThan(10);
      expect(p.problemHtml).toContain("<p>");
      expect(["engineering", "research"]).toContain(p.category);
    }
    // figure pipeline (ADR-0012): the three illustrated projects carry validated figures
    const bySlug = new Map(projects.map((p) => [p.slug, p]));
    expect(bySlug.get("kioskvisionai")?.figures).toHaveLength(1);
    expect(bySlug.get("quantum-machine-learning-thesis")?.figures).toHaveLength(2);
    expect(bySlug.get("multi-output-cnn")?.figures).toHaveLength(1);
    // newest first
    const dates = projects.map((p) => p.date);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it("loads about.md hero contract", async () => {
    const about = await getAbout();
    expect(about.tagline.length).toBeGreaterThan(10);
    expect(about.subheading.length).toBeGreaterThan(10);
    expect(about.narrativeHtml).toContain("<p>");
  });

  it("loads the two state-vector kets for the About flourish", async () => {
    const about = await getAbout();
    expect(about.stateVector).toEqual(["backend engineer", "QML researcher"]);
  });

  it("resolves every lens subheading, falling back to the base when a variant is absent", async () => {
    const about = await getAbout();
    expect(about.subheadings.recruiter).toBe(about.subheading);
    for (const lens of ["recruiter", "professor", "engineer"] as const) {
      expect(about.subheadings[lens].length).toBeGreaterThan(10);
    }
    // the authored variants differ from the base (content/about.md carries them)
    expect(about.subheadings.professor).not.toBe(about.subheading);
    expect(about.subheadings.engineer).not.toBe(about.subheading);
  });

  it("loads experience roles with meta lines", async () => {
    const roles = await getExperience();
    expect(roles.length).toBeGreaterThanOrEqual(3);
    expect(roles[0]!.heading).toContain("—");
    expect(roles[0]!.meta).toContain("·");
    expect(roles[0]!.bodyHtml).toContain("<li>");
  });

  it("loads skill groups", async () => {
    const groups = await getSkills();
    expect(groups.length).toBeGreaterThanOrEqual(6);
    expect(groups.map((g) => g.group)).toContain("Quantum");
  });

  it("loads the education section for /cv (plan-0006)", async () => {
    const about = await getAbout();
    expect(about.educationHtml).toContain("North South University");
  });

  it("loads colophon.md sections in order (plan-0006)", async () => {
    const sections = await getColophonPage();
    expect(sections.map((s) => s.heading)).toEqual(["Intro", "Principles", "Template"]);
    for (const s of sections) expect(s.bodyHtml).toContain("<");
  });

  it("loads hire.md services with pitch, price, and a link CTA (plan-0006)", async () => {
    const { introHtml, services } = await getHirePage();
    expect(introHtml).toContain("<p>");
    expect(services.length).toBeGreaterThanOrEqual(3);
    for (const s of services) {
      expect(s.title.length).toBeGreaterThan(3);
      expect(s.pitchHtml).toContain("<p>");
      expect(s.price.length).toBeGreaterThan(3);
      expect(s.cta.href).toMatch(/^(mailto:|https:\/\/)/);
      expect(s.cta.label.length).toBeGreaterThan(3);
    }
  });
});

describe("papers (ADR-0008)", () => {
  it("loads the research library with all required sections", async () => {
    const { getPapers } = await import("./loader");
    const papers = await getPapers();
    expect(papers.length).toBeGreaterThanOrEqual(4);
    for (const p of papers) {
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.authors[0]).toBe("Md. Abu Ammar");
      expect(p.abstractHtml).toContain("<p>");
      expect(p.plainWordsHtml).toContain("<p>");
      expect(p.methodHtml).toContain("<p>");
      expect(p.resultsHtml).toContain("<p>");
      expect(p.lookingBackHtml).toContain("<p>");
    }
    // featured first, then newest
    const featured = papers.map((p) => p.featured);
    expect(featured.indexOf(false)).toBeGreaterThanOrEqual(featured.lastIndexOf(true));
  });

  it("curates PDFs: hosted papers ship a file, others do not claim one", async () => {
    const { getPapers } = await import("./loader");
    const fs = await import("node:fs");
    for (const p of await getPapers()) {
      const shipped = fs.existsSync(`public/papers/${p.slug}.pdf`);
      expect(shipped).toBe(p.pdf);
    }
  });

  it("related.project / related.lesson always resolve to real content files", async () => {
    const { getPapers } = await import("./loader");
    const fs = await import("node:fs");
    for (const p of await getPapers()) {
      if (p.related.project) expect(fs.existsSync(`content/projects/${p.related.project}.md`), `${p.slug} → project ${p.related.project}`).toBe(true);
      if (p.related.lesson) expect(fs.existsSync(`content/learn/${p.related.lesson}.md`), `${p.slug} → lesson ${p.related.lesson}`).toBe(true);
    }
  });

  it("extracts raw BibTeX from the fenced block", async () => {
    const { getPaper } = await import("./loader");
    const thesis = await getPaper("quantum-machine-learning-thesis");
    expect(thesis).not.toBeNull();
    expect(thesis!.bibtex).toMatch(/^@thesis\{ammar2022qml,/);
    expect(thesis!.bibtex).not.toContain("```");
    expect(thesis!.supervisor).toBe("Dr. Mahdy Rahman Chowdhury");
    expect(thesis!.related.lesson).toBe("06-quanvolution");
  });
});

describe("agents page (ADR-0009)", () => {
  it("loads all required sections of agents.md in order", async () => {
    const { getAgentsPage } = await import("./loader");
    const { AGENTS_SECTIONS } = await import("./schema");
    const sections = await getAgentsPage();
    expect(sections.map((s) => s.heading)).toEqual([...AGENTS_SECTIONS]);
    for (const s of sections) {
      expect(s.bodyHtml.length, s.heading).toBeGreaterThan(20);
    }
  });
});

describe("lessons + explainers (P2)", () => {
  it("loads 6 ordered lessons with all required sections", async () => {
    const { getLessons } = await import("./loader");
    const lessons = await getLessons();
    expect(lessons).toHaveLength(6);
    expect(lessons.map((l) => l.order)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const l of lessons) {
      expect(l.hookHtml).toContain("<p>");
      expect(l.explainHtml).toContain("<p>");
      expect(l.tryItHtml).toContain("<p>");
      expect(l.takeawayHtml).toContain("<p>");
    }
    expect(lessons[0]!.slug).toBe("01-qubit");
    expect(lessons[5]!.deeperHtml).toContain("thesis");
  });

  it("loads explainers keyed by section", async () => {
    const { getExplainers } = await import("./loader");
    const ex = await getExplainers();
    expect(ex.get("hero-classifier")).toContain("variational");
    expect(ex.get("quanvolution")).toContain("filter");
    expect(ex.size).toBeGreaterThanOrEqual(5);
  });
});

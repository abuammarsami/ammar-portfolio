import { describe, expect, it } from "vitest";
import { getAbout, getExperience, getProjects, getSkills, splitHeadingSections, splitLabelSections } from "./loader";
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

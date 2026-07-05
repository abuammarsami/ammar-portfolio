import { getLessons, getPapers, getProjects, visiblePapers, visibleProjects } from "@/lib/content/loader";
import type { SearchEntry } from "@/lib/search";

export const dynamic = "force-static";

/**
 * The ⌘K full-content search index (plan-0005 P5): prerendered at build from
 * the same loaders as the pages, fetched by the palette on demand — never
 * bundled. Titles and paths only; the palette's fuzzy scorer does the rest.
 */
export async function GET() {
  const [projects, papers, lessons] = await Promise.all([getProjects(), getPapers(), getLessons()]);
  const entries: SearchEntry[] = [
    ...visibleProjects(projects).map((p) => ({
      title: p.title,
      path: `/work/${p.slug}`,
      kind: p.category === "research" ? "research project" : "case study",
      hint: p.tags.slice(0, 3).join(" · "),
    })),
    ...visiblePapers(papers).map((p) => ({
      title: p.title,
      path: `/research/${p.slug}`,
      kind: p.kind,
      hint: `${p.venue} · ${p.year}`,
    })),
    ...lessons.map((l) => ({
      title: l.title,
      path: `/learn#${l.slug}`,
      kind: "lesson",
      hint: `interactive · lesson ${l.order}`,
    })),
  ];
  return Response.json({ entries });
}

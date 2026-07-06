import { composeCircuit } from "@/lib/agent/compose-circuit";
import { buildCorpus } from "@/lib/agent/corpus";
import { getLessons, getPaper, getPapers, getProjects, visiblePapers, visibleProjects } from "@/lib/content/loader";
import { LINKS, SITE_URL } from "@/lib/site";

/**
 * The MCP tool layer — ADR-0007/0009. One source of truth consumed by
 * /api/mcp (JSON-RPC), the /agents docs page, and the A2A agent card.
 */

export const TOOLS = [
  { name: "get_resume", description: "Md. Abu Ammar's full resume/corpus as plain text.", inputSchema: { type: "object", properties: {} } },
  { name: "list_projects", description: "All projects/case studies with summaries, categories, and links.", inputSchema: { type: "object", properties: {} } },
  { name: "search_publications", description: "Full-text search over Md. Abu Ammar's real papers and theses (title, abstract, method, results).", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "get_paper", description: "One paper, distilled: abstract, plain-words summary, method, honest results, retrospective, BibTeX.", inputSchema: { type: "object", properties: { slug: { type: "string", description: "Paper slug from search_publications, e.g. quantum-machine-learning-thesis" } }, required: ["slug"] } },
  { name: "get_lessons", description: "The /learn interactive quantum curriculum outline.", inputSchema: { type: "object", properties: {} } },
  { name: "contact", description: "How to contact Md. Abu Ammar.", inputSchema: { type: "object", properties: {} } },
  { name: "compose_circuit", description: "Run a 2-qubit quantum circuit on the site's exact statevector simulator. Grammar: gates joined by '_': h0/h1 (Hadamard), ry0:θ/ry1:θ, rz0:θ/rz1:θ (rotations, θ in radians, |θ|≤π), cx (CNOT q0→q1). Example Bell pair: 'h0_cx'. Returns outcome probabilities, per-qubit Bloch vectors, and a shareable /playground URL.", inputSchema: { type: "object", properties: { circuit: { type: "string", description: "e.g. h0_ry1:0.7854_cx" } }, required: ["circuit"] } },
] as const;

export async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "get_resume":
      return buildCorpus();
    case "list_projects": {
      const projects = visibleProjects(await getProjects());
      return JSON.stringify(
        projects.map((p) => ({
          title: p.title, category: p.category, date: p.date, summary: p.summary,
          tags: p.tags, url: `${SITE_URL}/work/${p.slug}`, github: p.links.github,
        })), null, 2,
      );
    }
    case "search_publications": {
      const q = String(args.query ?? "").toLowerCase();
      const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const papers = visiblePapers(await getPapers());
      const paperHits = papers
        .filter((p) =>
          [p.title, p.venue, p.tags.join(" "), strip(p.abstractHtml), strip(p.methodHtml), strip(p.resultsHtml)]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
        .map((p) => ({
          slug: p.slug, title: p.title, kind: p.kind, venue: p.venue, year: p.year,
          abstract: strip(p.abstractHtml), url: `${SITE_URL}/research/${p.slug}`,
          pdf: p.pdf ? `${SITE_URL}/papers/${p.slug}.pdf` : "on request",
        }));
      const research = visibleProjects(await getProjects()).filter((p) => p.category === "research");
      const projectHits = research
        .filter((p) => [p.title, p.summary, p.tags.join(" ")].join(" ").toLowerCase().includes(q))
        .map((p) => ({ title: p.title, kind: "research project", summary: p.summary, url: `${SITE_URL}/work/${p.slug}` }));
      return JSON.stringify({ papers: paperHits, projects: projectHits }, null, 2);
    }
    case "get_paper": {
      const strip = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const paper = await getPaper(String(args.slug ?? ""));
      if (!paper) throw new Error(`unknown paper: ${String(args.slug)} — call search_publications first`);
      return JSON.stringify(
        {
          title: paper.title, authors: paper.authors, supervisor: paper.supervisor,
          venue: paper.venue, year: paper.year, kind: paper.kind, tags: paper.tags,
          abstract: strip(paper.abstractHtml), inPlainWords: strip(paper.plainWordsHtml),
          method: strip(paper.methodHtml), results: strip(paper.resultsHtml),
          lookingBack: strip(paper.lookingBackHtml), bibtex: paper.bibtex,
          url: `${SITE_URL}/research/${paper.slug}`,
          pdf: paper.pdf ? `${SITE_URL}/papers/${paper.slug}.pdf` : "available on request",
        },
        null,
        2,
      );
    }
    case "get_lessons": {
      const lessons = await getLessons();
      return JSON.stringify(lessons.map((l) => ({ order: l.order, title: l.title, url: `${SITE_URL}/learn#${l.slug}` })), null, 2);
    }
    case "contact":
      return JSON.stringify({ email: LINKS.email, github: LINKS.github, linkedin: LINKS.linkedin, site: SITE_URL });
    case "compose_circuit":
      return composeCircuit(args.circuit);
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

import { getPaper, getPapers, visiblePapers } from "@/lib/content/loader";

/**
 * Downloadable BibTeX per paper (plan-0006, scholar layer). Statically
 * generated only for papers that carry a BibTeX block; a literal
 * `citation.bib` segment beats fighting the router for a `[slug].bib` file.
 */
export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const papers = visiblePapers(await getPapers());
  return papers.filter((p) => p.bibtex).map((p) => ({ slug: p.slug }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = await getPaper(slug);
  if (!paper?.bibtex) return new Response("no citation available", { status: 404 });
  return new Response(paper.bibtex + "\n", {
    headers: {
      "content-type": "text/x-bibtex; charset=utf-8",
      "content-disposition": `attachment; filename="${slug}.bib"`,
    },
  });
}

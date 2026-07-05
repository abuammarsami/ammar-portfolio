import type { Metadata } from "next";
import { ArxivRow } from "@/components/paper/arxiv-row";
import { ConstellationStage } from "@/components/research/constellation";
import { PaperRow } from "@/components/research/paper-row";
import { getPapers, getProjects, visiblePapers, visibleProjects } from "@/lib/content/loader";
import { buildConstellation } from "@/lib/research/graph";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Research",
  description:
    "The library: quantum machine learning, NLP, network security, and computer vision — real papers, distilled to be read in minutes, mapped by the ideas connecting them.",
};

export default async function ResearchPage() {
  const [papers, projects] = await Promise.all([
    getPapers().then(visiblePapers),
    getProjects().then(visibleProjects),
  ]);
  const researchProjects = projects.filter((p) => p.category === "research");
  const paperProjectSlugs = new Set(papers.map((p) => p.related.project).filter(Boolean));
  const graph = buildConstellation(papers, researchProjects);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": papers.map((p) => ({
      "@type": p.kind === "thesis" ? "Thesis" : "ScholarlyArticle",
      headline: p.title,
      author: p.authors.map((a) => ({ "@type": "Person", name: a })),
      datePublished: String(p.year),
      publisher: { "@type": "CollegeOrUniversity", name: "North South University" },
      about: p.tags,
      url: `${SITE_URL}/research/${p.slug}`,
    })),
  };

  return (
    <main className="mx-auto max-w-4xl px-6 pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="mt-12 font-serif text-4xl">Research</h1>
      <p className="mt-2 max-w-2xl text-muted">
        The library. Every paper below is real and readable in minutes — abstract, plain words,
        honest results (including the negative ones), and what each one taught me.
      </p>

      <figure className="mt-8">
        <ConstellationStage graph={graph} />
        <figcaption className="mt-2 text-center font-mono text-xs text-muted">
          fig. 1 — map of the space · solid = builds on · dashed = entangled by a shared idea
        </figcaption>
      </figure>

      <h2 className="mt-12 font-serif text-2xl">Papers &amp; theses</h2>
      <div className="mt-2">
        {papers.map((p) => (
          <PaperRow key={p.slug} paper={p} />
        ))}
      </div>

      <h2 className="mt-12 font-serif text-2xl">Research projects</h2>
      <p className="mt-1 font-mono text-xs text-muted">code-first work without a manuscript</p>
      <div className="mt-2">
        {researchProjects
          .filter((p) => !paperProjectSlugs.has(p.slug))
          .map((p) => (
            <ArxivRow
              key={p.slug}
              headingLevel="h3"
              vtName={`project-${p.slug}`}
              id={p.slug}
              title={p.title}
              date={p.date}
              categories={p.tags.slice(0, 4)}
              abstract={p.summary}
              links={[
                { label: "case study", href: `/work/${p.slug}` },
                ...(p.links.github ? [{ label: "github", href: p.links.github }] : []),
              ]}
            />
          ))}
      </div>
    </main>
  );
}

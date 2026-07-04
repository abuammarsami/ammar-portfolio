import type { Metadata } from "next";
import { ArxivRow } from "@/components/paper/arxiv-row";
import { getProjects, visibleProjects } from "@/lib/content/loader";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Research",
  description:
    "Quantum machine learning, NLP, and computer vision research — thesis, projects, and publications.",
};

export default async function ResearchPage() {
  const research = visibleProjects(await getProjects()).filter((p) => p.category === "research");

  return (
    <main className="mx-auto max-w-4xl px-6 pb-16">
      <h1 className="mt-12 font-serif text-4xl">Research</h1>
      <p className="mt-2 max-w-xl text-muted">
        Quantum machine learning, NLP, and computer vision — listed the arXiv way.
      </p>
      <div className="mt-6">
        {research.map((p) => (
          <ArxivRow
            key={p.slug}
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

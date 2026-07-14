import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BibtexBlock } from "@/components/paper/bibtex-block";
import { SectionHeading } from "@/components/paper/section-heading";
import { TagChip } from "@/components/ui/tag-chip";
import { Vt } from "@/components/ui/vt";
import { getDeepDive, getPaper, getPapers, visiblePapers } from "@/lib/content/loader";
import { LINKS, SITE_URL } from "@/lib/site";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const papers = visiblePapers(await getPapers());
  return papers.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const paper = await getPaper(slug);
  if (!paper) return {};
  return {
    title: paper.title,
    description: `${paper.venue}, ${paper.year} — distilled: abstract, method, honest results, and retrospective.`,
    // Google Scholar indexing (plan-0006): repeated citation_author tags via
    // the array form; citation_pdf_url only for papers with a curated PDF
    other: {
      citation_title: paper.title,
      citation_author: paper.authors,
      citation_publication_date: String(paper.year),
      ...(paper.kind === "thesis" ? { citation_dissertation_institution: "North South University" } : {}),
      ...(paper.pdf ? { citation_pdf_url: `${SITE_URL}/papers/${paper.slug}.pdf` } : {}),
    },
  };
}

const prose =
  "mt-4 max-w-2xl font-serif leading-relaxed [&>p+p]:mt-4 [&_strong]:text-q0 [&_a]:text-q1 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-q1/50 [&_a:hover]:decoration-q1";

export default async function PaperPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const paper = await getPaper(slug);
  if (!paper) notFound();
  const writeup = paper.related.writeup ? await getDeepDive(paper.related.writeup) : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": paper.kind === "thesis" ? "Thesis" : "ScholarlyArticle",
    headline: paper.title,
    author: paper.authors.map((a) => ({ "@type": "Person", name: a })),
    contributor: paper.supervisor ? { "@type": "Person", name: paper.supervisor } : undefined,
    datePublished: String(paper.year),
    publisher: { "@type": "CollegeOrUniversity", name: "North South University" },
    about: paper.tags,
    url: `${SITE_URL}/research/${paper.slug}`,
    ...(paper.pdf ? { encoding: { "@type": "MediaObject", contentUrl: `${SITE_URL}/papers/${paper.slug}.pdf`, encodingFormat: "application/pdf" } } : {}),
  };

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mt-12">
        <p className="font-mono text-xs text-muted">
          <Link href="/research" className="hover:text-q0">
            research
          </Link>{" "}
          / {paper.slug} · {paper.venue} · {paper.year}
        </p>
        <Vt name={`paper-${paper.slug}`}>
          <h1 className="mt-3 font-serif text-4xl leading-tight">{paper.title}</h1>
        </Vt>
        <p className="mt-3 font-serif text-muted">
          {paper.authors.join(", ")}
          {paper.supervisor ? ` · supervised by ${paper.supervisor}` : ""}
        </p>
        <p className="mt-3 flex flex-wrap gap-1.5">
          {paper.tags.map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </p>

        <div className="mt-6 rounded-sm border rule-hair bg-surface p-5">
          <p className="font-mono text-xs text-muted">Abstract</p>
          <div
            className="mt-2 font-serif leading-relaxed [&_strong]:text-q0"
            dangerouslySetInnerHTML={{ __html: paper.abstractHtml }}
          />
        </div>

        {/* the paper page is the distilled record; the deep-dive is the full story —
            surface it where a reader decides how deep to go */}
        {writeup && (
          <Link
            href={`/deep-dives/${writeup.slug}`}
            className="group mt-4 block rounded-sm border-l-2 border-q1/60 bg-surface/60 px-5 py-4"
          >
            <p className="font-mono text-xs text-muted">
              full writeup · {writeup.readingMinutes} min read
            </p>
            <p className="mt-1 font-serif leading-snug text-ink transition-colors group-hover:text-q1">
              {writeup.title} <span aria-hidden>→</span>
            </p>
          </Link>
        )}

        <p className="mt-4 flex flex-wrap gap-4 font-mono text-sm">
          {paper.pdf ? (
            <a href={`/papers/${paper.slug}.pdf`} className="text-q0 hover:underline">
              [pdf ↓]
            </a>
          ) : (
            <a href={`mailto:${LINKS.email}?subject=Manuscript request: ${encodeURIComponent(paper.title)}`} className="text-muted hover:text-q0">
              [manuscript on request]
            </a>
          )}
          {paper.bibtex && (
            <a href={`/research/${paper.slug}/citation.bib`} className="text-q0 hover:underline">
              [.bib ↓]
            </a>
          )}
          {paper.related.project && (
            <Link href={`/work/${paper.related.project}`} className="text-q1 hover:underline">
              [case study]
            </Link>
          )}
          {paper.related.lesson && (
            <Link href={`/learn#${paper.related.lesson}`} className="text-q1 hover:underline">
              [try the idea live]
            </Link>
          )}
          {writeup && (
            <Link href={`/deep-dives/${writeup.slug}`} className="text-q1 hover:underline">
              [full writeup]
            </Link>
          )}
        </p>
      </header>

      <SectionHeading index={1} title="In plain words" />
      <div className={prose} dangerouslySetInnerHTML={{ __html: paper.plainWordsHtml }} />

      <SectionHeading index={2} title="Method" />
      <div className={prose} dangerouslySetInnerHTML={{ __html: paper.methodHtml }} />

      <SectionHeading index={3} title="Results" />
      <div className={prose} dangerouslySetInnerHTML={{ __html: paper.resultsHtml }} />

      <SectionHeading index={4} title="Looking back" />
      <div className={prose} dangerouslySetInnerHTML={{ __html: paper.lookingBackHtml }} />

      {paper.bibtex && <BibtexBlock entry={paper.bibtex} />}
    </main>
  );
}

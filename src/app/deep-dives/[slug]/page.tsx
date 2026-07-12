import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeepDive, getDeepDiveSeries, getDeepDives, visibleDeepDives } from "@/lib/content/loader";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return visibleDeepDives(await getDeepDives()).map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = await getDeepDive(slug);
  if (!d) return {};
  return { title: d.title, description: d.summary };
}

export default async function ChapterPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const d = await getDeepDive(slug);
  if (!d) notFound();

  const series = d.series ? await getDeepDiveSeries(d.series) : null;
  const chapters = series?.chapters ?? [d];
  const idx = chapters.findIndex((c) => c.slug === slug);
  const prev = idx > 0 ? chapters[idx - 1] : null;
  const next = idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: d.title,
    description: d.summary,
    author: { "@type": "Person", name: "Md. Abu Ammar" },
    datePublished: d.date,
    keywords: d.tags.join(", "),
    isPartOf: series ? { "@type": "CreativeWorkSeries", name: series.title } : undefined,
    url: `${SITE_URL}/deep-dives/${d.slug}`,
  };

  return (
    <main className="mx-auto max-w-3xl px-6 pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mt-12">
        <p className="font-mono text-xs text-muted">
          <Link href="/deep-dives" className="hover:text-q0">
            deep dives
          </Link>
          {series && (
            <>
              {" "}
              / {series.title} · part {d.order} of {chapters.length}
            </>
          )}
        </p>
        <h1 className="mt-4 font-serif text-[2.3rem] leading-[1.1] sm:text-[2.7rem]">{d.title}</h1>
        <p className="mt-4 max-w-2xl font-serif text-lg leading-relaxed text-ink/80">{d.summary}</p>
        <p className="mt-4 font-mono text-xs text-muted">{d.readingMinutes} min read · Md. Abu Ammar</p>
      </header>

      <article
        className="deepdive-prose mt-12"
        dangerouslySetInnerHTML={{ __html: d.bodyHtml }}
      />

      {/* prev / next chapters */}
      {(prev || next) && (
        <nav className="mt-16 grid gap-3 border-t rule-hair pt-6 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/deep-dives/${prev.slug}`}
              className="group rounded-sm border rule-hair bg-surface/40 p-4 hover:border-q0"
            >
              <span className="font-mono text-xs text-muted">← Part {prev.order}</span>
              <span className="mt-1 block font-serif leading-snug group-hover:text-q0">{prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/deep-dives/${next.slug}`}
              className="group rounded-sm border rule-hair bg-surface/40 p-4 text-right hover:border-q0"
            >
              <span className="font-mono text-xs text-muted">Part {next.order} →</span>
              <span className="mt-1 block font-serif leading-snug group-hover:text-q0">{next.title}</span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}

      {/* series table of contents */}
      {series && chapters.length > 1 && (
        <section className="mt-14">
          <p className="font-mono text-xs tracking-widest text-q1 uppercase">{series.title} · all parts</p>
          <ol className="mt-3">
            {chapters.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/deep-dives/${c.slug}`}
                  aria-current={c.slug === slug ? "page" : undefined}
                  className={`flex items-baseline gap-3 border-t rule-hair py-3 font-mono text-sm hover:text-q0 ${
                    c.slug === slug ? "text-ink" : "text-muted"
                  }`}
                >
                  <span className="tabular-nums">{String(c.order).padStart(2, "0")}</span>
                  <span className="flex-1 font-sans">{c.title}</span>
                  {c.slug === slug && <span className="text-q0">·</span>}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}

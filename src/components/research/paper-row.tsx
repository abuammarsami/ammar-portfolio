import Link from "next/link";
import { TagChip } from "@/components/ui/tag-chip";
import type { Paper } from "@/lib/content/schema";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Library listing row for a real paper (ADR-0008) — arXiv register, richer facts. */
export function PaperRow({ paper }: { paper: Paper }) {
  return (
    <article className="entangled border-b rule-hair py-6">
      <p className="font-mono text-xs text-muted">
        <span className="entangled-a text-q0">
          ammar{paper.year}
          {paper.slug.split("-")[0]}
        </span>{" "}
        · {paper.venue} · {paper.year}
      </p>
      {/* h3: rows nest under the page's h2 section headings, like ArxivRow */}
      <h3 className="mt-1 font-serif text-xl">
        <Link href={`/research/${paper.slug}`} className="transition-colors hover:text-q0">
          {paper.title}
        </Link>
      </h3>
      <p className="mt-1 font-serif text-sm text-muted">
        {paper.authors.join(", ")}
        {paper.supervisor ? ` · supervised by ${paper.supervisor}` : ""}
      </p>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {paper.tags.map((t) => (
          <TagChip key={t} label={t} />
        ))}
      </p>
      <details className="group mt-2">
        <summary className="cursor-pointer list-none font-mono text-xs text-muted transition-colors hover:text-q0 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">abstract ▸</span>
          <span className="hidden group-open:inline">abstract ▾</span>
        </summary>
        <p className="mt-2 max-w-2xl font-serif leading-relaxed text-ink">{stripHtml(paper.abstractHtml)}</p>
      </details>
      <p className="mt-2 flex flex-wrap gap-4 font-mono text-xs">
        <Link href={`/research/${paper.slug}`} className="text-q1 hover:underline">
          [read distilled]
        </Link>
        {paper.pdf && (
          <a href={`/papers/${paper.slug}.pdf`} className="text-q0 hover:underline">
            [pdf]
          </a>
        )}
        {paper.related.project && (
          <Link href={`/work/${paper.related.project}`} className="text-q1 hover:underline">
            [case study]
          </Link>
        )}
        {paper.related.lesson && (
          <Link href={`/learn#${paper.related.lesson}`} className="text-q1 hover:underline">
            [try it live]
          </Link>
        )}
      </p>
    </article>
  );
}

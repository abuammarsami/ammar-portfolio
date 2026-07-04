import Link from "next/link";
import { TagChip } from "@/components/ui/tag-chip";

export type ArxivRowProps = {
  id: string; // mono identifier, e.g. "ammar-2022-qml"
  title: string;
  date: string;
  categories: string[]; // e.g. ["quant-ph", "cs.LG"]
  abstract: string; // plain text
  links: { label: string; href: string }[];
};

/** arXiv-style listing row — /research (ADR-0003). Abstract expands via <details>, zero JS. */
export function ArxivRow({ id, title, date, categories, abstract, links }: ArxivRowProps) {
  return (
    <article className="entangled border-b rule-hair py-5">
      <p className="font-mono text-xs text-muted">
        <span className="entangled-a text-q0">{id}</span> · {date}
      </p>
      <h3 className="mt-1 font-serif text-xl">{title}</h3>
      <p className="mt-1.5 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <TagChip key={c} label={c} />
        ))}
      </p>
      <details className="mt-2 group">
        <summary className="cursor-pointer list-none font-mono text-xs text-muted transition-colors hover:text-q0 [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">abstract ▸</span>
          <span className="hidden group-open:inline">abstract ▾</span>
        </summary>
        <p className="mt-2 max-w-2xl font-serif leading-relaxed text-ink">{abstract}</p>
      </details>
      <p className="mt-2 flex gap-4 font-mono text-xs">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="text-q1 hover:underline"
            target={l.href.startsWith("http") ? "_blank" : undefined}
            rel={l.href.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            [{l.label}]
          </Link>
        ))}
      </p>
    </article>
  );
}

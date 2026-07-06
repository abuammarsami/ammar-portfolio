import type { Testimonial } from "@/lib/content/schema";

/** One /about testimonial: serif quote, mono attribution (quotes are parsed from content, never fabricated). */
export function TestimonialCard({ quoteHtml, name, title, company }: Testimonial) {
  return (
    <figure className="rounded-sm border rule-hair bg-surface p-5">
      <blockquote
        className="border-l-2 border-q1/50 pl-4 font-serif leading-relaxed [&>p+p]:mt-3"
        dangerouslySetInnerHTML={{ __html: quoteHtml }}
      />
      <figcaption className="mt-3 font-mono text-xs text-muted">
        — <span className="text-q0">{name}</span>
        {title && ` · ${title}`}
        {company && `, ${company}`}
      </figcaption>
    </figure>
  );
}

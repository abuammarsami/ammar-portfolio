import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionHeading } from "@/components/paper/section-heading";
import { redisPipeline } from "@/lib/agent/guestbook";
import { isPitchSlug, parseStoredPitch, PITCH_KEY_PREFIX, type StoredPitch } from "@/lib/agent/pitch";
import { LINKS } from "@/lib/site";

/**
 * A minted pitch page (ADR-0011): AI-generated, honesty-bannered, unindexed,
 * self-expiring. Every string on this page came through the pitch schema's
 * sanitizers and is rendered as text nodes only — never as HTML.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tailored pitch",
  robots: { index: false, follow: false },
};

async function getPitch(slug: string): Promise<StoredPitch | null> {
  if (!isPitchSlug(slug)) return null;
  const res = await redisPipeline([["GET", `${PITCH_KEY_PREFIX}${slug}`]]);
  const raw = (res?.[0] as { result?: string | null } | undefined)?.result;
  return parseStoredPitch(raw);
}

export default async function PitchPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const pitch = await getPitch(slug);
  if (!pitch) notFound();
  const { company, report } = pitch;
  const generated = new Date(pitch.createdAt).toISOString().slice(0, 10);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <header className="mt-12">
        <p className="font-mono text-xs text-muted">
          <Link href="/" className="hover:text-q0">
            md. abu ammar
          </Link>{" "}
          / pitch · {generated}
        </p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">{report.headline}</h1>

        {/* the honesty banner is not decoration — it is the ADR-0011 contract */}
        <div className="mt-6 rounded-sm border border-q1/40 bg-surface p-4 font-mono text-xs leading-relaxed text-muted">
          AI-generated pitch for <span className="text-q1">{company}</span>, generated {generated} — facts grounded in this
          site&apos;s corpus and cited below. {company} did not request or endorse this page. It expires 90 days after
          creation.
        </div>

        <div className="mt-6 rounded-sm border rule-hair bg-surface p-5">
          <p className="font-mono text-xs text-muted">Summary</p>
          <p className="mt-2 font-serif leading-relaxed">{report.summary}</p>
        </div>
      </header>

      <SectionHeading index={1} title="Why him, for this role" />
      <ul className="mt-4 max-w-2xl space-y-4">
        {report.strengths.map((s, i) => (
          <li key={i} className="font-serif leading-relaxed">
            {s.claim}{" "}
            <span className="font-mono text-xs">
              <Link href={s.path} className="text-q0 hover:underline">
                [{s.path}]
              </Link>{" "}
              <span className={s.strength === "strong" ? "text-q0" : "text-muted"}>· {s.strength}</span>
            </span>
          </li>
        ))}
      </ul>

      <SectionHeading index={2} title="Honest gaps" />
      <ul className="mt-4 max-w-2xl space-y-3">
        {report.gaps.map((g, i) => (
          <li key={i} className="ml-4 list-disc font-serif leading-relaxed">
            {g}
          </li>
        ))}
      </ul>

      <SectionHeading index={3} title="Verdict" />
      <p className="mt-4 max-w-2xl font-serif leading-relaxed">{report.verdict}</p>

      <div className="mt-12 border-t rule-hair pt-6 font-mono text-sm">
        <p className="text-muted">Next step:</p>
        <p className="mt-2 flex flex-wrap gap-4">
          <a href={`mailto:${LINKS.email}`} className="text-q0 hover:underline">
            [email him]
          </a>
          <a href="/resume.pdf" className="text-q0 hover:underline">
            [resume.pdf]
          </a>
          <Link href="/" className="text-q1 hover:underline">
            [see the full portfolio]
          </Link>
          <Link href="/agents" className="text-muted hover:text-ink hover:underline">
            [generate your own pitch]
          </Link>
        </p>
      </div>
    </main>
  );
}

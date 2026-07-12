import type { ReactNode } from "react";
import Link from "next/link";
import { BibtexBlock } from "@/components/paper/bibtex-block";
import { ProjectFigure } from "@/components/ui/project-figure";
import { Reveal } from "@/components/ui/reveal";
import { TagChip } from "@/components/ui/tag-chip";
import { Vt } from "@/components/ui/vt";
import type { CaseStudy, CaseStudyCard, Project } from "@/lib/content/schema";

const PROSE = "font-serif text-[1.02rem] leading-relaxed text-ink/90 [&>p+p]:mt-4 [&_strong]:font-semibold";

/** mono kicker + a hairline rule — the case-study section marker (title is rendered by the sibling Heading) */
function SectionTitle({ kicker }: { kicker: string; title?: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-xs tracking-widest text-q1 uppercase">{kicker}</span>
      <span className="h-px flex-1 rule-hair border-t" />
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h2 className="mt-3 font-serif text-3xl leading-tight">{children}</h2>;
}

/** meta like "chose: X · over: Y" → small pills; a single clause renders as one */
function MetaPills({ meta }: { meta: string }) {
  const parts = meta.split(" · ");
  return (
    <p className="mt-1 flex flex-wrap gap-2">
      {parts.map((p, i) => {
        const [k, ...rest] = p.split(":");
        const hasKey = rest.length > 0;
        return (
          <span
            key={i}
            className="rounded-sm border rule-hair bg-surface px-2 py-0.5 font-mono text-[11px] text-muted"
          >
            {hasKey ? (
              <>
                <span className={i === 0 ? "text-q0" : "text-q1"}>{k}:</span>
                {rest.join(":")}
              </>
            ) : (
              p
            )}
          </span>
        );
      })}
    </p>
  );
}

function prose(html: string, extra = "") {
  return <div className={`${PROSE} ${extra}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function CaseStudyView({
  project,
  caseStudy: cs,
  jsonLd,
}: {
  project: Project;
  caseStudy: CaseStudy;
  jsonLd: object;
}) {
  const fig = (i: number) => project.figures[i];

  return (
    <main className="pb-24">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* ───────────────────────── hero ───────────────────────── */}
      <header className="hero-atmosphere border-b rule-hair">
        <div className="mx-auto max-w-4xl px-6 pt-14 pb-12">
          <p className="enter enter-1 font-mono text-xs text-muted">
            <Link href="/work" className="hover:text-q0">
              work
            </Link>{" "}
            / {project.slug} · engineering case study · {project.date}
          </p>
          <Vt name={`project-${project.slug}`}>
            <h1 className="enter enter-2 mt-4 max-w-3xl font-serif text-[2.6rem] leading-[1.08] sm:text-5xl">
              {project.title}
            </h1>
          </Vt>
          {cs.tagline && (
            <p className="enter enter-3 mt-5 max-w-2xl font-serif text-xl leading-relaxed text-ink/85">
              {cs.tagline}
            </p>
          )}
          {cs.role && (
            <p className="enter enter-3 mt-6 max-w-2xl border-l-2 border-q0 pl-3 font-mono text-[13px] leading-relaxed text-ink/90">
              {cs.role}
            </p>
          )}
          <p className="enter enter-4 mt-6 flex flex-wrap gap-1.5">
            {project.tags.map((t) => (
              <TagChip key={t} label={t} />
            ))}
          </p>
        </div>
      </header>

      {/* ───────────────────────── stat strip ───────────────────────── */}
      {cs.stats.length > 0 && (
        <section className="border-b rule-hair bg-surface/40">
          <Reveal stagger className="mx-auto grid max-w-4xl grid-cols-2 gap-y-8 px-6 py-10 md:grid-cols-4">
            {cs.stats.map((s, i) => (
              <div key={`${s.label}-${i}`} className="pr-5">
                <p className="stat-value text-q0">{s.value}</p>
                <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted">{s.label}</p>
              </div>
            ))}
          </Reveal>
        </section>
      )}

      <div className="mx-auto max-w-4xl px-6">
        {/* ───────────────────────── in one minute ───────────────────────── */}
        <Reveal className="mt-14">
          <div className="rounded-sm border-l-2 border-q0 bg-surface/70 py-5 pr-5 pl-6">
            <p className="font-mono text-xs tracking-widest text-q0 uppercase">In one minute</p>
            <div className="mt-3 max-w-2xl">{prose(cs.inOneMinuteHtml)}</div>
          </div>
        </Reveal>

        {/* ───────────────────────── the problem ───────────────────────── */}
        <section className="mt-16">
          <Reveal>
            <SectionTitle kicker="01" title="The problem" />
            <Heading>Async work wasn&rsquo;t a system — it was scattered habits</Heading>
            <div className="mt-4 max-w-2xl">{prose(cs.problemHtml)}</div>
          </Reveal>
          <Reveal stagger className="mt-8 grid gap-4 md:grid-cols-3">
            {cs.incidents.map((c, i) => (
              <IncidentCard key={`${c.title}-${i}`} card={c} />
            ))}
          </Reveal>
        </section>

        {/* ───────────────────────── the big idea ───────────────────────── */}
        <section className="mt-20">
          <Reveal>
            <SectionTitle kicker="02" title="The idea" />
            <Heading>The engine is the easy part</Heading>
            <div className="mt-4 max-w-2xl">
              {prose(cs.bigIdeaHtml, "[&_strong]:text-q0 [&_strong]:font-serif [&_strong]:text-[1.15em]")}
            </div>
          </Reveal>

          {/* the wrapper capability grid */}
          {cs.capabilities.length > 0 && (
            <Reveal stagger className="entangled mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
              {cs.capabilities.map((cap, i) => (
                <div key={`${cap.name}-${i}`} className="flex gap-3 border-t rule-hair pt-4">
                  <span className="mt-0.5 font-mono text-xs text-muted tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className={`font-mono text-sm ${i % 2 ? "entangled-b" : "entangled-a"}`}>{cap.name}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{cap.body}</p>
                  </div>
                </div>
              ))}
            </Reveal>
          )}
        </section>

        {/* ───────────────────────── how it works ───────────────────────── */}
        <section className="mt-20">
          <Reveal>
            <SectionTitle kicker="03" title="How it works" />
            <Heading>One lean API, one dedicated worker, one durable outbox</Heading>
            <div className="mt-4 max-w-2xl">{prose(cs.howItWorksHtml)}</div>
          </Reveal>
          {fig(0) && (
            <Reveal>
              <ProjectFigure {...fig(0)!} />
            </Reveal>
          )}
        </section>

        {/* ───────────────────────── follow a job ───────────────────────── */}
        {cs.walkthrough.length > 0 && (
          <section className="mt-20">
            <Reveal>
              <SectionTitle kicker="04" title="Follow a job" />
              <Heading>The path that makes a job impossible to lose</Heading>
            </Reveal>
            <Reveal stagger className="mt-8">
              <ol className="relative ml-3 border-l rule-hair">
                {cs.walkthrough.map((c, i) => (
                  <li key={`${c.title}-${i}`} className="relative pb-8 pl-8 last:pb-0">
                    <span className="absolute -left-[13px] flex h-6 w-6 items-center justify-center rounded-full border bg-bg font-mono text-xs text-q0 rule-hair">
                      {i + 1}
                    </span>
                    <p className="font-serif text-lg leading-snug">{c.title}</p>
                    {c.meta && (
                      <span className="mt-1 inline-block rounded-sm border rule-hair bg-surface px-2 py-0.5 font-mono text-[11px] text-q1">
                        {c.meta}
                      </span>
                    )}
                    <div className="mt-2 max-w-2xl text-[0.98rem]">{prose(c.bodyHtml)}</div>
                  </li>
                ))}
              </ol>
            </Reveal>
            {fig(1) && (
              <Reveal>
                <ProjectFigure {...fig(1)!} />
              </Reveal>
            )}
          </section>
        )}

        {/* ───────────────────────── architect decisions ───────────────────────── */}
        {cs.decisions.length > 0 && (
          <section className="mt-20">
            <Reveal>
              <SectionTitle kicker="05" title="Architect decisions" />
              <Heading>Where the real thinking went</Heading>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
                Every one of these had a tempting shortcut. Choosing the harder-but-correct path — and being able
                to say why — is the difference between code that works in a demo and code that survives production.
              </p>
            </Reveal>
            <Reveal stagger className="mt-8 grid gap-4 sm:grid-cols-2">
              {cs.decisions.map((c, i) => (
                <DecisionCard key={`${c.title}-${i}`} card={c} />
              ))}
            </Reveal>
          </section>
        )}

        {/* ───────────────────────── the war story ───────────────────────── */}
        <section className="mt-20">
          <Reveal>
            <div className="rounded-sm border rule-hair bg-surface/60 p-6">
              <p className="font-mono text-xs tracking-widest text-q1 uppercase">The war story · production cutover</p>
              <Heading>Retiring a money-moving job without paying anyone twice</Heading>
              <div className="mt-4 max-w-2xl">
                {prose(cs.warStoryHtml, "[&_strong]:text-q1")}
              </div>
            </div>
          </Reveal>
          {fig(2) && (
            <Reveal>
              <ProjectFigure {...fig(2)!} />
            </Reveal>
          )}
        </section>

        {/* ───────────────────────── impact ───────────────────────── */}
        <section className="mt-20">
          <Reveal>
            <SectionTitle kicker="06" title="Impact" />
            <Heading>A whole class of bugs, gone by construction</Heading>
            <div className="mt-4 max-w-2xl">{prose(cs.impactHtml, "[&_strong]:text-q0")}</div>
          </Reveal>
        </section>

        {/* ───────────────────────── going deeper ───────────────────────── */}
        <section className="mt-20">
          <Reveal>
            <SectionTitle kicker="07" title="Going deeper" />
            <div className="mt-4 max-w-2xl">{prose(cs.goingDeeperHtml)}</div>
          </Reveal>

          <p className="mt-10 border-t rule-hair pt-4 font-mono text-xs leading-relaxed text-muted">
            <span className="text-q1">Stack:</span> {project.techStack}
          </p>
          {project.linksNote && !project.links.github && !project.links.live && (
            <p className="mt-3 font-mono text-sm text-muted">{project.linksNote}</p>
          )}
          <BibtexBlock
            entry={[
              `@misc{ammar2026background,`,
              `  author = {Ammar, Md. Abu},`,
              `  title  = {${project.title}},`,
              `  year   = {${project.date.slice(0, 4)}},`,
              `  note   = {Engineering case study}`,
              `}`,
            ].join("\n")}
          />
        </section>
      </div>
    </main>
  );
}

/** an incident: symptom → cause, with a q-tinted marker */
function IncidentCard({ card }: { card: CaseStudyCard }) {
  return (
    <div className="flex h-full flex-col rounded-sm border-t-2 border-q1/50 bg-surface/50 p-4">
      {card.meta && <p className="font-mono text-[11px] tracking-wide text-q1 uppercase">{card.meta}</p>}
      <p className="mt-2 font-serif text-base leading-snug">{card.title}</p>
      <div className="mt-2 text-sm leading-relaxed text-muted [&_p]:mt-0" dangerouslySetInnerHTML={{ __html: card.bodyHtml }} />
    </div>
  );
}

/** a decision: the choice, the shortcut it rejected, and why */
function DecisionCard({ card }: { card: CaseStudyCard }) {
  return (
    <div className="flex h-full flex-col rounded-sm border rule-hair bg-surface/50 p-5">
      <p className="font-serif text-lg leading-snug">{card.title}</p>
      {card.meta && <MetaPills meta={card.meta} />}
      <div
        className="mt-3 text-sm leading-relaxed text-muted [&>p+p]:mt-3"
        dangerouslySetInnerHTML={{ __html: card.bodyHtml }}
      />
    </div>
  );
}

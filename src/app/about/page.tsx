import type { Metadata } from "next";
import Image from "next/image";
import { getAbout, getExperience, getOptionalHtml, getSkills } from "@/lib/content/loader";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "About",
  description:
    "Software engineer at Masjid Solutions; MS CS student researching quantum machine learning.",
};

export default async function AboutPage() {
  const [about, experience, skills, testimonials] = await Promise.all([
    getAbout(),
    getExperience(),
    getSkills(),
    getOptionalHtml("testimonials.md"),
  ]);

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      {/* ── narrative + photo ── */}
      <section className="mt-12 grid gap-8 md:grid-cols-[1fr_220px]">
        <div>
          <h1 className="font-serif text-4xl">About</h1>
          <div
            className="mt-5 font-serif leading-relaxed [&>p+p]:mt-4"
            dangerouslySetInnerHTML={{ __html: about.narrativeHtml }}
          />
        </div>
        <div>
          <Image
            src="/photo-portrait.jpeg"
            alt="Portrait of Md. Abu Ammar"
            width={220}
            height={260}
            className="rounded-sm border rule-hair object-cover"
            priority
          />
          <p className="mt-2 font-mono text-xs text-muted">Fig. A — the author, Dhaka.</p>
        </div>
      </section>

      {/* ── experience timeline ── */}
      <section className="mt-14 border-t rule-hair pt-10">
        <h2 className="font-serif text-2xl">Experience</h2>
        <div className="mt-6 space-y-10">
          {experience.map((role) => (
            <article key={role.heading} className="entangled">
              <h3 className="entangled-a font-serif text-xl">{role.heading}</h3>
              <p className="entangled-b mt-1 font-mono text-xs text-muted">{role.meta}</p>
              <div
                className="mt-3 leading-relaxed text-muted [&_li+li]:mt-1.5 [&_li]:ml-4 [&_li]:list-['—__'] [&_strong]:text-ink"
                dangerouslySetInnerHTML={{ __html: role.bodyHtml }}
              />
            </article>
          ))}
        </div>
      </section>

      {/* ── skills ── */}
      <section className="mt-14 border-t rule-hair pt-10">
        <h2 className="font-serif text-2xl">Skills</h2>
        <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
          {skills.map((g) => (
            <div key={g.group}>
              <h3 className="font-mono text-sm text-q0">[{g.group}]</h3>
              <div
                className="mt-1.5 text-sm leading-relaxed text-muted"
                dangerouslySetInnerHTML={{ __html: g.bodyHtml }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* ── testimonials (optional) ── */}
      {testimonials && (
        <section className="mt-14 border-t rule-hair pt-10">
          <h2 className="font-serif text-2xl">Testimonials</h2>
          <div
            className="mt-6 font-serif leading-relaxed [&_blockquote]:border-l-2 [&_blockquote]:border-q1/50 [&_blockquote]:pl-4"
            dangerouslySetInnerHTML={{ __html: testimonials }}
          />
        </section>
      )}
    </main>
  );
}

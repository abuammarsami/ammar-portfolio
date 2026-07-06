import type { Metadata } from "next";
import { WaitlistForm } from "@/components/agent/waitlist-form";
import { getColophonPage } from "@/lib/content/loader";
import { collectRepoStats, readBuildStats } from "@/lib/colophon/stats";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Colophon",
  description: "How this site is built: measured bundle sizes, test counts, dependency count, principles — and the template waitlist.",
};

const prose =
  "mt-4 max-w-2xl font-serif leading-relaxed [&>p+p]:mt-4 [&_strong]:text-q0 [&_a]:text-q1 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-q1/50 [&_a:hover]:decoration-q1 [&_li]:ml-4 [&_li]:list-disc [&_li+li]:mt-2";

/**
 * /colophon (plan-0006): the site shows its work. Prose from content;
 * repo facts computed at build time; bundle sizes from the committed
 * build-stats.json with a mandatory measured-at caption (never "live").
 */
export default async function ColophonPage() {
  const sections = await getColophonPage();
  const byHeading = new Map(sections.map((s) => [s.heading, s.bodyHtml]));
  const repo = collectRepoStats();
  const build = readBuildStats();

  const facts: [string, string][] = [
    ["runtime dependencies", String(repo.runtimeDeps)],
    ["test cases", `${repo.testCases} across ${repo.testFiles} files`],
    ["content files (all site copy)", String(repo.contentFiles)],
    ["architecture decision records", String(repo.adrs)],
    ["UI kits / CSS frameworks beyond Tailwind", "0"],
    ["tracking scripts", "0"],
  ];

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <header className="mt-12">
        <p className="font-mono text-xs text-muted">colophon · measured from the repository at build time</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight">How this site is built</h1>
        <div className={prose} dangerouslySetInnerHTML={{ __html: byHeading.get("Intro") ?? "" }} />
      </header>

      <h2 className="mt-10 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">The numbers</h2>
      <dl className="mt-4 max-w-2xl space-y-2 font-mono text-sm">
        {facts.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 border-b rule-hair pb-2">
            <dt className="text-muted">{label}</dt>
            <dd className="text-q0">{value}</dd>
          </div>
        ))}
      </dl>

      {build && (
        <>
          <h2 className="mt-10 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">
            First-load JavaScript, per route
          </h2>
          <div className="mt-4 max-w-2xl space-y-2 font-mono text-sm">
            {build.routes.map((r) => (
              <div key={r.route} className="flex items-center gap-3">
                <span className="w-56 shrink-0 truncate text-muted">{r.route}</span>
                <div className="h-2.5 flex-1 rounded-sm bg-surface">
                  <div
                    className="h-full rounded-sm"
                    style={{ width: `${Math.min(100, (r.gzBytes / r.limitBytes) * 100).toFixed(1)}%`, background: "var(--color-q0)" }}
                  />
                </div>
                <span className="w-28 shrink-0 text-right text-muted">
                  {(r.gzBytes / 1000).toFixed(0)} / {(r.limitBytes / 1000).toFixed(0)} kB gz
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 font-mono text-xs text-muted">
            measured at commit {build.commit} on {build.date} · enforced in CI on every merge · gzipped eager chunks only
          </p>
        </>
      )}

      <h2 className="mt-10 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">Principles</h2>
      <div className={prose} dangerouslySetInnerHTML={{ __html: byHeading.get("Principles") ?? "" }} />

      <h2 id="template" className="mt-10 border-b rule-hair pb-1 font-mono text-sm tracking-wide text-muted uppercase">
        Get this as a template
      </h2>
      <div className={prose} dangerouslySetInnerHTML={{ __html: byHeading.get("Template") ?? "" }} />
      <div className="mt-5">
        <WaitlistForm />
      </div>

      <p className="mt-10 border-t rule-hair pt-4 font-mono text-xs leading-relaxed text-muted">
        Machine-readable:{" "}
        <a href="/colophon.json" className="text-q0 hover:underline">
          /colophon.json
        </a>{" "}
        · the full machine interface lives on{" "}
        <a href="/agents" className="text-q0 hover:underline">
          /agents
        </a>
        .
      </p>
    </main>
  );
}

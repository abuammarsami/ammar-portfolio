import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { parseEvalCases, scoreAnswer, summarize, type EvalCase, type Verdict } from "@/lib/agent/evals";
import { lookupStarterAnswer } from "@/lib/agent/starter-cache";
import { getEvalsContent, getKnownRoutes } from "@/lib/content/loader";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Evals",
  description:
    "A held-out test set for the Ask-Ammar chat agent, graded by a deterministic scorer: groundedness, rubric, and refusal — the evals discipline rendered as a live artifact.",
};

const PROSE =
  "mt-3 max-w-none font-serif leading-relaxed text-ink/90 [&_a]:link-super [&_code]:font-mono [&_code]:text-[0.9em] [&_p+p]:mt-3 [&_strong]:text-ink";

/** A recorded run written by the harness (`npm run evals`), if one is committed. */
type Results = {
  model: string;
  commit: string;
  ranAt: string;
  verdicts: (Verdict & { answer?: string })[];
};

function readResults(): Results | null {
  const abs = path.join(process.cwd(), "content", "eval-results.json");
  if (!fs.existsSync(abs)) return null;
  try {
    return JSON.parse(fs.readFileSync(abs, "utf8")) as Results;
  } catch {
    return null;
  }
}

type Row = {
  c: EvalCase;
  verdict: Verdict | null;
  source: "cached" | "harness" | "pending";
};

function Axis({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={ok ? "text-q0" : "text-q1"}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

export default async function EvalsPage() {
  const content = await getEvalsContent();
  if (!content) return null;

  const cases = parseEvalCases(content.casesRaw);
  const knownRoutes = await getKnownRoutes();
  const results = readResults();
  const byId = new Map((results?.verdicts ?? []).map((v) => [v.id, v]));

  // Build every row's verdict at build time. The four starter questions are
  // graded against the EXACT cached answers the site serves (zero model calls);
  // the rest use the last committed harness run, or show pending (ADR-0019 —
  // never a fabricated pass).
  const rows: Row[] = cases.map((c) => {
    const cached = lookupStarterAnswer(c.question);
    if (cached) return { c, verdict: scoreAnswer(c, cached, knownRoutes), source: "cached" };
    const recorded = byId.get(c.id);
    if (recorded) return { c, verdict: recorded, source: "harness" };
    return { c, verdict: null, source: "pending" };
  });

  const graded = rows.filter((r) => r.verdict).map((r) => r.verdict!);
  const s = summarize(graded);
  const cachedCount = rows.filter((r) => r.source === "cached").length;

  return (
    <main className="mx-auto max-w-3xl px-6 pb-20">
      <h1 className="mt-12 font-serif text-4xl">Evals</h1>
      <div className={PROSE} dangerouslySetInnerHTML={{ __html: content.overviewHtml }} />

      {/* Headline scoreboard — measured, not claimed. */}
      <section className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border rule-hair bg-muted/15 sm:grid-cols-4">
        {[
          { v: `${graded.length}/${cases.length}`, l: "cases graded" },
          { v: `${Math.round(s.passRate * 100)}%`, l: "pass rate" },
          { v: `${s.grounded}/${graded.length || 0}`, l: "grounded" },
          { v: `${cachedCount}`, l: "graded at build" },
        ].map((k) => (
          <div key={k.l} className="bg-bg px-4 py-4">
            <div className="font-mono text-2xl text-q0">{k.v}</div>
            <div className="mt-1 font-mono text-[11px] tracking-wide text-muted uppercase">{k.l}</div>
          </div>
        ))}
      </section>

      {results ? (
        <p className="mt-4 font-mono text-xs text-muted">
          latest harness run: model <span className="text-ink">{results.model}</span> · commit{" "}
          <span className="text-ink">{results.commit.slice(0, 7)}</span> · {results.ranAt.slice(0, 10)}
        </p>
      ) : (
        <p className="mt-4 font-mono text-xs text-muted">
          model-served cases pending a graded run — <code className="text-ink">npm run evals</code> writes the results with
          provenance. The four cached starters below are graded here at build time, live.
        </p>
      )}

      <section className="mt-10">
        <h2 className="font-serif text-2xl">Methodology</h2>
        <div className={PROSE} dangerouslySetInnerHTML={{ __html: content.methodologyHtml }} />
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl">Results</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Eval cases and their graded verdicts</caption>
            <thead>
              <tr className="border-b rule-hair text-left font-mono text-[11px] tracking-wide text-muted uppercase">
                <th className="py-2 pr-3 font-normal">case</th>
                <th className="py-2 pr-3 font-normal">question</th>
                <th className="py-2 pr-3 font-normal">verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, verdict, source }) => (
                <tr key={c.id} className="border-b border-muted/15 align-top">
                  <td className="py-3 pr-3 font-mono text-xs whitespace-nowrap">
                    <span className={c.category === "refusal" ? "text-q1" : "text-q0"}>{c.category}</span>
                    <div className="mt-0.5 text-muted">{c.id}</div>
                  </td>
                  <td className="py-3 pr-3 font-serif text-ink/90">{c.question}</td>
                  <td className="py-3 pr-3">
                    {verdict ? (
                      <div className="font-mono text-xs">
                        <div className={verdict.pass ? "text-q0" : "text-q1"}>
                          {verdict.pass ? "✓ pass" : "✗ fail"}
                          {source === "cached" && <span className="ml-2 text-muted">(cached · build-time)</span>}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                          <Axis ok={verdict.grounded} label="grounded" />
                          <Axis ok={verdict.rubricPass} label="rubric" />
                          {c.category === "refusal" && <Axis ok={verdict.refusalPass} label="refused" />}
                        </div>
                        {verdict.reasons.length > 0 && (
                          <div className="mt-1 text-[11px] text-muted">{verdict.reasons.join("; ")}</div>
                        )}
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-muted">○ pending</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12 border-t rule-hair pt-8">
        <h2 className="font-serif text-2xl">Honesty</h2>
        <div className={PROSE} dangerouslySetInnerHTML={{ __html: content.honestyHtml }} />
        <p className="mt-4 font-mono text-xs text-muted">
          The scorer is open — read it via the chat&apos;s <code className="text-ink">get_source</code> tool
          (slug <span className="text-q0">evals</span>) or on{" "}
          <a href="/agents" className="link-super">
            /agents
          </a>
          .
        </p>
      </section>
    </main>
  );
}

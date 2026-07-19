import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runAgenticChat } from "@/lib/agent/chat-loop";
import { buildChatProfile } from "@/lib/agent/corpus";
import { parseEvalCases, scoreAnswer, summarize } from "@/lib/agent/evals";
import { callTool, TOOLS } from "@/lib/agent/mcp-tools";
import { lookupStarterAnswer } from "@/lib/agent/starter-cache";
import { getEvalsContent, getKnownRoutes } from "@/lib/content/loader";

/**
 * The eval harness (ADR-0019). Opt-in: it hits the live model and writes
 * content/eval-results.json, so it is HARD-GATED on RUN_EVALS + GROQ_API_KEY and
 * is otherwise skipped — plain `npm test` never touches the network. Run it with:
 *
 *   npm run evals            # RUN_EVALS=1 GROQ_API_KEY=… vitest run …
 *
 * It runs each held-out case through the exact production chat pipeline
 * (buildChatProfile + the shared TOOLS + runAgenticChat), grades the answer with
 * the deterministic scorer, and records verdicts with provenance (model, commit,
 * date). Cached starter questions are graded from the served cache — no call.
 */

const HARNESS_TOOLS = TOOLS.filter((t) => t.name !== "get_resume");

function systemPrompt(profile: string): string {
  // mirrors src/app/api/chat/route.ts so the harness grades the real behavior
  return (
    "You are the portfolio agent of Md. Abu Ammar. Answer questions about him using ONLY the profile below and your tools. " +
    "Be concise (2-5 sentences), specific, and cite site paths like /work/kioskvisionai when relevant. " +
    "For paper contents, project details, or lesson content, call the tools instead of guessing. " +
    "If asked HOW this site is built, call list_source then get_source. " +
    "If the answer isn't in the profile or a tool result, say so plainly and suggest emailing him — never invent facts.\n\n" +
    profile
  );
}

const RUN = Boolean(process.env.RUN_EVALS && process.env.GROQ_API_KEY);

describe.skipIf(!RUN)("eval harness (live)", () => {
  it(
    "runs the held-out set through the production pipeline and records verdicts",
    async () => {
      const key = process.env.GROQ_API_KEY!;
      const content = await getEvalsContent();
      expect(content).not.toBeNull();
      const cases = parseEvalCases(content!.casesRaw);
      const knownRoutes = await getKnownRoutes();
      const profile = await buildChatProfile();

      const verdicts = [];
      for (const c of cases) {
        // the served answer for a starter question is the cache; everything else
        // goes to the live model exactly as a visitor's would.
        let answer = lookupStarterAnswer(c.question);
        if (!answer) {
          const result = await runAgenticChat({
            apiKey: key,
            tools: HARNESS_TOOLS,
            callTool,
            messages: [
              { role: "system", content: systemPrompt(profile) },
              { role: "user", content: c.question },
            ],
          });
          if (result.kind === "text") answer = result.text;
          else if (result.kind === "stream") answer = await result.upstream.text();
          else answer = `[error ${result.status}] ${result.message}`;
          await new Promise((r) => setTimeout(r, 2500)); // stay under the free-tier TPM ceiling
        }
        const v = scoreAnswer(c, answer, knownRoutes);
        verdicts.push({ ...v, answer });
        console.log(`${v.pass ? "PASS" : "FAIL"}  ${c.id}  ${v.reasons.join("; ")}`);
      }

      const commit = execFileSync("git", ["rev-parse", "HEAD"]).toString().trim();
      const out = { model: "openai/gpt-oss-120b", commit, ranAt: new Date().toISOString(), summary: summarize(verdicts), verdicts };
      fs.writeFileSync(path.join(process.cwd(), "content", "eval-results.json"), JSON.stringify(out, null, 2) + "\n");
      console.log(`\neval pass rate: ${Math.round(out.summary.passRate * 100)}% (${out.summary.passed}/${out.summary.total})`);
      expect(verdicts.length).toBe(cases.length);
    },
    240_000,
  );
});

// keep the file a valid, non-empty suite when the harness is gated off
describe("eval harness (gate)", () => {
  it("is skipped unless RUN_EVALS and GROQ_API_KEY are set", () => {
    expect(typeof RUN).toBe("boolean");
  });
});

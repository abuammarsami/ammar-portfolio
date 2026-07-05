import { GROQ_MODEL, GROQ_URL } from "@/lib/agent/chat-loop";
import { buildCorpus } from "@/lib/agent/corpus";
import { recordEvent } from "@/lib/agent/guestbook";
import { BRIEF_MAX, BRIEF_MIN, buildFitSystemPrompt, normalizeAudience, validateBrief } from "@/lib/agent/fit-prompt";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// stricter than chat: fit reports are long completions (free-tier protection)
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 600_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > 3;
}

/**
 * The fit report (ADR-0009): paste a job description or research topic,
 * get a grounded, cited, honest fit analysis. Same corpus-in-context +
 * SSE→text pattern as /api/chat; zero dependencies.
 */
export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return new Response(
      "fit engine offline — the site owner hasn't configured GROQ_API_KEY yet. " +
        "Meanwhile: /llms-full.txt has everything, or email abuammarsami@gmail.com",
      { status: 503 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  if (limited(ip)) return new Response("rate limited — 3 reports per 10 minutes; try again later", { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { brief?: unknown; audience?: unknown };
  if (!validateBrief(body.brief)) {
    return new Response(`send { brief: string (${BRIEF_MIN}–${BRIEF_MAX} chars), audience?: "recruiter" | "professor" }`, {
      status: 400,
    });
  }

  void recordEvent({ tool: "fit_report", surface: "fit" }, req.headers.get("user-agent"));

  const corpus = await buildCorpus();
  const upstream = await fetch(GROQ_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      stream: true,
      max_tokens: 1200,
      reasoning_effort: "low",
      messages: [
        { role: "system", content: buildFitSystemPrompt(corpus, normalizeAudience(body.audience)) },
        { role: "user", content: body.brief },
      ],
    }),
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("upstream error — try again shortly", { status: 502 });
  }

  // SSE → plain text stream
  const decoder = new TextDecoder();
  let buf = "";
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const enc = new TextEncoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
          try {
            const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(enc.encode(delta));
          } catch {
            /* partial frame — ignored */
          }
        }
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "content-type": "text/plain; charset=utf-8" } });
}

import { buildCorpus } from "@/lib/agent/corpus";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// naive per-instance rate limit (free-tier protection; resets on cold start)
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > 10;
}

/**
 * "Ask Ammar" — grounded chat (ADR-0007). Whole-corpus-in-context, no RAG.
 * Streams plain text. Zero dependencies: direct fetch to Groq's
 * OpenAI-compatible API; graceful offline message without the key.
 */
export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    return new Response(
      "agent offline — the site owner hasn't configured GROQ_API_KEY yet. " +
        "Meanwhile: /llms-full.txt has everything, or email abuammarsami@gmail.com",
      { status: 503 },
    );
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  if (limited(ip)) return new Response("rate limited — try again in a minute", { status: 429 });

  const { question } = (await req.json().catch(() => ({}))) as { question?: string };
  if (!question || question.length > 500) {
    return new Response("send { question: string } (≤500 chars)", { status: 400 });
  }

  const corpus = await buildCorpus();
  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      stream: true,
      max_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are the portfolio agent of Md. Abu Ammar. Answer questions about him using ONLY the corpus below. " +
            "Be concise (2-5 sentences), specific, and cite site paths like /work/kioskvisionai when relevant. " +
            "If the answer isn't in the corpus, say so plainly and suggest emailing him — never invent facts.\n\n" +
            corpus,
        },
        { role: "user", content: question },
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

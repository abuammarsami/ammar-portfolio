import { createScrubber } from "@/lib/agent/chat-actions";
import { runAgenticChat } from "@/lib/agent/chat-loop";
import { buildChatProfile } from "@/lib/agent/corpus";
import { recordEvent } from "@/lib/agent/guestbook";
import { parseChatBody } from "@/lib/agent/interview";
import { callTool, TOOLS } from "@/lib/agent/mcp-tools";

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

// get_resume is excluded: the whole corpus is already in the system prompt
const CHAT_TOOLS = TOOLS.filter((t) => t.name !== "get_resume");

function systemPrompt(profile: string): string {
  return (
    "You are the portfolio agent of Md. Abu Ammar. Answer questions about him using ONLY the profile below and your tools. " +
    "Be concise (2-5 sentences), specific, and cite site paths like /work/kioskvisionai when relevant. " +
    "The profile is a summary — for paper contents, project details, or lesson content, call " +
    "search_publications/get_paper/list_projects/get_lessons/contact instead of guessing. " +
    "If the answer isn't in the profile or a tool result, say so plainly and suggest emailing him — never invent facts. " +
    "If the visitor asks to see, open, or go to a page, call navigate with the internal path, then answer in one short sentence.\n\n" +
    profile
  );
}

/**
 * "Ask Ammar" — agentic grounded chat (ADR-0007, plan-0005). Compact profile
 * in context plus a function-calling loop over the MCP tool layer for the
 * details; the model can also navigate the visitor's browser via @@action
 * lines (see chat-actions.ts). Streams plain text. Zero dependencies;
 * graceful offline message without the key.
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

  // legacy single-turn {question} or interview-mode {messages} (plan-0006);
  // the system prompt is never accepted from the client
  const parsed = parseChatBody(await req.json().catch(() => ({})));
  if (!parsed) {
    return new Response(
      "send { question: string (≤500 chars) } or { messages: [{role: user|assistant, content}...], surface? }",
      { status: 400 },
    );
  }

  void recordEvent(
    parsed.surface === "interview" ? { tool: "interview", surface: "interview" } : { tool: "ask", surface: "chat" },
    req.headers.get("user-agent"),
  );

  // compact profile, not the full corpus: the prompt rides EVERY hop of the
  // tool loop and the free tier allows 8k tokens/minute (plan-0005)
  const profile = await buildChatProfile();
  const result = await runAgenticChat({
    apiKey: key,
    tools: CHAT_TOOLS,
    callTool,
    messages: [{ role: "system", content: systemPrompt(profile) }, ...parsed.turns],
  });

  if (result.kind === "error") return new Response(result.message, { status: result.status });

  const headers = { "content-type": "text/plain; charset=utf-8" };
  const scrub = createScrubber();

  if (result.kind === "text") {
    return new Response(result.preamble + scrub.push(result.text + "\n") + scrub.flush(), { headers });
  }

  // SSE → plain text stream, action preamble first, model "@@" lines scrubbed
  const decoder = new TextDecoder();
  let buf = "";
  const upstream = result.upstream;
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const enc = new TextEncoder();
      if (result.preamble) controller.enqueue(enc.encode(result.preamble));
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
            if (delta) {
              const out = scrub.push(delta);
              if (out) controller.enqueue(enc.encode(out));
            }
          } catch {
            /* partial frame — ignored */
          }
        }
      }
      const rest = scrub.flush();
      if (rest) controller.enqueue(enc.encode(rest));
      controller.close();
    },
  });
  return new Response(stream, { headers });
}

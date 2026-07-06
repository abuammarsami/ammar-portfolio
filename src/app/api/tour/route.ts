import { GROQ_MODEL, GROQ_URL } from "@/lib/agent/chat-loop";
import { buildChatProfile } from "@/lib/agent/corpus";
import { recordEvent } from "@/lib/agent/guestbook";
import { buildTourSystemPrompt, TOUR_OUTRO, validateInterest, validateTourPlan } from "@/lib/agent/tour-plan";
import { TOUR } from "@/lib/agent/tour-script";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 600_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > 5;
}

const fallback = () => Response.json({ steps: TOUR, fallback: true });

/**
 * Plan a personalized autopilot tour (plan-0006). Contract: this endpoint can
 * NEVER break the demo — any failure (no key, rate limit, upstream error,
 * off-grammar plan) answers 200 with the static tour and `fallback: true`.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { interest?: unknown };
  if (!validateInterest(body.interest)) {
    return new Response("send { interest: string (4–200 chars) }", { status: 400 });
  }

  const key = process.env.GROQ_API_KEY;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  if (!key || limited(ip)) return fallback();

  void recordEvent({ tool: "tour_plan", surface: "autopilot" }, req.headers.get("user-agent"));

  try {
    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        stream: false,
        max_tokens: 700,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: buildTourSystemPrompt(await buildChatProfile()) },
          { role: "user", content: `The visitor wants to see: ${body.interest}` },
        ],
      }),
    });
    if (!upstream.ok) {
      console.error(`[tour] groq upstream ${upstream.status}: ${(await upstream.text().catch(() => "")).slice(0, 300)}`);
      return fallback();
    }
    const data = (await upstream.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    const planned = validateTourPlan(data?.choices?.[0]?.message?.content ?? "");
    if (!planned) {
      console.error("[tour] plan failed validation — serving the static tour");
      return fallback();
    }
    return Response.json({ steps: [...planned, TOUR_OUTRO], fallback: false });
  } catch {
    return fallback();
  }
}

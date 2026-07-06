import { GROQ_MODEL, GROQ_URL } from "@/lib/agent/chat-loop";
import { buildCorpus } from "@/lib/agent/corpus";
import { validateBrief } from "@/lib/agent/fit-prompt";
import { recordEvent, redisPipeline } from "@/lib/agent/guestbook";
import {
  buildPitchSystemPrompt,
  clampCompany,
  parsePitchReport,
  PITCH_DEFAULT_DAILY_CAP,
  PITCH_INDEX_KEY,
  PITCH_KEY_PREFIX,
  PITCH_TTL_SECONDS,
  pitchSlug,
  type StoredPitch,
} from "@/lib/agent/pitch";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// same shape as /api/fit — but pitch mints persistent public pages, so the
// in-memory limiter (per-instance, cold-start-soft) is only the first line
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

/** The real abuse control: a Redis-backed global daily mint cap. */
async function overDailyCap(): Promise<boolean | null> {
  const cap = Number(process.env.PITCH_DAILY_CAP) || PITCH_DEFAULT_DAILY_CAP;
  const day = new Date().toISOString().slice(0, 10);
  const key = `pitch:quota:${day}`;
  const res = await redisPipeline([
    ["INCR", key],
    ["EXPIRE", key, 90_000],
  ]);
  if (!res) return null; // storage unreachable — pitch links need storage
  const n = (res[0] as { result?: number } | undefined)?.result ?? Number.MAX_SAFE_INTEGER;
  return n > cap;
}

/**
 * Mint a tailored pitch page (ADR-0011). The brief is read once, sent to the
 * model, and discarded — never stored, never rendered. Only the validated
 * structured report and the clamped company label persist, under an
 * unguessable slug with a 90-day TTL.
 */
export async function POST(req: Request) {
  const key = process.env.GROQ_API_KEY;
  if (!key) return new Response("pitch engine offline — GROQ_API_KEY not configured", { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  if (limited(ip)) return new Response("rate limited — 3 pitch links per 10 minutes", { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { brief?: unknown; company?: unknown };
  const company = clampCompany(body.company);
  if (!validateBrief(body.brief) || !company) {
    return new Response('send { brief: string (40–4000 chars), company: string (2–64 chars, letters/numbers/" .&-") }', {
      status: 400,
    });
  }

  const cap = await overDailyCap();
  if (cap === null) {
    return new Response("pitch links need storage and it isn't configured — run the fit report on /agents instead", {
      status: 503,
    });
  }
  if (cap) return new Response("today's pitch-link quota is used up — try again tomorrow or run the fit report", { status: 429 });

  const system = buildPitchSystemPrompt(await buildCorpus(), company);
  let report = null;
  for (let attempt = 0; attempt < 2 && !report; attempt++) {
    const upstream = await fetch(GROQ_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: GROQ_MODEL,
        stream: false,
        max_tokens: 900,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: body.brief },
        ],
      }),
    });
    if (!upstream.ok) {
      console.error(`[pitch] groq upstream ${upstream.status}: ${(await upstream.text().catch(() => "")).slice(0, 500)}`);
      if (upstream.status === 429) {
        return new Response("the free-tier model hit its per-minute token limit — try again in ~20 seconds", { status: 429 });
      }
      return new Response(`upstream error (${upstream.status}) — try again shortly`, { status: 502 });
    }
    const data = (await upstream.json().catch(() => null)) as { choices?: { message?: { content?: string } }[] } | null;
    report = parsePitchReport(data?.choices?.[0]?.message?.content ?? "");
  }
  if (!report) {
    console.error("[pitch] model output failed validation twice");
    return new Response("the model couldn't produce a valid pitch for this brief — try the fit report instead", { status: 502 });
  }

  const stored: StoredPitch = { v: 1, company, createdAt: Date.now(), report };
  let slug = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const candidate = pitchSlug(company, crypto.randomUUID().replace(/-/g, "").slice(0, 6));
    const res = await redisPipeline([
      ["SET", `${PITCH_KEY_PREFIX}${candidate}`, JSON.stringify(stored), "EX", PITCH_TTL_SECONDS, "NX"],
    ]);
    if ((res?.[0] as { result?: string | null } | undefined)?.result === "OK") {
      slug = candidate;
      break;
    }
  }
  if (!slug) return new Response("storage hiccup — try again shortly", { status: 502 });

  // owner-facing audit trail: every minted slug, so pages can be found and killed
  void redisPipeline([
    ["LPUSH", PITCH_INDEX_KEY, slug],
    ["LTRIM", PITCH_INDEX_KEY, 0, 499],
  ]);
  void recordEvent({ tool: "pitch_link", surface: "fit" }, req.headers.get("user-agent"));

  return Response.json({ url: `/for/${slug}`, slug, expiresInDays: 90 });
}

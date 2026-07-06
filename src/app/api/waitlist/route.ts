import { redisPipeline } from "@/lib/agent/guestbook";

export const dynamic = "force-dynamic";

/**
 * Template waitlist (plan-0006). Privacy contract (ADR-0011 note): emails
 * are PII in the shared Redis — write-only from the site's perspective. No
 * route or tool may ever enumerate or render `waitlist:emails`; the owner
 * reads it in the Upstash console for the one launch email, then deletes it.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  if (hits.size > 500) for (const [k, v] of hits) if (now - v.t > 600_000) hits.delete(k); // bound the map
  const h = hits.get(ip);
  if (!h || now - h.t > 600_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > 3;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  if (limited(ip)) return new Response("rate limited — try again later", { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { email?: unknown };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 254) {
    return new Response("send { email: string } — a real address", { status: 400 });
  }

  // SADD = dedupe for free; double-signups are silently idempotent
  const res = await redisPipeline([["SADD", "waitlist:emails", email]]);
  if (!res) {
    return new Response("waitlist storage is offline — email abuammarsami@gmail.com with subject 'template' instead", {
      status: 503,
    });
  }
  return new Response(null, { status: 204 });
}

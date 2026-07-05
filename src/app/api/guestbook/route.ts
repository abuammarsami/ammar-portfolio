import { readEvents } from "@/lib/agent/guestbook";

export const dynamic = "force-dynamic";

/** The guestbook feed (ADR-0010) — last 50 agent interactions, CDN-cached. */
export async function GET() {
  const events = await readEvents(50);
  return Response.json(
    { events },
    { headers: { "cache-control": "s-maxage=60, stale-while-revalidate=300" } },
  );
}

import { isValidEvent, recordEvent, type GuestbookSurface } from "@/lib/agent/guestbook";

export const dynamic = "force-dynamic";

// beacons are cheap but spammable — tighter than chat (ADR-0010)
const hits = new Map<string, { n: number; t: number }>();
function limited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > 5;
}

/**
 * Client-side guestbook beacon (ADR-0010) for events only the browser sees:
 * WebMCP tool executions and autopilot runs. Hard allowlist on tool + surface;
 * only client-originating surfaces are accepted (server routes log directly).
 */
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "anon";
  if (limited(ip)) return new Response(null, { status: 429 });

  const body = (await req.json().catch(() => ({}))) as { tool?: unknown; surface?: unknown };
  const clientSurfaces: GuestbookSurface[] = ["webmcp", "autopilot"];
  if (!isValidEvent(body.tool, body.surface) || !clientSurfaces.includes(body.surface as GuestbookSurface)) {
    return new Response(`send { tool, surface: ${clientSurfaces.join(" | ")} } from the allowlist`, { status: 400 });
  }

  void recordEvent({ tool: body.tool as string, surface: body.surface as GuestbookSurface }, req.headers.get("user-agent"));
  return new Response(null, { status: 204 });
}

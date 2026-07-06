/**
 * The agent guestbook (ADR-0010): a rolling log of agent interactions across
 * every surface, rendered as the "agents were here" wall on /agents.
 *
 * Storage is Upstash Redis over its plain REST API — one fetch, no SDK, so
 * rule 3 ("no new runtime dependency") holds literally. Env-gated: without
 * UPSTASH_REDIS_REST_URL/TOKEN every call is a silent no-op.
 *
 * Privacy posture (hard rules): tool NAMES only, never arguments (briefs and
 * questions are user content); no IPs; the User-Agent is reduced to a coarse
 * client label server-side and the raw string discarded.
 */

export const GUESTBOOK_SURFACES = ["mcp", "webmcp", "fit", "chat", "autopilot"] as const;
export type GuestbookSurface = (typeof GUESTBOOK_SURFACES)[number];

export type GuestbookEvent = {
  tool: string;
  surface: GuestbookSurface;
  client: string;
  /** epoch ms */
  t: number;
};

/**
 * Every recordable tool name across the MCP layer, the WebMCP registry, the
 * chat/fit pseudo-tools, and the autopilot. A unit test cross-checks this
 * against the live TOOLS/createWebmcpTools registries to prevent drift.
 */
export const GUESTBOOK_TOOLS = new Set([
  // MCP (mcp-tools.ts)
  "get_resume", "list_projects", "search_publications", "get_paper", "get_lessons", "contact",
  // WebMCP (webmcp-tools.ts)
  "query_portfolio", "get_resume_summary", "navigate_to", "download_resume", "run_quantum_demo", "set_lens",
  // chat loop pseudo-tool + surface-level acts
  "navigate", "ask", "fit_report", "autopilot", "pitch_link",
]);

const KEY = "guestbook";
const MAX_EVENTS = 200;

export function isValidEvent(tool: unknown, surface: unknown): boolean {
  return typeof tool === "string" && GUESTBOOK_TOOLS.has(tool) && GUESTBOOK_SURFACES.includes(surface as GuestbookSurface);
}

/** Reduce a User-Agent to a coarse client family; the raw UA is never stored. */
export function coarseClient(ua: string | null | undefined): string {
  const s = (ua ?? "").toLowerCase();
  if (!s) return "unknown";
  if (s.includes("claude")) return "claude";
  if (s.includes("chatgpt") || s.includes("openai")) return "chatgpt";
  if (s.includes("gemini") || s.includes("google-ai")) return "gemini";
  if (s.includes("perplexity")) return "perplexity";
  if (s.includes("curl") || s.includes("wget") || s.includes("python") || s.includes("node")) return "script";
  if (s.includes("mozilla")) return "browser";
  return "agent";
}

function upstash(): { url: string; token: string } | null {
  // Vercel's Upstash integration injects either the UPSTASH_* names or the
  // legacy KV_* aliases depending on how the store was connected — take both.
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

/**
 * One Upstash REST pipeline call. Shared by every feature that persists
 * (guestbook, pitch links, waitlist) so raw-REST stays in exactly one place.
 * Returns null when unconfigured or on any HTTP failure.
 */
export async function redisPipeline(commands: (string | number)[][], fetchFn: typeof fetch = fetch): Promise<unknown[] | null> {
  const cfg = upstash();
  if (!cfg) return null;
  const res = await fetchFn(`${cfg.url}/pipeline`, {
    method: "POST",
    headers: { authorization: `Bearer ${cfg.token}`, "content-type": "application/json" },
    body: JSON.stringify(commands),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as unknown[];
}

/**
 * Append one event. Never throws and never blocks the caller's response —
 * logging must not be able to break chat/fit/mcp. Invalid events are dropped.
 */
export async function recordEvent(
  e: { tool: string; surface: GuestbookSurface },
  ua: string | null | undefined,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  try {
    if (!isValidEvent(e.tool, e.surface)) return;
    const evt: GuestbookEvent = { tool: e.tool, surface: e.surface, client: coarseClient(ua), t: Date.now() };
    await redisPipeline(
      [
        ["LPUSH", KEY, JSON.stringify(evt)],
        ["LTRIM", KEY, 0, MAX_EVENTS - 1],
      ],
      fetchFn,
    );
  } catch {
    /* storage down or unreachable — the guestbook silently misses a line */
  }
}

/** Last n events, newest first. Empty when unconfigured or unreachable. */
export async function readEvents(n = 50, fetchFn: typeof fetch = fetch): Promise<GuestbookEvent[]> {
  try {
    const res = await redisPipeline([["LRANGE", KEY, 0, Math.max(0, n - 1)]], fetchFn);
    const raw = (res?.[0] as { result?: string[] } | undefined)?.result ?? [];
    const events: GuestbookEvent[] = [];
    for (const item of raw) {
      try {
        const e = JSON.parse(item) as GuestbookEvent;
        if (isValidEvent(e.tool, e.surface) && typeof e.t === "number") {
          events.push({ tool: e.tool, surface: e.surface, client: String(e.client).slice(0, 24), t: e.t });
        }
      } catch {
        /* malformed entry — skipped */
      }
    }
    return events;
  } catch {
    return [];
  }
}

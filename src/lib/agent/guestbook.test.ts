import { afterEach, describe, expect, it, vi } from "vitest";

import { coarseClient, GUESTBOOK_TOOLS, isValidEvent, readEvents, recordEvent } from "./guestbook";
import { TOOLS } from "./mcp-tools";
import { createWebmcpTools } from "./webmcp-tools";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GUESTBOOK_TOOLS allowlist", () => {
  it("covers every MCP and WebMCP tool name (drift guard)", () => {
    const webmcp = createWebmcpTools({
      navigate: () => {},
      download: () => {},
      fetchText: async () => "",
      mcpCall: async () => "",
      setLens: () => {},
    }).map((t) => t.name);
    for (const t of TOOLS.map((t) => t.name)) expect(GUESTBOOK_TOOLS.has(t), `MCP tool ${t}`).toBe(true);
    for (const t of webmcp) expect(GUESTBOOK_TOOLS.has(t), `WebMCP tool ${t}`).toBe(true);
  });

  it("validates tool+surface pairs and rejects junk", () => {
    expect(isValidEvent("get_paper", "mcp")).toBe(true);
    expect(isValidEvent("autopilot", "autopilot")).toBe(true);
    expect(isValidEvent("rm -rf", "mcp")).toBe(false);
    expect(isValidEvent("get_paper", "email")).toBe(false);
    expect(isValidEvent(undefined, "mcp")).toBe(false);
  });
});

describe("coarseClient", () => {
  it("reduces UAs to coarse families and never echoes the raw string", () => {
    expect(coarseClient("Claude-User/1.0 (+claude.ai)")).toBe("claude");
    expect(coarseClient("Mozilla/5.0 (Macintosh) Chrome/149")).toBe("browser");
    expect(coarseClient("curl/8.6.0")).toBe("script");
    expect(coarseClient("python-httpx/0.27")).toBe("script");
    expect(coarseClient("SomeAgentFramework/2.0")).toBe("agent");
    expect(coarseClient(null)).toBe("unknown");
  });
});

describe("recordEvent / readEvents", () => {
  it("no-ops silently without env configuration", async () => {
    const fetchFn = vi.fn();
    await recordEvent({ tool: "ask", surface: "chat" }, "curl/8", fetchFn as unknown as typeof fetch);
    expect(await readEvents(10, fetchFn as unknown as typeof fetch)).toEqual([]);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("pipelines LPUSH+LTRIM with name-only payloads when configured", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const fetchFn = vi.fn(async () => new Response("[]", { status: 200 }));
    await recordEvent({ tool: "get_paper", surface: "mcp" }, "Claude-User/1.0", fetchFn as unknown as typeof fetch);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("https://fake.upstash.io/pipeline");
    const cmds = JSON.parse(String(init.body)) as [string, string, string][];
    expect(cmds[0]![0]).toBe("LPUSH");
    expect(cmds[1]![0]).toBe("LTRIM");
    const stored = JSON.parse(cmds[0]![2]) as Record<string, unknown>;
    expect(stored).toMatchObject({ tool: "get_paper", surface: "mcp", client: "claude" });
    expect(JSON.stringify(stored)).not.toContain("Claude-User"); // raw UA never stored
  });

  it("drops disallowed events before any network call", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const fetchFn = vi.fn();
    await recordEvent({ tool: "evil_tool", surface: "mcp" }, null, fetchFn as unknown as typeof fetch);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("parses LRANGE results and skips malformed entries", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const rows = [
      JSON.stringify({ tool: "ask", surface: "chat", client: "browser", t: 1_700_000_000_000 }),
      "{broken",
      JSON.stringify({ tool: "not_allowed", surface: "chat", client: "x", t: 1 }),
    ];
    const fetchFn = vi.fn(async () => new Response(JSON.stringify([{ result: rows }]), { status: 200 }));
    const events = await readEvents(10, fetchFn as unknown as typeof fetch);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ tool: "ask", client: "browser" });
  });

  it("never throws when storage is down", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
    const fetchFn = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(recordEvent({ tool: "ask", surface: "chat" }, null, fetchFn as unknown as typeof fetch)).resolves.toBeUndefined();
    await expect(readEvents(5, fetchFn as unknown as typeof fetch)).resolves.toEqual([]);
  });
});

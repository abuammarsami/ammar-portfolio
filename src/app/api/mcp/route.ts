import { recordEvent } from "@/lib/agent/guestbook";
import { callTool, TOOLS } from "@/lib/agent/mcp-tools";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Hand-rolled MCP server (streamable HTTP, JSON-RPC 2.0) — ADR-0007.
 * "My CV is an MCP server." Stateless tools over static content; no SDK.
 * Tool definitions live in @/lib/agent/mcp-tools (shared with /agents + agent card).
 */

type RpcRequest = { jsonrpc: "2.0"; id?: number | string | null; method: string; params?: Record<string, unknown> };

// batches share one logger so a request writes at most once per tool name
type RequestLog = { logged: Set<string>; ua: string | null };

async function handle(rpc: RpcRequest, log: RequestLog) {
  const { id = null, method, params = {} } = rpc;
  const ok = (result: unknown) => ({ jsonrpc: "2.0" as const, id, result });
  switch (method) {
    case "initialize":
      return ok({
        protocolVersion: (params.protocolVersion as string) ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "ammar-portfolio", version: "1.0.0", title: "Md. Abu Ammar — CV as an MCP server" },
      });
    case "notifications/initialized":
      return null; // notification — no response
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: TOOLS });
    case "tools/call": {
      try {
        // guestbook logs the tool NAME only — never arguments (ADR-0010)
        const tool = String(params.name);
        if (!log.logged.has(tool)) {
          log.logged.add(tool);
          void recordEvent({ tool, surface: "mcp" }, log.ua);
        }
        const text = await callTool(tool, (params.arguments as Record<string, unknown>) ?? {});
        return ok({ content: [{ type: "text", text }] });
      } catch (e) {
        return ok({ content: [{ type: "text", text: String(e) }], isError: true });
      }
    }
    default:
      return { jsonrpc: "2.0" as const, id, error: { code: -32601, message: `method not found: ${method}` } };
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as RpcRequest | RpcRequest[] | null;
  if (!body) {
    return Response.json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }, { status: 400 });
  }
  // JSON-RPC batches are legal but unauthenticated — cap the fan-out so one
  // request can't amplify into thousands of tool executions + store writes
  if (Array.isArray(body) && body.length > 20) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "batch too large (max 20)" } },
      { status: 400 },
    );
  }
  const log: RequestLog = { logged: new Set(), ua: req.headers.get("user-agent") };
  const responses = await Promise.all((Array.isArray(body) ? body : [body]).map((r) => handle(r, log)));
  const nonNull = responses.filter((r) => r !== null);
  if (nonNull.length === 0) return new Response(null, { status: 202 });
  return Response.json(Array.isArray(body) ? nonNull : nonNull[0]);
}

export async function GET() {
  return Response.json({
    name: "ammar-portfolio MCP server",
    transport: "streamable-http (POST JSON-RPC 2.0 to this URL)",
    tools: TOOLS.map((t) => t.name),
    docs: `${SITE_URL}/llms.txt`,
    agentCard: `${SITE_URL}/.well-known/agent-card.json`,
    webmcp: `${SITE_URL}/agents`,
  });
}

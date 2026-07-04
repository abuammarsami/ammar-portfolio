import { buildCorpus } from "@/lib/agent/corpus";
import { getLessons, getProjects, visibleProjects } from "@/lib/content/loader";
import { LINKS, SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Hand-rolled MCP server (streamable HTTP, JSON-RPC 2.0) — ADR-0007.
 * "My CV is an MCP server." Stateless tools over static content; no SDK.
 */

const TOOLS = [
  { name: "get_resume", description: "Md. Abu Ammar's full resume/corpus as plain text.", inputSchema: { type: "object", properties: {} } },
  { name: "list_projects", description: "All projects/case studies with summaries, categories, and links.", inputSchema: { type: "object", properties: {} } },
  { name: "search_publications", description: "Search research work by keyword.", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
  { name: "get_lessons", description: "The /learn interactive quantum curriculum outline.", inputSchema: { type: "object", properties: {} } },
  { name: "contact", description: "How to contact Md. Abu Ammar.", inputSchema: { type: "object", properties: {} } },
] as const;

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  switch (name) {
    case "get_resume":
      return buildCorpus();
    case "list_projects": {
      const projects = visibleProjects(await getProjects());
      return JSON.stringify(
        projects.map((p) => ({
          title: p.title, category: p.category, date: p.date, summary: p.summary,
          tags: p.tags, url: `${SITE_URL}/work/${p.slug}`, github: p.links.github,
        })), null, 2,
      );
    }
    case "search_publications": {
      const q = String(args.query ?? "").toLowerCase();
      const research = visibleProjects(await getProjects()).filter((p) => p.category === "research");
      const hits = research.filter((p) =>
        [p.title, p.summary, p.tags.join(" ")].join(" ").toLowerCase().includes(q),
      );
      return JSON.stringify(hits.map((p) => ({ title: p.title, summary: p.summary, url: `${SITE_URL}/work/${p.slug}` })), null, 2);
    }
    case "get_lessons": {
      const lessons = await getLessons();
      return JSON.stringify(lessons.map((l) => ({ order: l.order, title: l.title, url: `${SITE_URL}/learn#${l.slug}` })), null, 2);
    }
    case "contact":
      return JSON.stringify({ email: LINKS.email, github: LINKS.github, linkedin: LINKS.linkedin, site: SITE_URL });
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

type RpcRequest = { jsonrpc: "2.0"; id?: number | string | null; method: string; params?: Record<string, unknown> };

async function handle(rpc: RpcRequest) {
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
        const text = await callTool(String(params.name), (params.arguments as Record<string, unknown>) ?? {});
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
  const responses = await Promise.all((Array.isArray(body) ? body : [body]).map(handle));
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
  });
}

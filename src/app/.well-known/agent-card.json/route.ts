import { TOOLS } from "@/lib/agent/mcp-tools";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-static";

/**
 * A2A-style agent card (ADR-0009) — discovery paperwork for the agentic web.
 * Skills are generated from the shared MCP tool layer so this can never
 * drift from the code. The description states honestly that the interface
 * speaks MCP JSON-RPC; this is not a full A2A task server.
 */
export async function GET() {
  const card = {
    name: "Md. Abu Ammar — portfolio agent",
    description:
      "The personal site of Md. Abu Ammar (backend .NET/Azure + AI/ML engineer, quantum ML researcher), exposed as a set of tools. " +
      "Honest fine print: the interface below speaks Model Context Protocol JSON-RPC 2.0, published here for discovery — this is not a full A2A message/send server.",
    version: "1.0.0",
    protocolVersion: "1.0",
    provider: { organization: "Md. Abu Ammar", url: SITE_URL },
    documentationUrl: `${SITE_URL}/agents`,
    supportedInterfaces: [{ url: `${SITE_URL}/api/mcp`, protocolBinding: "JSONRPC", protocolVersion: "2025-06-18" }],
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    defaultInputModes: ["application/json", "text/plain"],
    defaultOutputModes: ["application/json", "text/plain"],
    skills: [
      ...TOOLS.map((t) => ({
        id: t.name,
        name: t.name.replace(/_/g, " "),
        description: t.description,
        tags: ["portfolio", "resume", "research"],
      })),
      {
        id: "fit_report",
        name: "fit report",
        description:
          `POST ${SITE_URL}/api/fit with { brief, audience? } — streams a grounded fit analysis of a job description ` +
          "or research topic against his real work, honest gaps included.",
        tags: ["portfolio", "hiring", "fit"],
      },
    ],
    securitySchemes: {},
  };
  return Response.json(card, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}

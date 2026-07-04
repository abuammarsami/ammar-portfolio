import type { Metadata } from "next";
import { FitReport } from "@/components/agent/fit-report";
import { TOOLS } from "@/lib/agent/mcp-tools";
import { createWebmcpTools } from "@/lib/agent/webmcp-tools";
import { getAgentsPage } from "@/lib/content/loader";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Agents",
  description:
    "The machine interface: MCP server, WebMCP browser tools (Chrome origin trial), llms.txt feeds, an A2A agent card, and an honest fit report.",
};

/** Descriptors only — noop deps; the real handlers mount client-side via the provider. */
const WEBMCP_TOOLS = createWebmcpTools({
  navigate: () => {},
  download: () => {},
  fetchText: async () => "",
  mcpCall: async () => "",
}).map((t) => ({ name: t.name, description: t.description }));

function ToolTable({ tools, caption }: { tools: readonly { name: string; description: string }[]; caption: string }) {
  return (
    <figure className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <tbody>
          {tools.map((t) => (
            <tr key={t.name} className="border-t border-muted/20">
              <td className="py-2 pr-4 align-top font-mono whitespace-nowrap text-q0">{t.name}</td>
              <td className="py-2 text-muted">{t.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

export default async function AgentsPage() {
  const sections = await getAgentsPage();
  const tagline = sections.find((s) => s.heading === "Tagline");
  const rest = sections.filter((s) => s.heading !== "Tagline");

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <h1 className="mt-12 font-serif text-4xl">Agents</h1>
      {tagline && (
        <div
          className="mt-2 font-mono text-sm text-muted [&_p]:m-0"
          dangerouslySetInnerHTML={{ __html: tagline.bodyHtml }}
        />
      )}

      {rest.map((s) => (
        <section key={s.heading} id={s.heading === "Fit report" ? "fit" : undefined} className="mt-12">
          <h2 className="font-serif text-2xl">{s.heading}</h2>
          <div
            className="mt-3 max-w-none font-serif leading-relaxed [&_a]:link-super [&_code]:font-mono [&_code]:text-[0.9em] [&_p+p]:mt-3 [&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-muted/20 [&_pre]:bg-surface/60 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: s.bodyHtml }}
          />
          {s.heading === "MCP server" && <ToolTable tools={TOOLS} caption="MCP tools" />}
          {s.heading === "WebMCP tools" && <ToolTable tools={WEBMCP_TOOLS} caption="WebMCP tools" />}
          {s.heading === "Fit report" && (
            <div className="mt-6">
              <FitReport placeholder="Paste a job description or a research topic — e.g. 'Senior backend engineer: .NET, Azure, event-driven systems, payment infrastructure…'" />
            </div>
          )}
        </section>
      ))}
    </main>
  );
}

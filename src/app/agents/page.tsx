import type { Metadata } from "next";
import { AutopilotButton } from "@/components/agent/autopilot-button";
import { FitReport } from "@/components/agent/fit-report";
import { GuestbookWall } from "@/components/agent/guestbook-wall";
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
  setLens: () => {},
}).map((t) => ({ name: t.name, description: t.description }));

const PROSE_CLASS =
  "mt-3 max-w-none font-serif leading-relaxed [&_a]:link-super [&_code]:font-mono [&_code]:text-[0.9em] [&_p+p]:mt-3 [&_pre]:mt-4 [&_pre]:overflow-x-auto [&_pre]:border [&_pre]:border-muted/20 [&_pre]:bg-surface/60 [&_pre]:p-4 [&_pre]:font-mono [&_pre]:text-xs [&_pre]:leading-relaxed";

/** Reference sections fold away so the page has one focus: the fit report. */
const FOLDED = ["MCP server", "WebMCP tools", "Agent card", "Why agent-native", "How to interview this site"] as const;

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
  const byHeading = new Map(sections.map((s) => [s.heading, s]));
  const tagline = byHeading.get("Tagline");
  const fit = byHeading.get("Fit report");
  const feeds = byHeading.get("Feeds");
  const guestbook = byHeading.get("Guestbook");

  return (
    <main className="mx-auto max-w-3xl px-6 pb-16">
      <h1 className="mt-12 font-serif text-4xl">Agents</h1>
      {tagline && (
        <div
          className="mt-2 font-mono text-sm text-muted [&_p]:m-0"
          dangerouslySetInnerHTML={{ __html: tagline.bodyHtml }}
        />
      )}
      <AutopilotButton />

      {/* The one interactive thing on this page — everything else is reference. */}
      {fit && (
        <section id="fit" className="mt-12">
          <h2 className="font-serif text-2xl">{fit.heading}</h2>
          <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: fit.bodyHtml }} />
          <div className="mt-6">
            <FitReport placeholder="Paste a job description or a research topic — e.g. 'Senior backend engineer: .NET, Azure, event-driven systems, payment infrastructure…'" />
          </div>
        </section>
      )}

      {/* Connect: the four URLs an agent needs, nothing else. */}
      {feeds && (
        <section className="mt-14">
          <h2 className="font-serif text-2xl">Connect</h2>
          <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: feeds.bodyHtml }} />
        </section>
      )}

      {/* Reference: folded — open what you came for. */}
      <section className="mt-14" aria-label="Protocol reference">
        <h2 className="font-serif text-2xl">Under the hood</h2>
        {FOLDED.map((heading) => {
          const s = byHeading.get(heading);
          if (!s) return null;
          return (
            <details key={heading} className="group mt-4 border-b rule-hair pb-4">
              <summary className="cursor-pointer list-none font-mono text-sm text-muted transition-colors hover:text-q0 [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="mr-2 inline-block transition-transform group-open:rotate-90">
                  ▸
                </span>
                {heading}
              </summary>
              <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: s.bodyHtml }} />
              {heading === "MCP server" && <ToolTable tools={TOOLS} caption="MCP tools" />}
              {heading === "WebMCP tools" && <ToolTable tools={WEBMCP_TOOLS} caption="WebMCP tools" />}
            </details>
          );
        })}
      </section>

      {guestbook && (
        <section className="mt-14">
          <h2 className="font-serif text-2xl">{guestbook.heading}</h2>
          <div className={PROSE_CLASS} dangerouslySetInnerHTML={{ __html: guestbook.bodyHtml }} />
          <GuestbookWall />
        </section>
      )}
    </main>
  );
}

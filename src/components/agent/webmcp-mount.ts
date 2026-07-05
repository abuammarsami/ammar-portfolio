import { applyLens } from "@/lib/agent/lens";
import { createWebmcpTools } from "@/lib/agent/webmcp-tools";

/**
 * The WebMCP mount body — lazy-loaded by webmcp-provider.tsx so the origin-trial
 * token and registration logic never sit in the eager first-load bundle
 * (ADR-0009; WebMCP is origin-trial API, "subject to change" — keep all
 * knowledge of it in this module + the thin provider).
 */

type ModelContext = {
  registerTool?: (tool: object, opts?: { signal?: AbortSignal }) => Promise<void>;
  provideContext?: (ctx: { tools: object[] }) => void;
};

function modelContext(): ModelContext | undefined {
  // Chrome 150+ moved the API from navigator to document; detect both
  return (
    (document as Document & { modelContext?: ModelContext }).modelContext ??
    (navigator as Navigator & { modelContext?: ModelContext }).modelContext
  );
}

/** Third-party OT tokens are ignored in headers — Chrome requires script-injected meta. */
function injectOriginTrialToken(): void {
  const token = process.env.NEXT_PUBLIC_WEBMCP_ORIGIN_TRIAL_TOKEN;
  if (!token || document.querySelector('meta[http-equiv="origin-trial"]')) return;
  const meta = document.createElement("meta");
  meta.httpEquiv = "origin-trial";
  meta.content = token;
  document.head.appendChild(meta);
}

export async function mount(navigate: (path: string) => void, signal: AbortSignal): Promise<void> {
  injectOriginTrialToken();

  // the interface may install shortly after runtime token validation
  let mc = modelContext();
  for (let i = 0; !mc && i < 4; i++) {
    await new Promise((r) => setTimeout(r, 250));
    if (signal.aborted) return;
    mc = modelContext();
  }
  if (!mc || (!mc.registerTool && !mc.provideContext)) return;
  if (signal.aborted) return;

  const tools = createWebmcpTools({
    navigate,
    download: (path) => window.location.assign(path),
    setLens: applyLens,
    fetchText: (url) => fetch(url).then((r) => r.text()),
    mcpCall: async (tool, args) => {
      const res = await fetch("/api/mcp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: tool, arguments: args } }),
      });
      const rpc = (await res.json()) as { result?: { content?: { text?: string }[] } };
      return rpc.result?.content?.[0]?.text ?? "";
    },
  });

  // guestbook beacon — tool name only, fire-and-forget (ADR-0010)
  const report = (tool: string) =>
    void fetch("/api/beacon", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool, surface: "webmcp" }),
    }).catch(() => {});
  for (const t of tools) {
    const inner = t.execute.bind(t);
    t.execute = (input) => {
      report(t.name);
      return inner(input);
    };
  }

  if (mc.registerTool) {
    for (const t of tools) {
      // Chrome 149 returns undefined, 150+ a promise — and one bad tool must not kill the rest
      try {
        await mc.registerTool(t, { signal });
      } catch {
        /* rejected or invalid descriptor — skip */
      }
    }
  } else {
    mc.provideContext?.({ tools });
  }
}

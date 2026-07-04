"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Mounts the WebMCP tool registry when the browser exposes a model context
 * (Chrome 149+ origin trial — ADR-0009). Renders nothing; hard no-op
 * everywhere else. The tool definitions live in the pure lazy-loaded module
 * so non-supporting browsers never download them.
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

export function WebmcpProvider() {
  const router = useRouter();

  useEffect(() => {
    const mc = modelContext();
    if (!mc || (!mc.registerTool && !mc.provideContext)) return;
    const ac = new AbortController();

    void (async () => {
      const { createWebmcpTools } = await import("@/lib/agent/webmcp-tools");
      if (ac.signal.aborted) return;
      const tools = createWebmcpTools({
        navigate: (path) => router.push(path),
        download: (path) => window.location.assign(path),
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
      if (mc.registerTool) {
        for (const t of tools) await mc.registerTool(t, { signal: ac.signal }).catch(() => {});
      } else {
        mc.provideContext?.({ tools });
      }
    })();

    return () => ac.abort();
  }, [router]);

  return null;
}

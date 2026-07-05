import { frameAction, isInternalPath } from "@/lib/agent/chat-actions";

/**
 * The agentic chat loop (plan-0005). Pure and dependency-injected: the model
 * runs an OpenAI-style function-calling loop over the MCP tool layer, with
 * hops non-streamed (streamed tool_call deltas arrive fragmented — fragile to
 * hand-merge) and only the final answer turn streamed. `navigate` is a
 * server-defined pseudo-tool whose "execution" is emitting a validated
 * @@action line for the client.
 */

/** llama-3.3-70b-versatile is deprecated on Groq (shutdown 2026-08-16). */
export const GROQ_MODEL = "openai/gpt-oss-120b";
export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export type ToolDef = { readonly name: string; readonly description: string; readonly inputSchema: object };

export type GroqTool = { type: "function"; function: { name: string; description: string; parameters: object } };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export const NAVIGATE_TOOL: GroqTool = {
  type: "function",
  function: {
    name: "navigate",
    description:
      "Navigate the visitor's browser to a page on this site. Use only when the visitor asks to see, open, or go to something. Internal paths only, e.g. /research, /work/kioskvisionai, /agents#fit.",
    parameters: {
      type: "object",
      properties: { path: { type: "string", description: "Internal site path starting with /" } },
      required: ["path"],
    },
  },
};

/** MCP inputSchema → OpenAI function `parameters`, plus the navigate pseudo-tool. */
export function toGroqTools(tools: readonly ToolDef[]): GroqTool[] {
  return [
    ...tools.map((t) => ({
      type: "function" as const,
      function: { name: t.name, description: t.description, parameters: t.inputSchema },
    })),
    NAVIGATE_TOOL,
  ];
}

export function parseToolArgs(raw: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type AgenticChatResult =
  | { kind: "text"; preamble: string; text: string }
  | { kind: "stream"; preamble: string; upstream: Response }
  | { kind: "error"; status: number; message: string };

type GroqChoice = { message?: { content?: string | null; tool_calls?: ToolCall[] }; finish_reason?: string };

const TOOL_RESULT_MAX = 8_000; // keep hop context sane; corpus is already in the system prompt

export async function runAgenticChat(opts: {
  apiKey: string;
  messages: ChatMessage[];
  tools: readonly ToolDef[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<string>;
  model?: string;
  maxTokens?: number;
  maxHops?: number;
  deadlineMs?: number;
  fetchFn?: typeof fetch;
}): Promise<AgenticChatResult> {
  const {
    apiKey,
    messages,
    tools,
    callTool,
    model = GROQ_MODEL,
    maxTokens = 400,
    maxHops = 3,
    deadlineMs = 20_000,
    fetchFn = fetch,
  } = opts;
  const groqTools = toGroqTools(tools);
  const started = Date.now();
  let preamble = "";

  const call = (body: object) =>
    fetchFn(GROQ_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, reasoning_effort: "low", ...body }),
    });

  const upstreamFailure = async (res: Response): Promise<AgenticChatResult> => {
    // status + body land in the function logs; the client only sees the status class
    console.error(`[chat] groq upstream ${res.status}: ${(await res.text().catch(() => "")).slice(0, 500)}`);
    return { kind: "error", status: 502, message: `upstream error (${res.status}) — try again shortly` };
  };

  for (let hop = 0; hop < maxHops && Date.now() - started < deadlineMs; hop++) {
    const res = await call({ stream: false, tools: groqTools, tool_choice: "auto", messages });
    if (!res.ok) return upstreamFailure(res);
    const data = (await res.json().catch(() => null)) as { choices?: GroqChoice[] } | null;
    const msg = data?.choices?.[0]?.message;
    const calls = msg?.tool_calls ?? [];

    if (calls.length === 0) {
      const text = msg?.content ?? "";
      if (text) return { kind: "text", preamble, text };
      break; // empty hop answer — force a streamed final turn below
    }

    messages.push({ role: "assistant", content: msg?.content ?? null, tool_calls: calls });
    for (const tc of calls) {
      const name = tc.function?.name ?? "";
      const args = parseToolArgs(tc.function?.arguments ?? "");
      let result: string;
      if (name === "navigate") {
        const path = args.path;
        if (isInternalPath(path)) {
          preamble += frameAction({ v: 1, type: "navigate", path });
          result = `done — the visitor's browser is navigating to ${path}`;
        } else {
          result = `refused — not an internal page of this site`;
        }
      } else {
        try {
          result = await callTool(name, args);
        } catch (e) {
          result = `tool error: ${e instanceof Error ? e.message : "failed"}`;
        }
      }
      messages.push({ role: "tool", tool_call_id: tc.id, content: result.slice(0, TOOL_RESULT_MAX) });
    }
  }

  // final turn: tools still declared (the transcript references them) but no more calls
  const res = await call({ stream: true, tools: groqTools, tool_choice: "none", messages });
  if (!res.ok || !res.body) return upstreamFailure(res);
  return { kind: "stream", preamble, upstream: res };
}

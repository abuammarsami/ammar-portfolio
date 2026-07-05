import { describe, expect, it, vi } from "vitest";

import { ACTION_PREFIX } from "./chat-actions";
import { type ChatMessage, GROQ_URL, NAVIGATE_TOOL, parseToolArgs, runAgenticChat, toGroqTools } from "./chat-loop";

const TOOLS = [
  { name: "search_publications", description: "search", inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } },
] as const;

function hopResponse(message: object, finish = "tool_calls"): Response {
  return new Response(JSON.stringify({ choices: [{ message, finish_reason: finish }] }), { status: 200 });
}

function toolCall(id: string, name: string, args: object): object {
  return { id, type: "function", function: { name, arguments: JSON.stringify(args) } };
}

function baseMessages(): ChatMessage[] {
  return [
    { role: "system", content: "sys" },
    { role: "user", content: "q" },
  ];
}

describe("toGroqTools", () => {
  it("maps inputSchema to function.parameters and appends navigate", () => {
    const out = toGroqTools(TOOLS);
    expect(out).toHaveLength(2);
    expect(out[0]?.function.name).toBe("search_publications");
    expect(out[0]?.function.parameters).toBe(TOOLS[0].inputSchema);
    expect(out[1]).toBe(NAVIGATE_TOOL);
  });
});

describe("parseToolArgs", () => {
  it("parses objects and defends against junk", () => {
    expect(parseToolArgs('{"a":1}')).toEqual({ a: 1 });
    expect(parseToolArgs("")).toEqual({});
    expect(parseToolArgs("[1,2]")).toEqual({});
    expect(parseToolArgs("{broken")).toEqual({});
  });
});

describe("runAgenticChat", () => {
  it("executes a tool hop then streams the final turn", async () => {
    const callTool = vi.fn().mockResolvedValue("RESULT");
    const bodies: { stream: boolean; tool_choice: string; messages: ChatMessage[] }[] = [];
    const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      expect(url).toBe(GROQ_URL);
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      if (!body.stream) {
        return hopResponse({ tool_calls: [toolCall("c1", "search_publications", { query: "qml" })] });
      }
      return new Response("data: [DONE]\n", { status: 200 });
    });

    const res = await runAgenticChat({ apiKey: "k", messages: baseMessages(), tools: TOOLS, callTool, fetchFn });
    expect(res.kind).toBe("stream");
    expect(callTool).toHaveBeenCalledWith("search_publications", { query: "qml" });
    // transcript carries the assistant tool_calls + the tool result
    const finalMessages = bodies.at(-1)!.messages;
    expect(finalMessages.some((m) => m.role === "tool" && m.content === "RESULT")).toBe(true);
    expect(bodies.at(-1)!.tool_choice).toBe("none");
    expect(bodies.at(-1)!.stream).toBe(true);
  });

  it("returns hop text directly when the model answers without tools", async () => {
    const fetchFn = vi.fn(async () => hopResponse({ content: "plain answer" }, "stop"));
    const res = await runAgenticChat({
      apiKey: "k", messages: baseMessages(), tools: TOOLS, callTool: vi.fn(), fetchFn,
    });
    expect(res).toMatchObject({ kind: "text", text: "plain answer", preamble: "" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("frames validated navigate calls into the preamble and refuses bad paths", async () => {
    let hop = 0;
    const fetchFn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (!body.stream) {
        hop++;
        if (hop === 1) {
          return hopResponse({
            tool_calls: [
              toolCall("c1", "navigate", { path: "/research" }),
              toolCall("c2", "navigate", { path: "https://evil.example" }),
            ],
          });
        }
        return hopResponse({ content: "took you there" }, "stop");
      }
      return new Response("data: [DONE]\n", { status: 200 });
    });

    const res = await runAgenticChat({
      apiKey: "k", messages: baseMessages(), tools: TOOLS, callTool: vi.fn(), fetchFn,
    });
    expect(res.kind).toBe("text");
    if (res.kind !== "text") return;
    expect(res.preamble).toContain(`${ACTION_PREFIX}{"v":1,"type":"navigate","path":"/research"}`);
    expect(res.preamble).not.toContain("evil");
  });

  it("caps hops at maxHops then forces a streamed no-tools turn", async () => {
    let hopCalls = 0;
    const fetchFn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (!body.stream) {
        hopCalls++;
        return hopResponse({ tool_calls: [toolCall(`c${hopCalls}`, "search_publications", { query: "x" })] });
      }
      expect(body.tool_choice).toBe("none");
      return new Response("data: [DONE]\n", { status: 200 });
    });
    const res = await runAgenticChat({
      apiKey: "k", messages: baseMessages(), tools: TOOLS,
      callTool: vi.fn().mockResolvedValue("r"), maxHops: 2, fetchFn,
    });
    expect(res.kind).toBe("stream");
    expect(hopCalls).toBe(2);
  });

  it("surfaces tool errors to the model instead of crashing", async () => {
    let finalMessages: ChatMessage[] = [];
    const fetchFn = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (!body.stream) {
        if (body.messages.some((m: ChatMessage) => m.role === "tool")) {
          return hopResponse({ content: "sorry, unknown paper" }, "stop");
        }
        return hopResponse({ tool_calls: [toolCall("c1", "search_publications", { query: "x" })] });
      }
      finalMessages = body.messages;
      return new Response("data: [DONE]\n", { status: 200 });
    });
    const res = await runAgenticChat({
      apiKey: "k", messages: baseMessages(), tools: TOOLS,
      callTool: vi.fn().mockRejectedValue(new Error("unknown paper: nope")), fetchFn,
    });
    expect(res.kind).toBe("text");
    expect(finalMessages).toEqual([]); // answered on hop 2, no streamed turn needed
  });

  it("maps upstream failures to a 502 error result", async () => {
    const fetchFn = vi.fn(async () => new Response("nope", { status: 500 }));
    const res = await runAgenticChat({
      apiKey: "k", messages: baseMessages(), tools: TOOLS, callTool: vi.fn(), fetchFn,
    });
    expect(res).toMatchObject({ kind: "error", status: 502 });
  });
});

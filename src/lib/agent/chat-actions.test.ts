import { describe, expect, it } from "vitest";

import { ACTION_PREFIX, createScrubber, frameAction, isInternalPath, parseActionLine } from "./chat-actions";

describe("isInternalPath", () => {
  it("accepts top pages", () => {
    for (const p of ["/", "/learn", "/work", "/research", "/about", "/agents", "/writing"]) {
      expect(isInternalPath(p)).toBe(true);
    }
  });
  it("accepts detail slugs and fragments", () => {
    expect(isInternalPath("/work/kioskvisionai")).toBe(true);
    expect(isInternalPath("/research/quantum-machine-learning-thesis")).toBe(true);
    expect(isInternalPath("/agents#fit")).toBe(true);
  });
  it("rejects external, protocol, traversal, and junk paths", () => {
    expect(isInternalPath("https://evil.example")).toBe(false);
    expect(isInternalPath("//evil.example")).toBe(false);
    expect(isInternalPath("/api/mcp")).toBe(false);
    expect(isInternalPath("/work/../../etc")).toBe(false);
    expect(isInternalPath("/agents#fit#x")).toBe(false);
    expect(isInternalPath("")).toBe(false);
    expect(isInternalPath(42)).toBe(false);
    expect(isInternalPath("/" + "a".repeat(200))).toBe(false);
  });
});

describe("frameAction / parseActionLine", () => {
  it("round-trips a navigate action", () => {
    const framed = frameAction({ v: 1, type: "navigate", path: "/research" });
    expect(framed.startsWith("\n" + ACTION_PREFIX)).toBe(true);
    const line = framed.trim();
    expect(parseActionLine(line)).toEqual({ v: 1, type: "navigate", path: "/research" });
  });
  it("rejects non-whitelisted paths even in well-formed frames", () => {
    expect(parseActionLine(`${ACTION_PREFIX}{"v":1,"type":"navigate","path":"https://evil.example"}`)).toBeNull();
  });
  it("rejects malformed json, wrong version, and plain text", () => {
    expect(parseActionLine(`${ACTION_PREFIX}{nope`)).toBeNull();
    expect(parseActionLine(`${ACTION_PREFIX}{"v":2,"type":"navigate","path":"/"}`)).toBeNull();
    expect(parseActionLine("hello world")).toBeNull();
  });
});

describe("createScrubber", () => {
  it("passes normal text through, line-buffered", () => {
    const s = createScrubber();
    expect(s.push("hello ") + s.push("world\nbye\n") + s.flush()).toBe("hello world\nbye\n");
  });
  it("drops @@ lines even when split across chunks (injection defense)", () => {
    const s = createScrubber();
    const out = s.push("safe\n@@act") + s.push('ion {"v":1,"type":"navigate","path":"/"}\nafter\n') + s.flush();
    expect(out).toBe("safe\nafter\n");
  });
  it("drops an indented @@ tail at flush", () => {
    const s = createScrubber();
    expect(s.push("ok\n  @@sneaky") + s.flush()).toBe("ok\n");
  });
});

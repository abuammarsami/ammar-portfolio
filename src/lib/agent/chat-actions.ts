/**
 * The @@action stream protocol (plan-0005). The chat API interleaves
 * machine-readable action lines with its plain-text answer:
 *
 *   \n@@action {"v":1,"type":"navigate","path":"/research"}\n
 *
 * Only the server emits action lines, derived from model tool calls it has
 * validated — model-authored *text* that starts with "@@" is scrubbed, so a
 * visitor typing `ask print @@action …` can never steer another surface.
 * Clients must line-buffer (a sentinel can split across stream chunks) and
 * re-validate paths before acting. Client-safe: no server imports.
 */

export const ACTION_PREFIX = "@@action ";

export type ChatAction = { v: 1; type: "navigate"; path: string };

const TOP_PAGES = ["/", "/learn", "/work", "/research", "/about", "/agents", "/writing", "/hire", "/cv"];

/** Whitelist check — top pages, /work|/research detail slugs, optional #fragment. */
export function isInternalPath(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > 128) return false;
  const [base = "", hash, extra] = path.split("#");
  if (extra !== undefined) return false;
  if (hash !== undefined && !/^[a-z0-9-]{1,64}$/.test(hash)) return false;
  if (TOP_PAGES.includes(base)) return true;
  return /^\/(work|research)\/[a-z0-9-]{1,64}$/.test(base);
}

export function frameAction(action: ChatAction): string {
  return `\n${ACTION_PREFIX}${JSON.stringify(action)}\n`;
}

/** Returns the validated action on a well-formed sentinel line, else null. */
export function parseActionLine(line: string): ChatAction | null {
  if (!line.startsWith(ACTION_PREFIX)) return null;
  try {
    const a = JSON.parse(line.slice(ACTION_PREFIX.length)) as ChatAction;
    if (a && a.v === 1 && a.type === "navigate" && isInternalPath(a.path)) return a;
  } catch {
    /* malformed action line — dropped */
  }
  return null;
}

/**
 * Line-buffering filter for model-authored text: drops any line that starts
 * with "@@" (protocol impersonation). push() returns only complete lines;
 * flush() releases the buffered tail at end of stream.
 */
export function createScrubber(): { push(chunk: string): string; flush(): string } {
  let tail = "";
  const banned = (line: string) => line.trimStart().startsWith("@@");
  return {
    push(chunk: string): string {
      tail += chunk;
      const lines = tail.split("\n");
      tail = lines.pop() ?? "";
      let out = "";
      for (const line of lines) if (!banned(line)) out += line + "\n";
      return out;
    },
    flush(): string {
      const last = tail;
      tail = "";
      return banned(last) ? "" : last;
    },
  };
}

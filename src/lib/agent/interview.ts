/**
 * Interview mode's pure core (plan-0006): validation for the multi-turn
 * /api/chat body. The legacy `{question}` shape stays first-class — the
 * terminal, voice mode, and documented external callers all use it. The
 * system prompt is never accepted from the client, and history is clamped
 * so a conversation can't ride the token budget past the free tier's
 * 8k tokens/minute (profile ~2.1k + capped history stays well inside).
 */

export type InterviewTurn = { role: "user" | "assistant"; content: string };

export const INTERVIEW_USER_MAX = 500;
export const INTERVIEW_ASSISTANT_MAX = 1200;
/** Most entries accepted in a request body. */
export const INTERVIEW_TURNS_MAX = 12;
/** Turns actually sent to the model (the newest ones). */
export const INTERVIEW_TURNS_KEPT = 6;

export type ParsedChatBody = { turns: InterviewTurn[]; surface: "chat" | "interview" };

function validTurn(raw: unknown): InterviewTurn | null {
  if (!raw || typeof raw !== "object") return null;
  const t = raw as { role?: unknown; content?: unknown };
  if (t.role !== "user" && t.role !== "assistant") return null;
  if (typeof t.content !== "string" || t.content.trim().length === 0) return null;
  const max = t.role === "user" ? INTERVIEW_USER_MAX : INTERVIEW_ASSISTANT_MAX;
  if (t.content.length > max) return null;
  return { role: t.role, content: t.content };
}

/**
 * `{question}` or `{messages, surface?}` → normalized turns, or null.
 * Messages must alternate user/assistant and end with a user turn; only the
 * newest INTERVIEW_TURNS_KEPT survive, re-trimmed to start on a user turn.
 */
export function parseChatBody(body: unknown): ParsedChatBody | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { question?: unknown; messages?: unknown; surface?: unknown };
  const surface = b.surface === "interview" ? ("interview" as const) : ("chat" as const);

  if (typeof b.question === "string") {
    const q = b.question.trim();
    if (q.length === 0 || q.length > INTERVIEW_USER_MAX) return null;
    return { turns: [{ role: "user", content: q }], surface };
  }

  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > INTERVIEW_TURNS_MAX) return null;
  const turns: InterviewTurn[] = [];
  for (const raw of b.messages) {
    const turn = validTurn(raw);
    if (!turn) return null;
    if (turns.length > 0 && turns[turns.length - 1]!.role === turn.role) return null; // must alternate
    turns.push(turn);
  }
  if (turns[turns.length - 1]!.role !== "user") return null;

  let kept = turns.slice(-INTERVIEW_TURNS_KEPT);
  if (kept[0]!.role === "assistant") kept = kept.slice(1);
  return { turns: kept, surface };
}

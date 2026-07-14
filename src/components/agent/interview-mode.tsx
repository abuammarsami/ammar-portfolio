"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { parseActionLine } from "@/lib/agent/chat-actions";
import { INTERVIEW_ASSISTANT_MAX, INTERVIEW_TURNS_KEPT, INTERVIEW_USER_MAX, type InterviewTurn } from "@/lib/agent/interview";
import { claimStage, releaseStage } from "@/lib/agent/stage-lock";
import { recognitionCtor, speak, type SpeechRecognitionLike } from "@/components/ui/voice-controller";
import { AnswerBlocks } from "./answer-blocks";

/**
 * Interview mode (plan-0006): a bottom "interview bar" — the visitor asks by
 * voice or text, the grounded agent answers in a stream, and the site drives
 * itself above (server-emitted @@action navigations, re-validated here).
 * The bar keeps the whole conversation as a scrollable transcript.
 * Fully lazy: this module mounts its own React root, so the eager bundle
 * pays only for the event constant + one listener in the provider.
 */

// claimStage allows same-holder re-claim, so re-entry needs its own guard —
// without it a second INTERVIEW_EVENT would stack a second bar + listeners
let open = false;

export function openInterview(navigate: (path: string) => void): void {
  // captured before claimStage hides the ✦ launcher (hiding blurs it), so
  // closing can hand focus back to whatever opened the bar
  const opener = document.activeElement as HTMLElement | null;
  if (open || !claimStage("interview")) return; // one bar; autopilot may hold the stage
  open = true;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const close = () => {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    root.unmount();
    host.remove();
    releaseStage("interview");
    open = false;
  };
  root.render(<InterviewBar navigate={navigate} onClose={close} opener={opener} />);
}

/** One display exchange — full text for the transcript; the API history is derived clamped. */
type Exchange = { q: string; a: string; done: boolean; stopped?: boolean };

// exactly the context the server keeps: parseChatBody slices to
// INTERVIEW_TURNS_KEPT turns, so sending more is upload-only-to-discard
const CONTEXT_EXCHANGES = Math.floor((INTERVIEW_TURNS_KEPT - 1) / 2);

const STARTERS = [
  "What has he shipped to production?",
  "Tell me about his payment infrastructure work",
  "What is his quantum ML research about?",
  "Why should I interview him?",
];

function toApiMessages(log: Exchange[], q: string): InterviewTurn[] {
  const history = log
    // stopped exchanges hold partial text the model never actually said — don't replay them
    .filter((x) => x.done && x.a && !x.stopped)
    .slice(-CONTEXT_EXCHANGES)
    .flatMap((x): InterviewTurn[] => [
      { role: "user", content: x.q },
      { role: "assistant", content: x.a.slice(0, INTERVIEW_ASSISTANT_MAX) },
    ]);
  return [...history, { role: "user", content: q }];
}

/** Completed rows bail out of re-renders — only the streaming row re-parses per chunk. */
const ExchangeRow = memo(function ExchangeRow({
  x,
  index,
  first,
  streaming,
  copied,
  onCopy,
}: {
  x: Exchange;
  index: number;
  first: boolean;
  streaming: boolean;
  copied: boolean;
  onCopy: (index: number, text: string) => void;
}) {
  return (
    <div className={first ? "" : "mt-4 border-t border-muted/15 pt-3"}>
      <p className="font-mono text-xs text-q1">» {x.q}</p>
      {x.a && (
        <div className="mt-1 [&>p:first-child]:mt-1">
          <AnswerBlocks text={x.a} />
        </div>
      )}
      {streaming && <span className="ml-1 inline-block h-3.5 w-2 animate-pulse bg-q0/70" aria-hidden />}
      {x.done && x.a && (
        <button
          onClick={() => onCopy(index, x.a)}
          className="mt-1.5 font-mono text-[11px] text-muted/80 hover:text-ink"
        >
          {copied ? "copied ✓" : "⧉ copy"}
        </button>
      )}
    </div>
  );
});

function InterviewBar({
  navigate,
  onClose,
  opener,
}: {
  navigate: (path: string) => void;
  onClose: () => void;
  opener: HTMLElement | null;
}) {
  const [log, setLog] = useState<Exchange[]>([]);
  const [question, setQuestion] = useState("");
  const [phase, setPhase] = useState<"idle" | "streaming" | "listening">("idle");
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const stateRef = useRef({ log, phase });
  stateRef.current = { log, phase };
  const micSupported = typeof window !== "undefined" && Boolean(recognitionCtor());

  // every exit path — Escape AND the ✕ button — ends here, so keyboard
  // users get their focus back either way
  const end = () => {
    abortRef.current?.abort();
    recRef.current?.abort();
    onClose();
    opener?.focus?.();
  };
  const endRef = useRef(end);
  endRef.current = end;

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") endRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      abortRef.current?.abort();
      recRef.current?.abort();
    };
  }, []);

  // transcript follows the stream, but never fights a reader who scrolled up
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stickRef = useRef(true);
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [log]);
  const onScroll = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  /** Update the in-flight (last) exchange. */
  const patchLast = (patch: Partial<Exchange>) => {
    setLog((l) => (l.length === 0 ? l : [...l.slice(0, -1), { ...l[l.length - 1]!, ...patch }]));
  };

  const ask = async (raw: string, viaVoice: boolean) => {
    const q = raw.trim().slice(0, INTERVIEW_USER_MAX);
    if (!q || stateRef.current.phase === "streaming") return;
    const messages = toApiMessages(stateRef.current.log, q);
    setLog((l) => [...l, { q, a: "", done: false }]);
    stickRef.current = true;
    setNote("");
    setQuestion("");
    setCopied(-1);
    setPhase("streaming");
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, surface: "interview" }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        setNote(await res.text());
        patchLast({ done: true, stopped: true });
        setPhase("idle");
        return;
      }
      // line-buffered @@action interception — sentinels can split across chunks
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = "";
      let tail = "";
      const takeLine = (line: string) => {
        const action = parseActionLine(line);
        if (action) navigate(action.path);
        else if (!line.trimStart().startsWith("@@")) text += line + "\n";
      };
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        tail += decoder.decode(value, { stream: true });
        const lines = tail.split("\n");
        tail = lines.pop() ?? "";
        for (const line of lines) takeLine(line);
        patchLast({ a: (text + (tail.trimStart().startsWith("@@") ? "" : tail)).trim() });
      }
      if (tail) takeLine(tail);
      const final = text.trim();
      patchLast({ a: final, done: true });
      setPhase("idle");
      if (viaVoice && final) speak(final);
    } catch {
      // abort = the visitor pressed stop; anything else is a transport failure
      setNote(ac.signal.aborted ? "stopped" : "connection hiccup — check your network and try again");
      patchLast({ done: true, stopped: true });
      setPhase("idle");
    }
  };

  const listen = () => {
    const Ctor = recognitionCtor();
    if (!Ctor || stateRef.current.phase === "streaming") return;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    const rec = new Ctor();
    recRef.current = rec; // ending the bar must also release the mic
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    setPhase("listening");
    setNote("");
    let heard = false;
    rec.onresult = (e) => {
      heard = true;
      void ask(e.results[0][0].transcript, true);
    };
    const fail = () => {
      if (!heard) {
        setNote("didn't catch that — try the mic again or type");
        setPhase("idle");
      }
    };
    rec.onerror = fail;
    rec.onend = fail;
    rec.start();
  };

  const copyAnswer = useCallback(async (i: number, a: string) => {
    try {
      await navigator.clipboard.writeText(a);
      setCopied(i);
      setTimeout(() => setCopied(-1), 1500);
    } catch {
      /* clipboard unavailable (permission / insecure context) — silently skip */
    }
  }, []);

  return (
    <div
      role="dialog"
      aria-label="Interview mode"
      className="fixed inset-x-0 bottom-0 z-[60] border-t rule-hair bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto max-w-3xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-baseline justify-between gap-3 font-mono text-xs text-muted">
          <p className="min-w-0 truncate">
            <span className="text-q0">interview mode</span>
            <span className="hidden sm:inline"> — ask about his work; I answer grounded and drive the site while I talk</span>
          </p>
          <span className="flex shrink-0 items-baseline gap-3">
            {log.length > 0 && phase !== "streaming" && (
              <button onClick={() => setLog([])} className="hover:text-ink">
                clear
              </button>
            )}
            <button onClick={end} className="hover:text-ink">
              <span className="hidden sm:inline">⟨esc⟩ end </span>✕
            </button>
          </span>
        </div>

        {log.length === 0 && (
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
            {STARTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void ask(s, false)}
                className="rounded-sm border border-muted/30 px-2.5 py-1 font-mono text-xs text-muted transition-colors hover:border-q0/60 hover:text-q0"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {(log.length > 0 || note) && (
          <div
            ref={scrollRef}
            onScroll={onScroll}
            aria-live="polite"
            aria-atomic="false"
            className="mt-3 max-h-[42dvh] overflow-y-auto font-serif text-sm leading-relaxed sm:max-h-80"
          >
            {log.map((x, i) => (
              <ExchangeRow
                key={i}
                x={x}
                index={i}
                first={i === 0}
                streaming={!x.done && i === log.length - 1}
                copied={copied === i}
                onCopy={copyAnswer}
              />
            ))}
            {note && <p className="mt-2 font-mono text-xs text-muted">{note}</p>}
          </div>
        )}

        <form
          className="mt-3 flex items-center gap-2 font-mono text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            // Enter never kills an in-flight answer — stopping is only the ■ button
            if (phase !== "streaming") void ask(question, false);
          }}
        >
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, INTERVIEW_USER_MAX))}
            placeholder={phase === "listening" ? "listening…" : "ask a question — e.g. what has he shipped to production?"}
            className="min-w-0 flex-1 border border-muted/30 bg-bg/60 px-3 py-2 focus:border-q0 focus:outline-none"
          />
          {phase === "streaming" ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="border border-muted/40 px-4 py-2 text-muted hover:text-ink"
            >
              ■ stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={question.trim().length === 0}
              className="border border-q0/60 px-4 py-2 text-q0 hover:bg-q0/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ask
            </button>
          )}
          {micSupported && (
            <button
              type="button"
              onClick={listen}
              aria-label="Ask by voice"
              className={`border px-3 py-2 ${phase === "listening" ? "border-q1 text-q1" : "border-muted/40 text-muted hover:text-ink"}`}
            >
              ⟨🎙⟩
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

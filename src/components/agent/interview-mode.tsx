"use client";

import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { parseActionLine } from "@/lib/agent/chat-actions";
import { INTERVIEW_TURNS_MAX, INTERVIEW_USER_MAX, type InterviewTurn } from "@/lib/agent/interview";
import { claimStage, releaseStage } from "@/lib/agent/stage-lock";
import { recognitionCtor, speak } from "@/components/ui/voice-controller";

/**
 * Interview mode (plan-0006): a bottom "interview bar" — the visitor asks by
 * voice or text, the grounded agent answers in a stream, and the site drives
 * itself above (server-emitted @@action navigations, re-validated here).
 * Fully lazy: this module mounts its own React root, so the eager bundle
 * pays only for the event constant + one listener in the provider.
 */

export function openInterview(navigate: (path: string) => void): void {
  if (!claimStage("interview")) return; // the autopilot has the stage
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const close = () => {
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    root.unmount();
    host.remove();
    releaseStage("interview");
  };
  root.render(<InterviewBar navigate={navigate} onClose={close} />);
}

function InterviewBar({ navigate, onClose }: { navigate: (path: string) => void; onClose: () => void }) {
  const [turns, setTurns] = useState<InterviewTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [asked, setAsked] = useState(""); // the question currently on stage
  const [phase, setPhase] = useState<"idle" | "streaming" | "listening">("idle");
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stateRef = useRef({ turns, phase });
  stateRef.current = { turns, phase };
  const micSupported = typeof window !== "undefined" && Boolean(recognitionCtor());

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        abortRef.current?.abort();
        onClose();
        opener?.focus?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      abortRef.current?.abort();
    };
  }, [onClose]);

  const ask = async (raw: string, viaVoice: boolean) => {
    const q = raw.trim().slice(0, INTERVIEW_USER_MAX);
    if (!q || stateRef.current.phase === "streaming") return;
    const history = stateRef.current.turns.slice(-(INTERVIEW_TURNS_MAX - 1));
    const messages = [...history, { role: "user" as const, content: q }];
    setAsked(q);
    setAnswer("");
    setNote("");
    setQuestion("");
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
        setAnswer((text + (tail.trimStart().startsWith("@@") ? "" : tail)).trim());
      }
      if (tail) takeLine(tail);
      const final = text.trim();
      setAnswer(final);
      setTurns([...messages, { role: "assistant", content: final.slice(0, 1200) || "…" }]);
      setPhase("idle");
      if (viaVoice && final) speak(final);
    } catch {
      setNote("stopped");
      setPhase("idle");
    }
  };

  const listen = () => {
    const Ctor = recognitionCtor();
    if (!Ctor || stateRef.current.phase === "streaming") return;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    const rec = new Ctor();
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

  return (
    <div
      role="dialog"
      aria-label="Interview mode"
      className="fixed inset-x-0 bottom-0 z-[60] border-t rule-hair bg-surface/95 backdrop-blur"
    >
      <div className="mx-auto max-w-3xl px-6 py-4">
        <div className="flex items-baseline justify-between font-mono text-xs text-muted">
          <p>
            <span className="text-q0">interview mode</span> — ask about his work; I answer grounded and drive the site
            while I talk
          </p>
          <button onClick={onClose} className="hover:text-ink">
            ⟨esc⟩ end ✕
          </button>
        </div>

        {(asked || note) && (
          <div className="mt-3 max-h-48 overflow-y-auto font-serif text-sm leading-relaxed">
            {asked && <p className="font-mono text-xs text-q1">» {asked}</p>}
            {note && <p className="mt-1 font-mono text-xs text-muted">{note}</p>}
            {answer && <p className="mt-2 whitespace-pre-line">{answer}</p>}
            {phase === "streaming" && <span className="ml-1 inline-block h-3.5 w-2 animate-pulse bg-q0/70" aria-hidden />}
          </div>
        )}

        <form
          className="mt-3 flex items-center gap-2 font-mono text-sm"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question, false);
          }}
        >
          <input
            ref={inputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, INTERVIEW_USER_MAX))}
            placeholder={phase === "listening" ? "listening…" : "ask a question — e.g. what has he shipped to production?"}
            className="min-w-0 flex-1 border border-muted/30 bg-bg/60 px-3 py-2 focus:border-q0 focus:outline-none"
          />
          <button
            type="submit"
            disabled={phase === "streaming" || question.trim().length === 0}
            className="border border-q0/60 px-4 py-2 text-q0 hover:bg-q0/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ask
          </button>
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

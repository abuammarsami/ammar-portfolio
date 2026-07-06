import { sanitizeForSpeech, splitSentences } from "@/lib/agent/voice";

import { runCommand, type TerminalCtx } from "./terminal-engine";

/**
 * Voice mode (plan-0005 P4): mic → SpeechRecognition → the ordinary `ask`
 * flow → the answer spoken sentence-by-sentence via speechSynthesis.
 * Lazy-loaded on first use; the mic button/command supplies the user
 * gesture some browsers require before speaking. Escape stops speech.
 */

// The Web Speech API recognition types are not in TypeScript's dom lib —
// minimal ambient shapes for the parts used here.
export type SpeechRecognitionResultEvent = { results: { 0: { 0: { transcript: string } } } };
export type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start(): void;
};
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export function recognitionCtor(): SpeechRecognitionCtor | undefined {
  const w = window as Window & { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

// one Escape listener across all speak() calls — removed when speech ends
// naturally too, so repeated voice answers can't accumulate listeners
let escListener: ((e: KeyboardEvent) => void) | null = null;
function clearEscListener(): void {
  if (escListener) {
    window.removeEventListener("keydown", escListener);
    escListener = null;
  }
}

export function speak(text: string): void {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  clearEscListener();
  const sentences = splitSentences(sanitizeForSpeech(text));
  if (sentences.length === 0) return;
  const utterances = sentences.map((s) => {
    const u = new SpeechSynthesisUtterance(s);
    u.rate = 1.05;
    return u;
  });
  const last = utterances[utterances.length - 1]!;
  last.onend = clearEscListener;
  escListener = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      speechSynthesis.cancel();
      clearEscListener();
    }
  };
  window.addEventListener("keydown", escListener);
  for (const u of utterances) speechSynthesis.speak(u); // queued — one sentence per utterance
}

export function startVoice(ctx: TerminalCtx): void {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    ctx.setLines((prev) => [...prev.slice(-14), "voice isn't supported in this browser — type `ask <question>` instead"]);
    return;
  }
  if ("speechSynthesis" in window) speechSynthesis.cancel();

  const rec = new Ctor();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;

  let heard = false;
  ctx.setLines((prev) => [...prev.slice(-14), "listening… speak your question (esc stops the spoken reply)"]);
  rec.onresult = (e) => {
    heard = true;
    const q = e.results[0][0].transcript.trim();
    if (!q) return;
    runCommand(`ask ${q}`, { ...ctx, onAnswer: (text) => speak(text) });
  };
  let failed = false; // onerror fires and then onend follows — report once
  const fail = () => {
    if (!heard && !failed) {
      failed = true;
      ctx.setLines((prev) => [...prev.filter((l) => !l.startsWith("listening…")), "didn't catch that — try `voice` again or type `ask <question>`"]);
    }
  };
  rec.onerror = fail;
  rec.onend = fail;
  rec.start();
}

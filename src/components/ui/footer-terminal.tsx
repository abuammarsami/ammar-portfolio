"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useRef, useState, useSyncExternalStore } from "react";

const PROMPT = "ammar@portfolio:~$";

// Hydration-safe: server says no mic, client checks the real API once.
const noSub = () => () => {};
function useVoiceSupported(): boolean {
  return useSyncExternalStore(
    noSub,
    () => "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    () => false,
  );
}

/** The footer prompt is real — type `help`. Command engine loads on first Enter. */
export function FooterTerminal() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [lines, setLines] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const voiceSupported = useVoiceSupported();

  const makeCtx = () => ({
    prompt: PROMPT,
    navigate: (path: string) => router.push(path),
    toggleTheme: () => {
      const next = resolvedTheme === "dark" ? "light" : "dark";
      setTheme(next);
      return next;
    },
    setLines,
  });

  function run(raw: string) {
    void import("./terminal-engine").then((m) => m.runCommand(raw, makeCtx()));
  }

  return (
    <footer className="border-t rule-hair no-print">
      <div
        className="mx-auto max-w-4xl cursor-text space-y-1.5 px-6 py-8 font-mono text-sm"
        onClick={() => inputRef.current?.focus()}
      >
        <p className="text-muted">
          {PROMPT} <span className="text-ink">contact --list</span>
        </p>
        <p>
          <a href="mailto:abuammarsami@gmail.com" className="text-q0 hover:underline">
            abuammarsami@gmail.com
          </a>
        </p>
        <p>
          <a
            href="https://github.com/abuammarsami"
            className="text-q1 hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            github.com/abuammarsami
          </a>
        </p>
        <p>
          <a
            href="https://linkedin.com/in/abu-ammar/"
            className="text-q0 hover:underline"
            rel="noopener noreferrer"
            target="_blank"
          >
            linkedin.com/in/abu-ammar
          </a>
        </p>
        {lines.map((l, i) => (
          <p key={i} className={l.startsWith(PROMPT) ? "pt-2 text-ink" : "text-muted"}>
            {l}
          </p>
        ))}
        <p className="flex items-center gap-2 pt-2 text-muted">
          <span>{PROMPT}</span>
          <input
            ref={inputRef}
            type="text"
            aria-label="Terminal input — type help for commands"
            placeholder="type `help`"
            spellCheck={false}
            autoComplete="off"
            className="w-40 flex-1 border-none bg-transparent font-mono text-sm text-ink outline-none placeholder:text-muted/50"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                run(e.currentTarget.value);
                e.currentTarget.value = "";
              }
            }}
          />
          {voiceSupported && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void import("./voice-controller").then((m) => m.startVoice(makeCtx()));
              }}
              aria-label="Ask by voice — the answer is spoken back"
              title="ask by voice"
              className="font-mono text-sm text-muted transition-colors hover:text-q0"
            >
              ⌾ voice
            </button>
          )}
        </p>
      </div>
    </footer>
  );
}

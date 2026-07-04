"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useRef, useState } from "react";

const PROMPT = "ammar@portfolio:~$";

const HELP = [
  "help            this list",
  "cv              download resume.pdf",
  "email           copy my email address",
  "theme           toggle dark/light",
  "goto <page>     work · research · about · writing",
  "clear           clear output",
];

/** The footer prompt is real — type `help`. */
export function FooterTerminal() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [lines, setLines] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function run(raw: string) {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;
    const echo = `${PROMPT} ${raw}`;
    const out: string[] = [echo];
    const [name, arg] = cmd.split(/\s+/);
    switch (name) {
      case "help":
        out.push(...HELP);
        break;
      case "cv":
        out.push("fetching resume.pdf …");
        window.location.assign("/resume.pdf");
        break;
      case "email":
        void navigator.clipboard.writeText("abuammarsami@gmail.com");
        out.push("abuammarsami@gmail.com → clipboard ✓");
        break;
      case "theme":
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        out.push(`theme → ${resolvedTheme === "dark" ? "light" : "dark"}`);
        break;
      case "goto":
        if (arg && ["work", "research", "about", "writing"].includes(arg)) {
          out.push(`navigating to /${arg} …`);
          router.push(`/${arg}`);
        } else {
          out.push("usage: goto work | research | about | writing");
        }
        break;
      case "clear":
        setLines([]);
        return;
      default:
        out.push(`command not found: ${name} — try \`help\``);
    }
    setLines((prev) => [...prev.slice(-14), ...out]);
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
        </p>
      </div>
    </footer>
  );
}

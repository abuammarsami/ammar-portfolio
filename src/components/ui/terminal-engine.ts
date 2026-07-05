import type { Dispatch, SetStateAction } from "react";

import { parseActionLine } from "@/lib/agent/chat-actions";
import { applyLens, isLens, LENSES } from "@/lib/agent/lens";
import { AUTOPILOT_EVENT } from "@/lib/agent/autopilot-event";

/**
 * The footer terminal's command engine — lazy-loaded on the first Enter so
 * the eager per-page cost is just the prompt UI (per-route budgets are thin;
 * plan-0005). Pure of React rendering: everything flows through ctx.
 */

export type TerminalCtx = {
  prompt: string;
  navigate(path: string): void;
  /** Flips the theme and returns the new one. */
  toggleTheme(): string;
  setLines: Dispatch<SetStateAction<string[]>>;
  /** Voice mode (P4): receives the answer text of `ask`, minus action lines. */
  onAnswer?(text: string): void;
};

const HELP = [
  "help            this list",
  "cv              download resume.pdf",
  "email           copy my email address",
  "theme           toggle dark/light",
  "goto <page>     learn · work · research · agents · about · writing",
  "lens <who>      view as recruiter · professor · engineer",
  "ask <question>  ask my AI agent — it can search my work and take you there",
  "voice           ask by speaking; the answer talks back (Chrome/Safari)",
  "fit             paste a job description, get an honest fit report",
  "demo            autopilot: watch the agent interview this site",
  "clear           clear output",
];

export function runCommand(raw: string, ctx: TerminalCtx): void {
  const cmd = raw.trim().toLowerCase();
  if (!cmd) return;
  const echo = `${ctx.prompt} ${raw}`;
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
      out.push(`theme → ${ctx.toggleTheme()}`);
      break;
    case "goto":
      if (arg && ["learn", "work", "research", "agents", "about", "writing"].includes(arg)) {
        out.push(`navigating to /${arg} …`);
        ctx.navigate(`/${arg}`);
      } else {
        out.push("usage: goto work | research | agents | about | writing");
      }
      break;
    case "fit":
      out.push("opening the fit report …");
      ctx.navigate("/agents#fit");
      break;
    case "voice":
      void import("./voice-controller").then((m) => m.startVoice(ctx));
      break;
    case "demo":
      out.push("engaging autopilot — ⟨esc⟩ or scroll to stop …");
      window.dispatchEvent(new Event(AUTOPILOT_EVENT));
      break;
    case "lens":
      if (arg && isLens(arg)) {
        applyLens(arg);
        out.push(`⟨${arg}| — the site now speaks to a ${arg}`);
      } else {
        out.push(`usage: lens ${LENSES.join(" | ")}`);
      }
      break;
    case "ask": {
      const q = raw.trim().slice(4).trim();
      if (!q) {
        out.push("usage: ask <question about Ammar>");
        break;
      }
      out.push("thinking…");
      ctx.setLines((prev) => [...prev.slice(-14), ...out]);
      void (async () => {
        try {
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ question: q }),
          });
          const text = await res.text();
          // intercept @@action lines (agentic chat — plan-0005); drop any other "@@" line
          const rendered: string[] = [];
          const answer: string[] = [];
          for (const line of text.split("\n")) {
            const action = parseActionLine(line);
            if (action) {
              rendered.push(`→ opening ${action.path} …`);
              ctx.navigate(action.path);
            } else if (line && !line.trimStart().startsWith("@@")) {
              rendered.push(line);
              answer.push(line);
            }
          }
          ctx.setLines((prev) => [...prev.filter((l) => l !== "thinking…").slice(-10), ...rendered]);
          if (answer.length) ctx.onAnswer?.(answer.join(" "));
        } catch {
          ctx.setLines((prev) => [...prev, "agent unreachable — try /llms-full.txt"]);
        }
      })();
      return;
    }
    case "clear":
      ctx.setLines([]);
      return;
    default:
      out.push(`command not found: ${name} — try \`help\``);
  }
  ctx.setLines((prev) => [...prev.slice(-14), ...out]);
}

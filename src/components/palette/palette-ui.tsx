"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState } from "react";

import { applyLens, LENSES } from "@/lib/agent/lens";
import { AUTOPILOT_EVENT, INTERVIEW_EVENT } from "@/lib/agent/autopilot-event";
import { searchEntries, type SearchEntry } from "@/lib/search";

type Command = { id: string; label: string; hint: string; run: () => void };

const LENS_HINTS: Record<(typeof LENSES)[number], string> = {
  recruiter: "systems & impact first (default)",
  professor: "research & theses first",
  engineer: "architecture & cadence first",
};

/** The palette body — lazy-loaded by command-palette.tsx on first ⌘K. */
export function PaletteUi({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [index, setIndex] = useState<SearchEntry[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // full-content search index — static JSON, fetched once per palette open
  useEffect(() => {
    let alive = true;
    void fetch("/search-index.json")
      .then((r) => r.json())
      .then((d: { entries?: SearchEntry[] }) => {
        if (alive && Array.isArray(d.entries)) setIndex(d.entries);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const commands: Command[] = [
    { id: "learn", label: "goto learn", hint: "qubit → QML, interactive", run: () => router.push("/learn") },
    { id: "playground", label: "goto playground", hint: "build a real 2-qubit circuit", run: () => router.push("/playground") },
    { id: "work", label: "goto work", hint: "engineering case studies", run: () => router.push("/work") },
    { id: "research", label: "goto research", hint: "arXiv-style listing", run: () => router.push("/research") },
    { id: "agents", label: "goto agents", hint: "the machine interface", run: () => router.push("/agents") },
    { id: "hire", label: "goto hire", hint: "tutoring · consulting · office hours", run: () => router.push("/hire") },
    { id: "cv-view", label: "view cv", hint: "typeset, print-ready, lens-aware", run: () => router.push("/cv") },
    { id: "fit", label: "fit report", hint: "paste a JD, get an honest match", run: () => router.push("/agents#fit") },
    { id: "autopilot", label: "autopilot demo", hint: "watch the agent interview this site", run: () => window.dispatchEvent(new Event(AUTOPILOT_EVENT)) },
    { id: "interview", label: "interview mode", hint: "ask by voice or text; the site drives itself", run: () => window.dispatchEvent(new Event(INTERVIEW_EVENT)) },
    { id: "about", label: "goto about", hint: "narrative · experience · skills", run: () => router.push("/about") },
    { id: "home", label: "goto home", hint: "the quantum hero", run: () => router.push("/") },
    ...LENSES.map((lens) => ({
      id: `lens-${lens}`,
      label: `view as ${lens}`,
      hint: LENS_HINTS[lens],
      run: () => applyLens(lens),
    })),
    { id: "cv", label: "download cv", hint: "resume.pdf", run: () => { window.location.assign("/resume.pdf"); } },
    { id: "email", label: "copy email", hint: "abuammarsami@gmail.com", run: () => void navigator.clipboard.writeText("abuammarsami@gmail.com") },
    { id: "theme", label: "toggle theme", hint: resolvedTheme === "dark" ? "→ light" : "→ dark", run: () => setTheme(resolvedTheme === "dark" ? "light" : "dark") },
    { id: "github", label: "open github", hint: "abuammarsami", run: () => window.open("https://github.com/abuammarsami", "_blank", "noopener") },
  ];
  const contentHits: Command[] = query.trim()
    ? searchEntries(index, query, 5).map((e) => ({
        id: `open-${e.path}`,
        label: `open ${e.title.length > 34 ? e.title.slice(0, 33) + "…" : e.title}`,
        hint: `${e.kind} · ${e.hint}`,
        run: () => router.push(e.path),
      }))
    : [];
  const filtered = [...commands.filter((c) => c.label.includes(query.toLowerCase().trim())), ...contentHits];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // aria-modal contract: focus moves in on open, returns to the trigger on close
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  const dialogRef = useRef<HTMLDivElement | null>(null);
  const trapTab = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusables = dialogRef.current?.querySelectorAll<HTMLElement>("input, button");
    if (!focusables || focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  function exec(c: Command | undefined) {
    if (!c) return;
    onClose();
    c.run();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[18vh] backdrop-blur-[2px]"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-md rounded-sm border rule-hair bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={trapTab}
      >
        <div className="flex items-center gap-2 border-b rule-hair px-4 py-3 font-mono text-sm">
          <span className="text-q0">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter") exec(filtered[active]);
            }}
            placeholder="type a command…"
            aria-label="Search commands"
            className="flex-1 border-none bg-transparent text-ink outline-none placeholder:text-muted/60"
          />
          <kbd className="text-xs text-muted">esc</kbd>
        </div>
        <ul className="max-h-72 overflow-y-auto py-1 font-mono text-sm">
          {filtered.length === 0 && <li className="px-4 py-2 text-muted">no matching command</li>}
          {filtered.map((c, i) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => exec(c)}
                onPointerEnter={() => setActive(i)}
                className={`flex w-full items-baseline justify-between px-4 py-2 text-left ${
                  i === active ? "bg-q0/10 text-q0" : "text-ink"
                }`}
              >
                <span>{c.label}</span>
                <span className="text-xs text-muted">{c.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
